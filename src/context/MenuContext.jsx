/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";

const MenuContext = createContext();

export function MenuProvider({ children }) {
  const location = useLocation();
  const path = location.pathname;
  const activeMenu = path === "/"
    ? "dashboard"
    : path.startsWith("/desa")
      ? "desa"
      : path.startsWith("/kriteria")
        ? "kriteria"
        : path.startsWith("/ahp")
          ? "ahp"
          : path.startsWith("/moora")
            ? "moora"
            : path.startsWith("/peringkat")
              ? "peringkat"
              : "dashboard";

  return (
    <MenuContext.Provider value={{ activeMenu }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useActiveMenu() {
  return useContext(MenuContext);
}
