import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Toast, ToastContainer } from "react-bootstrap";

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);



  const showNotification = useCallback((message, type = "info", duration = 5000, details = null, errorType = null) => {
    // Log to console for debugging
    console.log(`[Notification] ${type}: ${message}`);
    // Increase duration for warnings/errors
    let effectiveDuration = duration;
    if (type === "danger" || type === "warning") {
      effectiveDuration = Math.max(duration, 10000);
    }
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, details, errorType }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, effectiveDuration);
  }, []);

  const contextValue = useMemo(() => ({
    showSuccess: (msg, duration) => showNotification(msg, "success", duration),
    showError: (msg, duration, details, errorType) => showNotification(msg, "danger", duration, details, errorType),
    showWarning: (msg, duration, details, errorType) => showNotification(msg, "warning", duration, details, errorType),
    showInfo: (msg, duration) => showNotification(msg, "info", duration),
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
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 9999 }}>
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
              delay={toast.type === "danger" || toast.type === "warning" ? 10000 : 5000}
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