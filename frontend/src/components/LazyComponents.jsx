/**
 * Lazy-loaded component definitions
 * Central registry for code-split components with loading fallbacks
 */
import React, { lazy, Suspense } from 'react';
import { Spinner } from 'react-bootstrap';

// Loading fallback component
const ComponentLoader = ({ text = "Loading..." }) => (
  <div className="d-flex justify-content-center align-items-center p-4">
    <Spinner animation="border" size="sm" className="me-2" />
    <span>{text}</span>
  </div>
);

// Lazy-loaded components
export const LazyIconBrowser = lazy(() =>
  import('./IconBrowser.jsx').then(module => ({
    default: module.default
  }))
);

export const LazySettingsModal = lazy(() =>
  import('./modals/UserSettingsModal.jsx')
);

export const LazyBackupCodesSection = lazy(() =>
  import('./modals/BackupCodesSection.jsx')
);

export const LazyLogLevelController = lazy(() =>
  import('./LogLevelController.jsx')
);

// HOC for wrapping lazy components with Suspense
export const withLazyLoading = (LazyComponent, loadingText) => {
  const WrappedComponent = (props) => (
    <Suspense fallback={<ComponentLoader text={loadingText} />}>
      <LazyComponent {...props} />
    </Suspense>
  );

  WrappedComponent.displayName = `Lazy(${LazyComponent.displayName || LazyComponent.name})`;
  return WrappedComponent;
};

// Pre-wrapped components ready to use
export const IconBrowser = withLazyLoading(LazyIconBrowser, "Loading Icon Browser...");
export const SettingsModal = withLazyLoading(LazySettingsModal, "Loading Settings...");
export const BackupCodesSection = withLazyLoading(LazyBackupCodesSection, "Loading Backup Codes...");
export const LogLevelController = withLazyLoading(LazyLogLevelController, "Loading Controls...");
