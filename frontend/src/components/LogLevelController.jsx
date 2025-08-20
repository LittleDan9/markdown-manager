import React from 'react';
import { useLogger, LogLevel } from '../providers/LoggerProvider.jsx';

/**
 * Development-only component for managing log levels
 */
export function LogLevelController() {
  const logger = useLogger();

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleLogLevelChange = (event) => {
    const newLevel = parseInt(event.target.value, 10);
    logger.setLogLevel(newLevel);
    console.info('Log level changed to:', event.target.options[event.target.selectedIndex].text);
  };

  const currentLevel = logger.level;

  return (
    <div
      className="position-fixed bg-body border rounded p-2"
      style={{
        top: '10px',
        right: '10px',
        zIndex: 9999,
        fontSize: '0.75rem',
        fontFamily: 'monospace'
      }}
    >
      <label htmlFor="log-level-select" className="form-label me-2 mb-0 text-body-secondary">
        Debug Level:
      </label>
      <select
        id="log-level-select"
        className="form-select form-select-sm"
        value={currentLevel}
        onChange={handleLogLevelChange}
        style={{ fontSize: '0.75rem', width: 'auto', display: 'inline-block' }}
      >
        <option value={LogLevel.ERROR}>ERROR</option>
        <option value={LogLevel.WARN}>WARN</option>
        <option value={LogLevel.INFO}>INFO</option>
        <option value={LogLevel.DEBUG}>DEBUG</option>
      </select>
    </div>
  );
}

export default LogLevelController;
