#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const deployConfig = require('../deploy.config');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function build() {
  logInfo('Building production assets...');

  try {
    // Clean build directory if configured
    if (deployConfig.build.cleanBeforeBuild && fs.existsSync(deployConfig.build.outputDir)) {
      fs.rmSync(deployConfig.build.outputDir, { recursive: true, force: true });
      logInfo('Cleaned build directory');
    }

    // Run webpack build
    await execCommand('npm run build');
    logSuccess('Build completed successfully');

    // Verify build output
    if (!fs.existsSync(deployConfig.build.outputDir)) {
      throw new Error('Build output directory not found');
    }

    const files = fs.readdirSync(deployConfig.build.outputDir);
    if (files.length === 0) {
      throw new Error('Build output directory is empty');
    }

    logSuccess(`Build verification passed (${files.length} files generated)`);

  } catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
  }
}

function getDeploymentTarget(environment) {
  const targets = deployConfig.targets[environment];
  if (!targets) {
    throw new Error(`Unknown environment: ${environment}`);
  }

  // Find the matching target based on conditions
  for (const [name, target] of Object.entries(targets)) {
    if (target.condition()) {
      return { name, ...target };
    }
  }

  throw new Error(`No matching deployment target found for environment: ${environment}`);
}

async function deploy(environment, skipBuild = false) {
  try {
    log(`🚀 Starting deployment to ${environment}...`, 'cyan');

    // Build if not skipped
    if (!skipBuild) {
      await build();
    } else {
      logWarning('Skipping build step');

      // Still verify dist exists
      if (!fs.existsSync(deployConfig.build.outputDir)) {
        logError('Build output not found. Please run build first or remove --skip-build flag.');
        process.exit(1);
      }
    }

    // Get deployment target
    const target = getDeploymentTarget(environment);
    logInfo(`Deploying to ${target.type} target: ${target.destination}`);

    // Show what will be deployed
    const files = fs.readdirSync(deployConfig.build.outputDir);
    logInfo(`Deploying ${files.length} files: ${files.join(', ')}`);

    // Build rsync command
    const rsyncOptions = deployConfig.rsync.options.join(' ');
    const rsyncCommand = `rsync ${rsyncOptions} ${deployConfig.build.outputDir}/ ${target.destination}`;

    logInfo('Executing deployment...');
    await execCommand(rsyncCommand);

    // Post-deployment verification
    if (deployConfig.postDeploy.verification && target.type === 'local') {
      const indexPath = path.join(target.destination, 'index.html');
      if (fs.existsSync(indexPath)) {
        logSuccess('Deployment verification passed');
      } else {
        logWarning('Deployment verification failed - index.html not found at destination');
      }
    }

    logSuccess(`🎉 Deployment to ${environment} completed successfully!`);

    if (target.type === 'remote') {
      logInfo('📱 Your application should now be live at your web server');
    } else {
      logInfo(`📱 Your application is deployed to: ${target.destination}`);
    }

  } catch (error) {
    logError(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args[0] || 'production';
const skipBuild = args.includes('--skip-build');

// Validate environment
if (!deployConfig.targets[environment]) {
  logError(`Invalid environment: ${environment}`);
  logInfo(`Available environments: ${Object.keys(deployConfig.targets).join(', ')}`);
  process.exit(1);
}

// Run deployment
deploy(environment, skipBuild).catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});
