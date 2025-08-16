import React, { createContext, useContext, useEffect } from 'react';

/**
 * Log levels for filtering
 */
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

/**
 * Logger configuration
 */
class Logger {
  constructor() {
    this.level = this.getLogLevel();
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };
    this.setupConsoleInterception();
  }

  /**
   * Determine log level based on environment
   */
  getLogLevel() {
    // Check if we're in development mode
    const isDevelopment = (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.port === "3000" ||
      process.env.NODE_ENV === "development"
    );

    // Allow override via localStorage for debugging in production
    const override = localStorage.getItem('debug-log-level');
    if (override) {
      return parseInt(override, 10);
    }

    return isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  /**
   * Set up console interception to filter messages
   */
  setupConsoleInterception() {
    // Override console methods
    console.log = (...args) => this.log(LogLevel.INFO, ...args);
    console.info = (...args) => this.log(LogLevel.INFO, ...args);
    console.warn = (...args) => this.log(LogLevel.WARN, ...args);
    console.error = (...args) => this.log(LogLevel.ERROR, ...args);
    console.debug = (...args) => this.log(LogLevel.DEBUG, ...args);
  }

  /**
   * Log a message if it meets the current log level
   */
  log(level, ...args) {
    if (level <= this.level) {
      const method = this.getConsoleMethod(level);
      const timestamp = new Date().toISOString();
      const levelName = this.getLevelName(level);

      // Add timestamp and level prefix
      method(`[${timestamp}] [${levelName}]`, ...args);
    }
  }

  /**
   * Get the appropriate console method for a log level
   */
  getConsoleMethod(level) {
    switch (level) {
      case LogLevel.ERROR:
        return this.originalConsole.error;
      case LogLevel.WARN:
        return this.originalConsole.warn;
      case LogLevel.INFO:
        return this.originalConsole.info;
      case LogLevel.DEBUG:
        return this.originalConsole.debug;
      default:
        return this.originalConsole.log;
    }
  }

  /**
   * Get human-readable level name
   */
  getLevelName(level) {
    switch (level) {
      case LogLevel.ERROR:
        return 'ERROR';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.DEBUG:
        return 'DEBUG';
      default:
        return 'LOG';
    }
  }

  /**
   * Set log level programmatically
   */
  setLogLevel(level) {
    this.level = level;
    localStorage.setItem('debug-log-level', level.toString());
  }

  /**
   * Create service-specific logger
   */
  createServiceLogger(serviceName) {
    return {
      error: (...args) => this.log(LogLevel.ERROR, `[${serviceName}]`, ...args),
      warn: (...args) => this.log(LogLevel.WARN, `[${serviceName}]`, ...args),
      info: (...args) => this.log(LogLevel.INFO, `[${serviceName}]`, ...args),
      debug: (...args) => this.log(LogLevel.DEBUG, `[${serviceName}]`, ...args),
    };
  }

  /**
   * Restore original console methods
   */
  restore() {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }
}

// Create global logger instance
const globalLogger = new Logger();

// Create React context for logger
const LoggerContext = createContext(globalLogger);

/**
 * Logger Provider component
 */
export function LoggerProvider({ children }) {
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      globalLogger.restore();
    };
  }, []);

  return (
    <LoggerContext.Provider value={globalLogger}>
      {children}
    </LoggerContext.Provider>
  );
}

/**
 * Hook to use logger in components
 */
export function useLogger(serviceName = null) {
  const logger = useContext(LoggerContext);

  if (serviceName) {
    return logger.createServiceLogger(serviceName);
  }

  return logger;
}

/**
 * Export logger instance for use in non-React code
 */
export { globalLogger as logger };
export default globalLogger;
