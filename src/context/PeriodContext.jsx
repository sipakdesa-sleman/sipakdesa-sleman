/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAllPeriods } from "../services/periodService";

const PeriodContext = createContext();

export function PeriodProvider({ children }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriodState] = useState(() => {
    return localStorage.getItem("sipakdesa:selectedPeriod") || "";
  });
  const [loading, setLoading] = useState(true);
 
  const refreshPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const sorted = await getAllPeriods();
      setPeriods(sorted);
 
      const active = sorted.find(p => p.isActive === true || p.active === true);
      const activeIdStr = active ? String(active.id) : "";
      
      setSelectedPeriodState(current => {
        const storedLastActive = localStorage.getItem("sipakdesa:lastActivePeriodId") || "";
        const activeChanged = activeIdStr && activeIdStr !== storedLastActive;
        
        // Prioritaskan set default ke periode aktif jika baru diubah, 
        // atau jika belum ada pilihan saat ini, atau jika pilihan saat ini tidak valid lagi
        if (activeChanged || !current || !sorted.some(p => String(p.id) === String(current))) {
          if (active) {
            localStorage.setItem("sipakdesa:selectedPeriod", activeIdStr);
            localStorage.setItem("sipakdesa:lastActivePeriodId", activeIdStr);
            return activeIdStr;
          } else {
            localStorage.removeItem("sipakdesa:selectedPeriod");
            return "";
          }
        }
        
        // Tetap simpan lastActivePeriodId terbaru di localStorage
        if (activeIdStr && activeIdStr !== storedLastActive) {
          localStorage.setItem("sipakdesa:lastActivePeriodId", activeIdStr);
        }
        
        return current;
      });
    } catch (e) {
      console.error("Gagal memuat periode di PeriodContext:", e);
    } finally {
      setLoading(false);
    }
  }, []);
 
  useEffect(() => {
    refreshPeriods();
  }, [refreshPeriods]);

  const setSelectedPeriod = useCallback((id) => {
    const idStr = id ? String(id) : "";
    setSelectedPeriodState(idStr);
    if (idStr) {
      localStorage.setItem("sipakdesa:selectedPeriod", idStr);
    } else {
      localStorage.removeItem("sipakdesa:selectedPeriod");
    }
  }, []);

  const activePeriod = periods.find(p => p.isActive === true || p.active === true) || null;

  return (
    <PeriodContext.Provider value={{
      periods,
      selectedPeriod,
      setSelectedPeriod,
      activePeriod,
      refreshPeriods,
      loading
    }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const context = useContext(PeriodContext);
  if (!context) {
    throw new Error("usePeriod harus digunakan di dalam PeriodProvider");
  }
  return context;
}
