/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import AlertToast from "../components/AlertToast";

const DialogContext = createContext(null);

export function useDialog() {
  return useContext(DialogContext);
}

export default function DialogProvider({ children }) {
  const [confirmState, setConfirmState] = useState({ open: false, resolve: null, title: null, message: null, variant: null });
  const [toasts, setToasts] = useState([]);

  const confirm = useCallback(({ title, message, confirmLabel, cancelLabel, variant } = {}) => {
    return new Promise((resolve) => {
      setConfirmState({ open: true, resolve, title, message, confirmLabel, cancelLabel, variant });
    });
  }, []);

  const alert = useCallback(({ message, type = "info", duration = 5000 } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((s) => [...s, { id, message, type }] );
    // auto dismiss after duration ms
    setTimeout(() => {
      setToasts((s) => s.filter((t) => t.id !== id));
    }, duration);
    return id;
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  const handleCancel = () => {
    if (confirmState.resolve) confirmState.resolve(false);
    setConfirmState({ open: false, resolve: null, title: null, message: null, variant: null });
  };

  const handleConfirm = () => {
    if (confirmState.resolve) confirmState.resolve(true);
    setConfirmState({ open: false, resolve: null, title: null, message: null, variant: null });
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
      <AlertToast toasts={toasts} onClose={closeToast} />
    </DialogContext.Provider>
  );
}
