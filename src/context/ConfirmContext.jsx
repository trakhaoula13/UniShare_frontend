import React, { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../components/Icon";

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null); // { message, resolve }

  // Retourne une Promise<boolean> -- usage : const ok = await confirm("...")
  const confirm = useCallback((message, { title = "Confirmer", danger = true } = {}) => {
    return new Promise((resolve) => {
      setDialog({ message, title, danger, resolve });
    });
  }, []);

  const handleClose = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {dialog && (
          <motion.div
            className="custom-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => handleClose(false)}
          >
            <motion.div
              className="custom-modal confirm-modal"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`confirm-icon ${dialog.danger ? "confirm-icon-danger" : "confirm-icon-info"}`}>
                <Icon name={dialog.danger ? "exclamation-triangle-fill" : "question-circle-fill"} size={24} />
              </div>
              <h5 className="fw-bold text-center mb-2">{dialog.title}</h5>
              <p className="text-muted text-center mb-4">{dialog.message}</p>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary flex-grow-1" onClick={() => handleClose(false)}>
                  Annuler
                </button>
                <button
                  className={`btn flex-grow-1 ${dialog.danger ? "btn-danger" : "btn-primary"}`}
                  onClick={() => handleClose(true)}
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
