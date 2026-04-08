import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Toast, ToastContainer } from "react-bootstrap";
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
      notificationsApi.create({
        title: 'Notification',
        message,
        category,
        detail: details || null,
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

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastContainer position="top-center" className="p-3" style={{ zIndex: 9999 }}>
        {toasts.map((toast) => {
          const defaultIcon = toast.type === "success" ? "bi-check-circle-fill" :
                             toast.type === "danger" ? "bi-exclamation-triangle-fill" :
                             toast.type === "warning" ? "bi-exclamation-triangle-fill" :
                             "bi-info-circle-fill";

          const iconClass = getErrorIcon(toast.errorType, defaultIcon);

          return (
            <Toast
              key={toast.id}
              bg={toast.type}
              show={true}
              onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              delay={toast.type === "danger" || toast.type === "warning" ? 5000 : 3000}
              autohide
            >
              <Toast.Header closeButton onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>
                <i className={`bi me-2 ${iconClass}`}></i>
                <strong className="me-auto">Notification</strong>
              </Toast.Header>
              <Toast.Body className={toast.type === "warning" || toast.type === "info" ? "text-dark" : "text-white"}>
                {toast.message}
                {toast.details && (
                  <div className="mt-2">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        // Create a modal or detailed view for error details
                        console.log('Error details:', toast.details);
                        // For now, just log to console - could implement a modal later
                      }}
                    >
                      <i className="bi bi-info-circle me-1"></i>
                      Show Details
                    </button>
                  </div>
                )}
              </Toast.Body>
            </Toast>
          );
        })}
      </ToastContainer>
    </NotificationContext.Provider>
  );
}