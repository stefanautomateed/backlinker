#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { config, validateConfig } from './config/config.js';
import { BacklinkerDB } from './database/db.js';
import { loadDirectories, getDirectories } from './utils/directory-loader.js';
import { SubmissionOrchestrator } from './services/submission-orchestrator.js';

const program = new Command();

program
  .name('backlinker')
  .description('Automated backlink submission system for directory listings')
  .version('1.0.0');

/**
 * Init command - Load directories into database
 */
program
  .command('init')
  .description('Initialize database and load directory list')
  .action(async () => {
    console.log(chalk.blue.bold('\n🚀 Initializing Backlinker\n'));

    try {
      // Validate configuration
      validateConfig();
      console.log(chalk.green('✓ Configuration valid'));

      // Load directories
      const spinner = ora('Loading directories...').start();
      const count = loadDirectories();
      spinner.succeed(`Loaded ${count} directories into database`);

      console.log(chalk.green.bold('\n✅ Initialization complete!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.cyan('  1. Run "npm start status" to see directory status'));
      console.log(chalk.cyan('  2. Run "npm start submit" to start submissions'));
      console.log();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Status command - Show submission status
 */
program
  .command('status')
  .description('Show submission status for all directories')
  .option('-s, --status <status>', 'Filter by status (pending, success, failed, requires_manual)')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📊 Submission Status\n'));

    try {
      const db = new BacklinkerDB();
      const stats = db.getStats();

      // Print overall stats
      const statsTable = new Table({
        head: ['Status', 'Count'],
        style: { head: ['cyan'] },
      });

      statsTable.push(
        ['Total Directories', stats.total],
        [chalk.green('Success'), stats.success],
        [chalk.red('Failed'), stats.failed],
        [chalk.yellow('Requires Manual'), stats.pending],
        [chalk.blue('In Progress'), stats.inProgress]
      );

      console.log(statsTable.toString());
      console.log();

      // Show detailed list if requested
      if (options.status) {
        const directories = db.getDirectoriesByStatus(options.status);

        if (directories.length === 0) {
          console.log(chalk.yellow(`No directories with status: ${options.status}`));
        } else {
          const detailsTable = new Table({
            head: ['ID', 'Name', 'URL', 'Status', 'Updated'],
            style: { head: ['cyan'] },
            colWidths: [5, 30, 50, 15, 20],
          });

          directories.forEach((dir) => {
            detailsTable.push([
              dir.id,
              dir.name.substring(0, 28),
              dir.url.substring(0, 48),
              dir.status,
              dir.updated_at,
            ]);
          });

          console.log(detailsTable.toString());
          console.log();
        }
      }

      db.close();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Submit command - Start submissions
 */
program
  .command('submit')
  .description('Submit to directories')
  .option('-l, --limit <number>', 'Limit number of submissions', '10')
  .option('-s, --status <status>', 'Only submit to directories with this status', 'pending')
  .option('-i, --id <id>', 'Submit to specific directory by ID')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 Starting Submissions\n'));

    try {
      // Validate configuration
      validateConfig();

      const db = new BacklinkerDB();
      let directories = [];

      if (options.id) {
        // Submit to specific directory
        const dir = db.getDirectoryById(parseInt(options.id));
        if (!dir) {
          console.error(chalk.red(`❌ Directory with ID ${options.id} not found`));
          process.exit(1);
        }
        directories = [dir];
      } else {
        // Get directories by status
        directories = db.getDirectoriesByStatus(options.status);

        // Apply limit
        const limit = parseInt(options.limit);
        if (limit > 0) {
          directories = directories.slice(0, limit);
        }
      }

      if (directories.length === 0) {
        console.log(chalk.yellow('No directories to submit to'));
        db.close();
        return;
      }

      console.log(chalk.cyan(`Found ${directories.length} directories to process\n`));

      db.close();

      // Start orchestrator
      const orchestrator = new SubmissionOrchestrator();

      // Use parallel batch processing if bulk submission is enabled
      let results;
      if (config.bulkSubmission.enabled && directories.length > 5) {
        console.log(chalk.cyan(`Using parallel batch processing with ${config.bulkSubmission.parallelBrowsers} browsers\n`));
        results = await orchestrator.submitInParallelBatches(directories);
      } else {
        results = await orchestrator.submitToDirectories(directories);
      }

      orchestrator.close();

      // Exit with appropriate code
      if (results.failed.length === directories.length) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Test command - Test submission on a single directory
 */
program
  .command('test')
  .description('Test submission on a single directory')
  .argument('<url>', 'Directory URL to test')
  .action(async (url) => {
    console.log(chalk.blue.bold('\n🧪 Test Mode\n'));

    try {
      // Validate configuration
      validateConfig();

      const db = new BacklinkerDB();

      // Check if directory exists
      let directory = db.getDirectoryByUrl(url);

      if (!directory) {
        // Create temporary test entry
        console.log(chalk.yellow('Directory not in database, creating test entry...'));
        const id = db.upsertDirectory('Test Directory', url, 'Test');
        directory = db.getDirectoryById(id);
      }

      db.close();

      // Run submission
      const orchestrator = new SubmissionOrchestrator();
      await orchestrator.submitToDirectory(directory);
      orchestrator.close();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * List command - List all directories
 */
program
  .command('list')
  .description('List all directories')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📋 Directory List\n'));

    try {
      const directories = getDirectories();

      let filtered = directories;
      if (options.category) {
        filtered = directories.filter((d) =>
          d.category.toLowerCase().includes(options.category.toLowerCase())
        );
      }

      const table = new Table({
        head: ['ID', 'Name', 'URL', 'Category', 'Status'],
        style: { head: ['cyan'] },
        colWidths: [5, 25, 40, 25, 15],
      });

      filtered.forEach((dir) => {
        table.push([
          dir.id,
          dir.name.substring(0, 23),
          dir.url.substring(0, 38),
          dir.category.substring(0, 23),
          dir.status,
        ]);
      });

      console.log(table.toString());
      console.log(chalk.cyan(`\nTotal: ${filtered.length} directories\n`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Reset command - Reset directory status
 */
program
  .command('reset')
  .description('Reset directory status')
  .option('-i, --id <id>', 'Reset specific directory by ID')
  .option('-s, --status <status>', 'Reset all directories with this status')
  .option('--all', 'Reset all directories to pending')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔄 Reset Status\n'));

    try {
      const db = new BacklinkerDB();

      if (options.id) {
        db.updateDirectoryStatus(parseInt(options.id), 'pending');
        console.log(chalk.green(`✓ Reset directory ${options.id} to pending`));
      } else if (options.status) {
        const directories = db.getDirectoriesByStatus(options.status);
        directories.forEach((dir) => {
          db.updateDirectoryStatus(dir.id, 'pending');
        });
        console.log(chalk.green(`✓ Reset ${directories.length} directories to pending`));
      } else if (options.all) {
        const directories = db.getAllDirectories();
        directories.forEach((dir) => {
          db.updateDirectoryStatus(dir.id, 'pending');
        });
        console.log(chalk.green(`✓ Reset ${directories.length} directories to pending`));
      } else {
        console.log(chalk.yellow('Please specify --id, --status, or --all'));
      }

      db.close();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Dashboard command - Start web dashboard
 */
program
  .command('dashboard')
  .description('Start web dashboard for visual monitoring and control')
  .action(async () => {
    console.log(chalk.blue.bold('\n🚀 Starting Dashboard Server\n'));

    try {
      validateConfig();

      if (!config.dashboard.enabled) {
        console.log(chalk.yellow('⚠️  Dashboard is disabled in configuration'));
        console.log(chalk.cyan('Enable it by setting DASHBOARD_ENABLED=true in your .env file'));
        process.exit(1);
      }

      // Import and start dashboard server
      const { DashboardServer } = await import('./server/dashboard-server.js');
      const server = new DashboardServer();
      server.start();

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down dashboard server...');
        server.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
