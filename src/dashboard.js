#!/usr/bin/env node

import { DashboardServer } from './server/dashboard-server.js';
import { config, validateConfig } from './config/config.js';

/**
 * Start Dashboard Server
 */
async function main() {
  try {
    // Validate configuration
    validateConfig();

    // Check if dashboard is enabled
    if (!config.dashboard.enabled) {
      console.error('❌ Dashboard is disabled in configuration');
      console.log('Enable it by setting DASHBOARD_ENABLED=true in your .env file');
      process.exit(1);
    }

    // Create and start server
    const server = new DashboardServer();
    server.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down dashboard server...');
      server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\n🛑 Shutting down dashboard server...');
      server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error starting dashboard:', error.message);
    process.exit(1);
  }
}

main();
