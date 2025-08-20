import React from 'react';

/**
 * Progress indicator component for spell checking
 * @param {Object} progress - Progress object with percentComplete property
 */
const ProgressIndicator = ({ progress }) => {
  if (!progress) return null;

  return (
    <div
      className="alert alert-info"
      style={{
        position: "absolute",
        bottom: "10px",
        right: "10px",
        zIndex: 1000,
        maxWidth: "250px",
        fontSize: "12px",
        padding: "8px 12px"
      }}
    >
      <div className="d-flex align-items-center">
        <div className="spinner-border spinner-border-sm me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <div>
          <div>Spell Checking Document</div>
          <div className="progress mt-1" style={{ height: "4px" }}>
            <div
              className="progress-bar"
              style={{ width: `${progress.percentComplete}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
