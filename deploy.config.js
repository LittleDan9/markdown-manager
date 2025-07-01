// Deployment configuration
const path = require('path');
const os = require('os');

const config = {
  // Build configuration
  build: {
    outputDir: 'dist',
    cleanBeforeBuild: true,
    compressionEnabled: true
  },

  // Deployment targets
  targets: {
    production: {
      local: {
        condition: () => os.hostname() === 'Danbian',
        destination: '/var/www/littledan.com/',
        type: 'local'
      },
      remote: {
        condition: () => os.hostname() !== 'Danbian',
        destination: 'dlittle@10.0.1.51:/var/www/littledan.com/',
        type: 'remote'
      }
    },
    staging: {
      local: {
        condition: () => os.hostname() === 'Danbian',
        destination: '/var/www/staging.littledan.com/',
        type: 'local'
      },
      remote: {
        condition: () => os.hostname() !== 'Danbian',
        destination: 'dlittle@10.0.1.51:/var/www/staging.littledan.com/',
        type: 'remote'
      }
    }
  },

  // Rsync options
  rsync: {
    options: [
      '--recursive',
      '--no-perms',
      '--no-times',
      '--no-group',
      '--progress',
      '--delete', // Remove files from destination that don't exist in source
      '--exclude=.DS_Store',
      '--exclude=*.log'
    ]
  },

  // Post-deployment actions
  postDeploy: {
    notifications: true,
    verification: true
  }
};

module.exports = config;
