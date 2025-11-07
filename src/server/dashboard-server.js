import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/config.js';
import { BacklinkerDB } from '../database/db.js';
import { SubmissionOrchestrator } from '../services/submission-orchestrator.js';
import { captchaSolver } from '../services/captcha-solver.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dashboard Server
 * Provides web UI and API for managing directory submissions
 */
export class DashboardServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIO(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.db = new BacklinkerDB();
    this.orchestrator = null;
    this.isSubmitting = false;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, '../public')));

    // Simple authentication middleware
    this.app.use((req, res, next) => {
      // Allow static files
      if (req.path.startsWith('/api')) {
        const auth = req.headers.authorization;

        if (!auth) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const [username, password] = Buffer.from(auth.split(' ')[1], 'base64')
          .toString()
          .split(':');

        if (username !== config.dashboard.username || password !== config.dashboard.password) {
          return res.status(403).json({ error: 'Invalid credentials' });
        }
      }

      next();
    });

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        config: {
          parallelBrowsers: config.bulkSubmission.parallelBrowsers,
          batchSize: config.bulkSubmission.batchSize,
          captchaEnabled: config.captcha.enabled,
        },
      });
    });

    // Get statistics
    this.app.get('/api/stats', (req, res) => {
      try {
        const stats = this.db.getStats();
        const categoryStats = this.db.getStatsByCategory();
        const captchaStats = this.db.getCaptchaStats();

        res.json({
          overall: stats,
          byCategory: categoryStats,
          captcha: captchaStats,
        });
      } catch (error) {
        logger.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get all directories
    this.app.get('/api/directories', (req, res) => {
      try {
        const { status, category, limit } = req.query;

        let directories;
        if (status) {
          directories = this.db.getDirectoriesByStatus(status);
        } else {
          directories = this.db.getDirectoriesWithLatestSubmission();
        }

        // Filter by category if provided
        if (category) {
          directories = directories.filter((d) => d.category === category);
        }

        // Limit results if provided
        if (limit) {
          directories = directories.slice(0, parseInt(limit));
        }

        res.json(directories);
      } catch (error) {
        logger.error('Error getting directories:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get recent submissions
    this.app.get('/api/submissions/recent', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 20;
        const submissions = this.db.getRecentSubmissions(limit);
        res.json(submissions);
      } catch (error) {
        logger.error('Error getting recent submissions:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get submissions for a specific directory
    this.app.get('/api/directories/:id/submissions', (req, res) => {
      try {
        const directoryId = parseInt(req.params.id);
        const submissions = this.db.getSubmissionsByDirectory(directoryId);
        res.json(submissions);
      } catch (error) {
        logger.error('Error getting directory submissions:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Start submissions
    this.app.post('/api/submissions/start', async (req, res) => {
      try {
        if (this.isSubmitting) {
          return res.status(400).json({ error: 'Submission already in progress' });
        }

        const { status = 'pending', limit, parallel = true } = req.body;

        let directories = this.db.getDirectoriesByStatus(status);

        if (limit) {
          directories = directories.slice(0, limit);
        }

        if (directories.length === 0) {
          return res.status(400).json({ error: 'No directories to submit' });
        }

        this.isSubmitting = true;

        // Start submission in background
        this.startSubmissions(directories, parallel);

        res.json({
          message: 'Submissions started',
          count: directories.length,
          parallel,
        });
      } catch (error) {
        logger.error('Error starting submissions:', error);
        this.isSubmitting = false;
        res.status(500).json({ error: error.message });
      }
    });

    // Pause submissions
    this.app.post('/api/submissions/pause', (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(400).json({ error: 'No active submissions' });
        }

        this.orchestrator.pause();
        res.json({ message: 'Submissions paused' });
      } catch (error) {
        logger.error('Error pausing submissions:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Resume submissions
    this.app.post('/api/submissions/resume', (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.status(400).json({ error: 'No active submissions' });
        }

        this.orchestrator.resume();
        res.json({ message: 'Submissions resumed' });
      } catch (error) {
        logger.error('Error resuming submissions:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get submission status
    this.app.get('/api/submissions/status', (req, res) => {
      try {
        if (!this.orchestrator) {
          return res.json({ isSubmitting: false });
        }

        const status = this.orchestrator.getStatus();
        res.json({
          isSubmitting: this.isSubmitting,
          ...status,
        });
      } catch (error) {
        logger.error('Error getting submission status:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Reset directories
    this.app.post('/api/directories/reset', (req, res) => {
      try {
        const { statuses = ['failed', 'uncertain'], directoryId } = req.body;

        if (directoryId) {
          this.db.resetDirectory(directoryId);
          res.json({ message: 'Directory reset successfully' });
        } else {
          const result = this.db.resetDirectoriesByStatus(statuses);
          res.json({
            message: 'Directories reset successfully',
            count: result.changes,
          });
        }
      } catch (error) {
        logger.error('Error resetting directories:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get CAPTCHA balance
    this.app.get('/api/captcha/balance', async (req, res) => {
      try {
        if (!captchaSolver.isEnabled()) {
          return res.json({ enabled: false });
        }

        const balance = await captchaSolver.getBalance();
        res.json({
          enabled: true,
          balance,
        });
      } catch (error) {
        logger.error('Error getting CAPTCHA balance:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Serve dashboard HTML
    this.app.get('/', (req, res) => {
      res.sendFile(join(__dirname, '../public/index.html'));
    });
  }

  /**
   * Setup Socket.IO for real-time updates
   */
  setupSocketIO() {
    this.io.on('connection', (socket) => {
      logger.info('Client connected to dashboard');

      socket.on('disconnect', () => {
        logger.info('Client disconnected from dashboard');
      });

      // Send initial stats
      try {
        const stats = this.db.getStats();
        socket.emit('stats', stats);
      } catch (error) {
        logger.error('Error sending initial stats:', error);
      }
    });
  }

  /**
   * Start submissions and emit real-time updates
   */
  async startSubmissions(directories, parallel = true) {
    try {
      this.orchestrator = new SubmissionOrchestrator();

      // Forward all events to Socket.IO clients
      this.orchestrator.on('directory:start', (data) => {
        this.io.emit('directory:start', data);
      });

      this.orchestrator.on('directory:success', (data) => {
        this.io.emit('directory:success', data);
        this.broadcastStats();
      });

      this.orchestrator.on('directory:error', (data) => {
        this.io.emit('directory:error', data);
        this.broadcastStats();
      });

      this.orchestrator.on('directory:manual', (data) => {
        this.io.emit('directory:manual', data);
        this.broadcastStats();
      });

      this.orchestrator.on('batch:start', (data) => {
        this.io.emit('batch:start', data);
      });

      this.orchestrator.on('batch:complete', (data) => {
        this.io.emit('batch:complete', data);
      });

      this.orchestrator.on('submission:complete', (data) => {
        this.io.emit('submission:complete', data);
        this.broadcastStats();
      });

      // Start submissions
      let results;
      if (parallel && config.bulkSubmission.enabled) {
        results = await this.orchestrator.submitInParallelBatches(directories);
      } else {
        results = await this.orchestrator.submitToDirectories(directories);
      }

      logger.info('Submissions completed', results);
    } catch (error) {
      logger.error('Error during submissions:', error);
      this.io.emit('submission:error', { error: error.message });
    } finally {
      this.isSubmitting = false;
      if (this.orchestrator) {
        this.orchestrator.close();
        this.orchestrator = null;
      }
    }
  }

  /**
   * Broadcast updated statistics to all connected clients
   */
  broadcastStats() {
    try {
      const stats = this.db.getStats();
      this.io.emit('stats', stats);
    } catch (error) {
      logger.error('Error broadcasting stats:', error);
    }
  }

  /**
   * Start the server
   */
  start() {
    const { host, port } = config.dashboard;

    this.server.listen(port, host, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🚀 Dashboard Server Started');
      console.log(`${'='.repeat(60)}`);
      console.log(`📊 Dashboard: http://${host}:${port}`);
      console.log(`🔐 Username: ${config.dashboard.username}`);
      console.log(`🔐 Password: ${config.dashboard.password}`);
      console.log(`${'='.repeat(60)}\n`);

      logger.info(`Dashboard server started on http://${host}:${port}`);
    });
  }

  /**
   * Stop the server
   */
  stop() {
    this.server.close();
    this.db.close();
    logger.info('Dashboard server stopped');
  }
}
