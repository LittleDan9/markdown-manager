import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import notificationsApi from "@/api/notificationsApi";

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

// Map toast variant types to backend notification categories
const TOAST_TYPE_TO_CATEGORY = {
  danger: 'error',
  warning: 'warning',
  success: 'success',
  info: 'info',
};

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);



  const showNotification = useCallback((message, type = "info", duration = 3000, details = null, errorType = null, { persist } = {}) => {
    // Log to console for debugging
    console.log(`[Notification] ${type}: ${message}`);
    // Shorter durations now that important toasts persist to notification drawer
    let effectiveDuration = duration;
    if (type === "danger" || type === "warning") {
      effectiveDuration = Math.max(duration, 5000);
    }
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, details, errorType }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, effectiveDuration);

    // Bridge to persistent notification system:
    // By default, persist danger/warning toasts. Callers can override with persist flag.
    const shouldPersist = persist !== undefined ? persist : (type === "danger" || type === "warning");
    if (shouldPersist) {
      const category = TOAST_TYPE_TO_CATEGORY[type] || 'info';
      const safeDetail = details != null
        ? (typeof details === 'string' ? details : JSON.stringify(details))
        : null;
      notificationsApi.create({
        title: 'Notification',
        message,
        category,
        detail: safeDetail,
      }).then(() => {
        // Signal useNotifications to refresh immediately
        window.dispatchEvent(new CustomEvent('notification-created'));
      }).catch(() => {
        // Fire-and-forget — don't disrupt UX if persist fails
      });
    }
  }, []);

  const contextValue = useMemo(() => ({
    showSuccess: (msg, duration, opts) => showNotification(msg, "success", duration, null, null, opts),
    showError: (msg, duration, details, errorType, opts) => showNotification(msg, "danger", duration, details, errorType, opts),
    showWarning: (msg, duration, details, errorType, opts) => showNotification(msg, "warning", duration, details, errorType, opts),
    showInfo: (msg, duration, opts) => showNotification(msg, "info", duration, null, null, opts),
  }), [showNotification]);

  useEffect(() => {
    const handleNotification = (event) => {
      const { message, type, duration, details, errorType } = event.detail;
      showNotification(message, type, duration, details, errorType);
    };

    window.addEventListener("notification", handleNotification);
    return () => {
      window.removeEventListener("notification", handleNotification);
    };
  }, [showNotification]);

  const getErrorIcon = (errorType, defaultIcon) => {
    switch (errorType) {
      case 'network':
        return 'bi-wifi-off';
      case 'system':
        return 'bi-bug-fill';
      case 'git':
        return 'bi-git';
      default:
        return defaultIcon;
    }
  };

  const getSnackbarVariant = (type) => {
    switch (type) {
      case 'success': return 'snackbar--success';
      case 'danger': return 'snackbar--error';
      case 'warning': return 'snackbar--warning';
      default: return 'snackbar--info';
    }
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <div className="snackbar-container">
        {toasts.map((toast) => {
          const defaultIcon = toast.type === "success" ? "bi-check-circle-fill" :
                             toast.type === "danger" ? "bi-exclamation-triangle-fill" :
                             toast.type === "warning" ? "bi-exclamation-triangle-fill" :
                             "bi-info-circle-fill";

          const iconClass = getErrorIcon(toast.errorType, defaultIcon);

          return (
            <div
              key={toast.id}
              className={`snackbar ${getSnackbarVariant(toast.type)}`}
              role="alert"
            >
              <span className="snackbar-accent" />
              <i className={`bi ${iconClass} snackbar-icon`} />
              <span className="snackbar-message">{toast.message}</span>
              <button
                className="snackbar-dismiss"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                aria-label="Dismiss"
              >
                <i className="bi bi-x" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}