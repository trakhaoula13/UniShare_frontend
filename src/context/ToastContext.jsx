import React, { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../components/Icon";

const ToastContext = createContext(null);

const ICONS = {
  success: "check-circle-fill",
  error: "x-circle-fill",
  info: "info-circle-fill",
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // type: "success" | "error" | "info". action: { label, onClick } optionnel
  // (utilise pour l'annulation de suppression, voir useUndoDelete).
  const showToast = useCallback((message, { type = "success", duration = 4000, action } = {}) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, action }]);
    if (!action) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="toast-stack">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast show app-toast app-toast-${t.type}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              role="alert"
            >
              <div className="toast-body d-flex align-items-center gap-2">
                <Icon name={ICONS[t.type]} />
                <span className="flex-grow-1">{t.message}</span>
                {t.action && (
                  <button
                    className="btn btn-sm btn-toast-action"
                    onClick={() => {
                      t.action.onClick();
                      removeToast(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button className="btn-close btn-close-white ms-1" onClick={() => removeToast(t.id)} aria-label="Fermer"></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
