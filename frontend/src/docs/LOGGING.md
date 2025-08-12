# Logging System Documentation

## Overview

The application now includes a comprehensive logging system that automatically filters debug messages based on the deployment environment and provides centralized log management.

## Features

- **Environment-aware**: Automatically shows all logs in development, only warnings/errors in production
- **Service-specific loggers**: Each service gets its own labeled logger
- **Console interception**: Intercepts all console.log/error/warn calls
- **Configurable log levels**: Can be overridden via localStorage or UI controller
- **Production-safe**: Debug messages are suppressed in production builds

## Log Levels

- `ERROR` (0): Critical errors only
- `WARN` (1): Warnings and errors
- `INFO` (2): General information, warnings, and errors
- `DEBUG` (3): All messages including verbose debugging

## Default Behavior

- **Development**: `DEBUG` level (shows everything)
- **Production**: `WARN` level (shows warnings and errors only)

## Usage in Components

```jsx
import { useLogger } from '../context/LoggerProvider.jsx';

function MyComponent() {
  const logger = useLogger('ComponentName');

  logger.debug('This will only show in development');
  logger.info('General information');
  logger.warn('Warning message');
  logger.error('Error message');

  return <div>...</div>;
}
```

## Usage in Services

```javascript
import { logger } from '../context/LoggerProvider.jsx';

// Create service-specific logger
const serviceLogger = logger.createServiceLogger('ServiceName');

class MyService {
  doSomething() {
    serviceLogger.debug('Processing...');
    serviceLogger.info('Operation completed');
  }
}
```

## Manual Log Level Control

### Via localStorage (Persists across sessions)
```javascript
// Set log level manually
localStorage.setItem('debug-log-level', '3'); // DEBUG level
localStorage.setItem('debug-log-level', '1'); // WARN level
localStorage.removeItem('debug-log-level'); // Use default
```

### Via UI Controller (Development only)
A small dropdown appears in the top-right corner during development to change log levels in real-time.

### Via Code
```javascript
import { logger, LogLevel } from '../context/LoggerProvider.jsx';

logger.setLogLevel(LogLevel.DEBUG);
```

## Benefits

1. **Clean Production Logs**: No debug clutter in production
2. **Easy Debugging**: Enable verbose logging when needed
3. **Centralized Control**: One place to manage all logging
4. **Service Identification**: Easy to identify which service logged what
5. **No Code Changes**: Existing console.log calls work automatically

## Migration from Manual Debug Flags

**Before:**
```javascript
if (this.debugMode) {
  console.log('Debug message');
}
```

**After:**
```javascript
logger.debug('Debug message');
```

The logging system handles the environment checks automatically!

## Troubleshooting

- If logs aren't showing: Check the log level via the UI controller
- For production debugging: Set `localStorage.setItem('debug-log-level', '3')`
- To disable logging: Set log level to `ERROR` (0)
- To restore console: Call `logger.restore()` (not recommended)
