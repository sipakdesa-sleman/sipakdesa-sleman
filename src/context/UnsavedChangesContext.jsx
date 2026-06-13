/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const UnsavedChangesContext = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const [isDirty, setIsDirty] = useState(false);
  const [prompt, setPrompt] = useState(null);

  const clearDirty = useCallback(() => {
    setIsDirty(false);
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const requestNavigation = useCallback(
    (nextPath, onConfirm) => {
      if (!isDirty) {
        onConfirm?.();
        return true;
      }

      setPrompt({ nextPath, onConfirm });
      return false;
    },
    [isDirty]
  );

  const cancelNavigation = useCallback(() => {
    setPrompt(null);
  }, []);

  const confirmNavigation = useCallback(() => {
    const next = prompt?.onConfirm;
    setPrompt(null);
    setIsDirty(false);
    next?.();
  }, [prompt]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const value = useMemo(
    () => ({
      isDirty,
      prompt,
      markDirty,
      clearDirty,
      requestNavigation,
      cancelNavigation,
      confirmNavigation,
    }),
    [isDirty, prompt, markDirty, clearDirty, requestNavigation, cancelNavigation, confirmNavigation]
  );

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return context;
}
