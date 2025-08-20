import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Toast, ToastContainer } from "react-bootstrap";

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);



  const showNotification = useCallback((message, type = "info", duration = 5000) => {
    // Log to console for debugging
    console.log(`[Notification] ${type}: ${message}`);
    // Increase duration for warnings/errors
    let effectiveDuration = duration;
    if (type === "danger" || type === "warning") {
      effectiveDuration = Math.max(duration, 10000);
    }
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, effectiveDuration);
  }, []);

  const contextValue = {
    showSuccess: (msg, duration) => showNotification(msg, "success", duration),
    showError: (msg, duration) => showNotification(msg, "danger", duration),
    showWarning: (msg, duration) => showNotification(msg, "warning", duration),
    showInfo: (msg, duration) => showNotification(msg, "info", duration),
  };

  useEffect(() => {
    const handleNotification = (event) => {
      const { message, type, duration } = event.detail;
      showNotification(message, type, duration);
    };

    window.addEventListener("notification", handleNotification);
    return () => {
      window.removeEventListener("notification", handleNotification);
    };
  }, [showNotification]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 9999 }}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            bg={toast.type}
            show={true}
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            delay={toast.type === "danger" || toast.type === "warning" ? 10000 : 5000}
            autohide
          >
            <Toast.Header closeButton onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}>
              <i className={`bi me-2 ${
                toast.type === "success" ? "bi-check-circle-fill" :
                toast.type === "danger" ? "bi-exclamation-triangle-fill" :
                toast.type === "warning" ? "bi-exclamation-triangle-fill" :
                "bi-info-circle-fill"
              }`}></i>
              <strong className="me-auto">Notification</strong>
            </Toast.Header>
            <Toast.Body className={toast.type === "warning" || toast.type === "info" ? "text-dark" : "text-white"}>
              {toast.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </NotificationContext.Provider>
  );
}