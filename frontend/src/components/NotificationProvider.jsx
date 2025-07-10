import React, { createContext, useContext, useState, useCallback } from "react";
import { Toast, ToastContainer } from "react-bootstrap";

const NotificationContext = createContext();

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showNotification = useCallback((message, type = "info", duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const contextValue = {
    showSuccess: (msg, duration) => showNotification(msg, "success", duration),
    showError: (msg, duration) => showNotification(msg, "danger", duration),
    showWarning: (msg, duration) => showNotification(msg, "warning", duration),
    showInfo: (msg, duration) => showNotification(msg, "info", duration),
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 1060 }}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            bg={toast.type}
            show={true}
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            delay={5000}
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
            <Toast.Body className={toast.type === "warning" ? "text-dark" : "text-white"}>
              {toast.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </NotificationContext.Provider>
  );
}