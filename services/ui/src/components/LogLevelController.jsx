import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { useLogger, LogLevel } from '../providers/LoggerProvider.jsx';

const LOG_LEVELS = [
  { value: LogLevel.ERROR, label: 'Error' },
  { value: LogLevel.WARN, label: 'Warn' },
  { value: LogLevel.INFO, label: 'Info' },
  { value: LogLevel.DEBUG, label: 'Debug' },
];

/**
 * Development-only log level selector rendered as a dropdown submenu.
 * Intended for use inside the user profile dropdown menu.
 */
export function LogLevelController() {
  const logger = useLogger();

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const currentLevel = logger.level;
  const currentLabel = LOG_LEVELS.find(l => l.value === currentLevel)?.label || 'Info';

  return (
    <Dropdown as="div" drop="start" className="log-level-submenu">
      <Dropdown.Toggle
        as="button"
        className="dropdown-item d-flex align-items-center w-100"
      >
        <i className="bi bi-bug me-2"></i>
        Log Level
        <span className="badge bg-secondary ms-auto">{currentLabel}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {LOG_LEVELS.map(({ value, label }) => (
          <Dropdown.Item
            key={value}
            active={currentLevel === value}
            onClick={() => {
              logger.setLogLevel(value);
              console.info('Log level changed to:', label);
            }}
          >
            {label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default LogLevelController;
