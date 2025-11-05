import { BrowserService } from './browser.js';
import { FormFiller } from './form-filler.js';
import { BacklinkerDB } from '../database/db.js';
import { config } from '../config/config.js';
import { logSubmission, logError, logInfo } from '../utils/logger.js';
import { captchaSolver } from './captcha-solver.js';
import PQueue from 'p-queue';
import { EventEmitter } from 'events';

/**
 * Submission Orchestrator
 * Coordinates the entire submission process with parallel processing
 */
export class SubmissionOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.db = new BacklinkerDB();

    // Determine concurrency based on bulk submission settings
    const concurrency = config.bulkSubmission.enabled
      ? config.bulkSubmission.parallelBrowsers
      : config.automation.maxConcurrentSubmissions;

    this.queue = new PQueue({ concurrency });
    this.isPaused = false;
    this.currentBatch = 0;
    this.totalBatches = 0;
  }

  /**
   * Pause submissions
   */
  pause() {
    this.isPaused = true;
    this.queue.pause();
    this.emit('paused');
    console.log('⏸️  Submissions paused');
  }

  /**
   * Resume submissions
   */
  resume() {
    this.isPaused = false;
    this.queue.start();
    this.emit('resumed');
    console.log('▶️  Submissions resumed');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isPaused: this.isPaused,
      queueSize: this.queue.size,
      pending: this.queue.pending,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
    };
  }

  /**
   * Submit to a single directory
   */
  async submitToDirectory(directory) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 Processing: ${directory.name}`);
    console.log(`🔗 URL: ${directory.url}`);
    console.log(`${'='.repeat(60)}\n`);

    // Emit start event
    this.emit('directory:start', {
      directoryId: directory.id,
      name: directory.name,
      url: directory.url,
    });

    const browser = new BrowserService();
    let submissionId = null;

    try {
      // Update directory status
      this.db.updateDirectoryStatus(directory.id, 'in_progress');

      // Create submission record
      submissionId = this.db.createSubmission(directory.id);

      // Initialize browser
      console.log('🌐 Initializing browser...');
      await browser.init();

      // Navigate to the directory
      console.log('🔄 Navigating to page...');
      const navigated = await browser.navigate(directory.url);

      if (!navigated) {
        throw new Error('Failed to navigate to page');
      }

      // Wait for page to load
      await browser.page.waitForTimeout(config.rateLimiting.delayBetweenPagesMs);

      // Get page content
      const currentUrl = await browser.getURL();
      console.log(`✓ Loaded: ${currentUrl}`);

      // Initialize form filler
      const formFiller = new FormFiller(browser);

      // Analyze and fill the form
      const fillResult = await formFiller.analyzeAndFill(currentUrl);

      if (!fillResult.success) {
        // Log the analysis for future reference
        if (fillResult.analysis) {
          this.db.logAnalysis(directory.id, submissionId, 'page_analysis', fillResult.analysis);
        }

        // Determine if it requires manual intervention
        if (fillResult.requiresManual) {
          console.log(`⚠️  Requires manual intervention: ${fillResult.reason}`);
          this.db.updateSubmission(submissionId, {
            status: 'requires_manual',
            errorMessage: fillResult.reason,
            notes: JSON.stringify(fillResult),
          });
          this.db.updateDirectoryStatus(directory.id, 'requires_manual');

          // Take screenshot for manual review
          if (config.automation.screenshotOnError) {
            const screenshotPath = await browser.screenshot(
              `manual_${directory.id}_${Date.now()}.png`
            );
            this.db.updateSubmission(submissionId, { screenshotPath });
            console.log(`📸 Screenshot saved: ${screenshotPath}`);
          }

          // Emit manual event
          this.emit('directory:manual', {
            directoryId: directory.id,
            name: directory.name,
            reason: fillResult.reason,
          });

          return {
            success: false,
            status: 'requires_manual',
            reason: fillResult.reason,
          };
        }

        throw new Error(fillResult.reason || 'Failed to analyze/fill form');
      }

      // Log successful form analysis
      this.db.logAnalysis(directory.id, submissionId, 'form_analysis', fillResult.analysis);

      // Submit the form if we have a submit button
      if (fillResult.analysis.submitButton) {
        const submitResult = await formFiller.submit(fillResult.analysis.submitButton);

        // Log submission result
        this.db.logAnalysis(directory.id, submissionId, 'submission_verification', submitResult.verification);

        if (submitResult.success) {
          console.log('✅ Submission successful!');
          if (submitResult.verification.successMessage) {
            console.log(`📝 Message: ${submitResult.verification.successMessage}`);
          }
          if (submitResult.verification.nextSteps) {
            console.log(`ℹ️  Next steps: ${submitResult.verification.nextSteps}`);
          }

          // Update records
          this.db.updateSubmission(submissionId, {
            status: 'success',
            formData: fillResult.fillResult,
            notes: JSON.stringify({
              verification: submitResult.verification,
              filledFields: fillResult.fillResult.filledFields,
            }),
          });
          this.db.updateDirectoryStatus(directory.id, 'success');

          logSubmission(directory, 'success', {
            verification: submitResult.verification,
          });

          // Emit success event
          this.emit('directory:success', {
            directoryId: directory.id,
            name: directory.name,
            verification: submitResult.verification,
          });

          return {
            success: true,
            status: 'success',
            verification: submitResult.verification,
          };
        } else {
          console.log(`❌ Submission may have failed: ${submitResult.verification.reason}`);

          // Take screenshot for review
          if (config.automation.screenshotOnError) {
            const screenshotPath = await browser.screenshot(
              `failed_${directory.id}_${Date.now()}.png`
            );
            this.db.updateSubmission(submissionId, { screenshotPath });
            console.log(`📸 Screenshot saved: ${screenshotPath}`);
          }

          this.db.updateSubmission(submissionId, {
            status: 'uncertain',
            errorMessage: submitResult.verification.reason,
            formData: fillResult.fillResult,
            notes: JSON.stringify({
              verification: submitResult.verification,
              filledFields: fillResult.fillResult.filledFields,
            }),
          });
          this.db.updateDirectoryStatus(directory.id, 'uncertain');

          return {
            success: false,
            status: 'uncertain',
            reason: submitResult.verification.reason,
          };
        }
      } else {
        // No submit button found, but form was filled
        console.log('⚠️  Form filled but no submit button found');

        // Take screenshot for manual review
        if (config.automation.screenshotOnError) {
          const screenshotPath = await browser.screenshot(
            `no_submit_${directory.id}_${Date.now()}.png`
          );
          this.db.updateSubmission(submissionId, { screenshotPath });
          console.log(`📸 Screenshot saved: ${screenshotPath}`);
        }

        this.db.updateSubmission(submissionId, {
          status: 'requires_manual',
          errorMessage: 'No submit button found',
          formData: fillResult.fillResult,
        });
        this.db.updateDirectoryStatus(directory.id, 'requires_manual');

        return {
          success: false,
          status: 'requires_manual',
          reason: 'No submit button found',
        };
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      logError('submission', error, { directory: directory.name });

      // Emit error event
      this.emit('directory:error', {
        directoryId: directory.id,
        name: directory.name,
        error: error.message,
      });

      // Take screenshot on error
      if (config.automation.screenshotOnError) {
        try {
          const screenshotPath = await browser.screenshot(
            `error_${directory.id}_${Date.now()}.png`
          );
          if (submissionId) {
            this.db.updateSubmission(submissionId, { screenshotPath });
          }
          console.log(`📸 Screenshot saved: ${screenshotPath}`);
        } catch (screenshotError) {
          console.error('Failed to take screenshot:', screenshotError.message);
        }
      }

      if (submissionId) {
        this.db.updateSubmission(submissionId, {
          status: 'failed',
          errorMessage: error.message,
        });
      }
      this.db.updateDirectoryStatus(directory.id, 'failed');

      return {
        success: false,
        status: 'failed',
        error: error.message,
      };
    } finally {
      // Close browser
      await browser.close();
      console.log('🔒 Browser closed\n');

      // Delay before next submission
      if (config.rateLimiting.delayBetweenSubmissionsMs > 0) {
        console.log(
          `⏳ Waiting ${config.rateLimiting.delayBetweenSubmissionsMs / 1000}s before next submission...\n`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, config.rateLimiting.delayBetweenSubmissionsMs)
        );
      }
    }
  }

  /**
   * Submit to multiple directories with retry logic
   */
  async submitToDirectories(directories, options = {}) {
    const { maxRetries = config.automation.retryAttempts } = options;

    console.log(`\n🚀 Starting submission to ${directories.length} directories\n`);
    logInfo('Batch submission started', {
      totalDirectories: directories.length,
      maxRetries,
    });

    const results = {
      success: [],
      failed: [],
      requiresManual: [],
      uncertain: [],
    };

    for (const directory of directories) {
      let attempts = 0;
      let lastResult = null;

      while (attempts <= maxRetries) {
        attempts++;

        if (attempts > 1) {
          console.log(`\n🔄 Retry attempt ${attempts - 1}/${maxRetries} for ${directory.name}`);
        }

        lastResult = await this.submitToDirectory(directory);

        // If successful or requires manual, don't retry
        if (lastResult.status === 'success' || lastResult.status === 'requires_manual') {
          break;
        }

        // If failed and we have retries left, wait before retry
        if (attempts <= maxRetries) {
          const retryDelay = 5000 * attempts; // Exponential backoff
          console.log(`⏳ Waiting ${retryDelay / 1000}s before retry...\n`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      // Categorize result
      if (lastResult.status === 'success') {
        results.success.push(directory);
      } else if (lastResult.status === 'requires_manual') {
        results.requiresManual.push(directory);
      } else if (lastResult.status === 'uncertain') {
        results.uncertain.push(directory);
      } else {
        results.failed.push(directory);
      }
    }

    // Print summary
    this.printSummary(results);

    return results;
  }

  /**
   * Print submission summary
   */
  printSummary(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUBMISSION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Requires Manual: ${results.requiresManual.length}`);
    console.log(`❓ Uncertain: ${results.uncertain.length}`);
    console.log('='.repeat(60) + '\n');

    if (results.requiresManual.length > 0) {
      console.log('⚠️  Directories requiring manual intervention:');
      results.requiresManual.forEach((dir) => {
        console.log(`   - ${dir.name} (${dir.url})`);
      });
      console.log();
    }

    if (results.uncertain.length > 0) {
      console.log('❓ Directories with uncertain results (needs verification):');
      results.uncertain.forEach((dir) => {
        console.log(`   - ${dir.name} (${dir.url})`);
      });
      console.log();
    }

    logInfo('Batch submission completed', {
      success: results.success.length,
      failed: results.failed.length,
      requiresManual: results.requiresManual.length,
      uncertain: results.uncertain.length,
    });
  }

  /**
   * Submit to directories in parallel batches
   * Optimized for bulk submissions
   */
  async submitInParallelBatches(directories, options = {}) {
    const {
      maxRetries = config.automation.retryAttempts,
      batchSize = config.bulkSubmission.batchSize,
      pauseBetweenBatches = config.bulkSubmission.pauseBetweenBatchesMs,
    } = options;

    console.log(`\n🚀 Starting PARALLEL submission to ${directories.length} directories`);
    console.log(`⚙️  Settings:`);
    console.log(`   - Parallel browsers: ${this.queue.concurrency}`);
    console.log(`   - Batch size: ${batchSize}`);
    console.log(`   - Pause between batches: ${pauseBetweenBatches / 1000}s\n`);

    logInfo('Parallel batch submission started', {
      totalDirectories: directories.length,
      parallelBrowsers: this.queue.concurrency,
      batchSize,
      maxRetries,
    });

    // Check CAPTCHA solver balance if enabled
    if (captchaSolver.isEnabled()) {
      const balance = await captchaSolver.getBalance();
      if (balance !== null) {
        console.log(`💰 2captcha balance: $${balance.toFixed(2)}\n`);
      }
    }

    const results = {
      success: [],
      failed: [],
      requiresManual: [],
      uncertain: [],
    };

    // Split directories into batches
    const batches = [];
    for (let i = 0; i < directories.length; i += batchSize) {
      batches.push(directories.slice(i, i + batchSize));
    }

    this.totalBatches = batches.length;
    this.emit('batches:total', this.totalBatches);

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (this.isPaused) {
        console.log('⏸️  Submissions paused, waiting to resume...');
        await new Promise((resolve) => {
          const checkPause = setInterval(() => {
            if (!this.isPaused) {
              clearInterval(checkPause);
              resolve();
            }
          }, 1000);
        });
      }

      this.currentBatch = batchIndex + 1;
      const batch = batches[batchIndex];

      console.log(`\n${'='.repeat(70)}`);
      console.log(`📦 BATCH ${batchIndex + 1}/${batches.length} - Processing ${batch.length} directories in parallel`);
      console.log(`${'='.repeat(70)}\n`);

      this.emit('batch:start', {
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        batchSize: batch.length,
      });

      // Process all directories in the batch concurrently
      const batchPromises = batch.map((directory) =>
        this.queue.add(async () => {
          let attempts = 0;
          let lastResult = null;

          while (attempts <= maxRetries) {
            attempts++;

            if (attempts > 1) {
              console.log(`\n🔄 Retry attempt ${attempts - 1}/${maxRetries} for ${directory.name}`);
            }

            lastResult = await this.submitToDirectory(directory);

            // If successful or requires manual, don't retry
            if (lastResult.status === 'success' || lastResult.status === 'requires_manual') {
              break;
            }

            // If failed and we have retries left, wait before retry
            if (attempts <= maxRetries) {
              const retryDelay = 3000 * attempts; // Exponential backoff
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
          }

          // Categorize result
          if (lastResult.status === 'success') {
            results.success.push(directory);
          } else if (lastResult.status === 'requires_manual') {
            results.requiresManual.push(directory);
          } else if (lastResult.status === 'uncertain') {
            results.uncertain.push(directory);
          } else {
            results.failed.push(directory);
          }

          return lastResult;
        })
      );

      // Wait for all in batch to complete
      await Promise.allSettled(batchPromises);

      this.emit('batch:complete', {
        batchIndex: batchIndex + 1,
        results: {
          success: results.success.length,
          failed: results.failed.length,
          requiresManual: results.requiresManual.length,
          uncertain: results.uncertain.length,
        },
      });

      // Pause between batches (except after last batch)
      if (batchIndex < batches.length - 1 && pauseBetweenBatches > 0) {
        console.log(`\n⏳ Pausing ${pauseBetweenBatches / 1000}s before next batch...\n`);
        await new Promise((resolve) => setTimeout(resolve, pauseBetweenBatches));
      }
    }

    // Print final summary
    this.printSummary(results);
    this.emit('submission:complete', results);

    return results;
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}
