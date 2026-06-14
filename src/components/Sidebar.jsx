import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Settings,
  BarChart3,
  Calculator,
  TrendingUp,
  Trophy,
  LogOut,
  Menu,
  ChevronRight,
  Calendar,
  BadgeDollarSign,
  User,
} from "lucide-react";
import logoSipakdesa from "../assets/sipakdesa-sleman-app-icon.svg";
import logoSipakdesaSquare from "../assets/sipakdesa-sleman-icon-square.svg";
import { useAuth, USER_ROLES } from "../context/AuthContext";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";

const navigationSections = [
  {
    title: null,
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Master Data",
    items: [
      { to: "/desa", label: "Data Kalurahan", icon: Database },
      { to: "/bpkal", label: "BPKal", icon: BadgeDollarSign },
      { to: "/kriteria", label: "Kriteria & Bobot", icon: Settings },
      { to: "/periods", label: "Periode", icon: Calendar },
    ],
  },
  {
    title: "Engine / Analysis",
    items: [
      { to: "/ahp", label: "Pembobotan Kriteria (AHP)", icon: BarChart3 },
      { to: "/pra-kalkulasi", label: "Alokasi Earmark", icon: Calculator },
      { to: "/moora", label: "Alokasi Kegiatan (MOORA)", icon: TrendingUp },
    ],
  },
  {
    title: "Result",
    items: [
      { to: "/peringkat", label: "Hasil & Peringkat", icon: Trophy },
    ],
  },
  {
    title: "Sistem",
    items: [
      { to: "/pengguna", label: "Profil & Pengguna", icon: User },
    ],
  },
];

export default function Sidebar({ onClose, collapsed = false, onToggleCollapse }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { requestNavigation } = useUnsavedChanges();

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const handleNavigate = (to) => {
    requestNavigation(to, () => {
      navigate(to);
      handleNavClick();
    });
  };

  const isActivePath = (to) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <aside
      className={`relative box-border h-full bg-gradient-to-b from-[#1a2847] via-[#1e3559] to-[#234166] flex flex-col shadow-2xl rounded-tr-3xl rounded-br-3xl flex-shrink-0 lg:overflow-visible overflow-hidden transition-all duration-300 ease-out ${
        collapsed ? "w-64 lg:w-20" : "w-64 lg:w-72"
      }`}
    >
      <div className={`p-4 ${collapsed ? "lg:px-2 lg:py-3" : "lg:p-6"} flex flex-col h-full ${collapsed ? "lg:items-center" : ""}`}>
        {/* expand button moved to layout to avoid overflow */}
        <div className={`w-full flex items-center justify-center lg:justify-between text-white ${collapsed ? "mb-6" : "mb-8 lg:mb-10"}`}>
          {!collapsed ? (
            <div className="bg-white rounded-xl py-2.5 px-4 shadow-lg flex-shrink-0 flex items-center justify-center w-48">
              <img src={logoSipakdesa} alt="Logo SPK" className="w-full h-auto logo-animate" />
            </div>
          ) : (
            <div className="bg-white rounded-xl p-2 flex-shrink-0 shadow-lg">
              <img src={logoSipakdesaSquare} alt="Logo SPK" className="w-8 h-8 logo-animate" />
            </div>
          )}

          {!collapsed && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/40"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              <Menu size={16} />
            </button>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto pr-1 ${collapsed ? "space-y-3" : "space-y-5 lg:space-y-6"}`}>
          {navigationSections
            .filter((section) => {
              if (section.title === "Sistem") {
                return currentUser?.role === USER_ROLES.SUPER_ADMIN;
              }
              return true;
            })
            .map((section) => (
            <div key={section.title ?? "dashboard"} className="space-y-2">
              {section.title && (
                <div className="px-3 lg:px-4 text-[10px] lg:text-[11px] uppercase tracking-[0.18em] text-white/50 font-semibold">
                  <span className={collapsed ? "lg:hidden" : ""}>{section.title}</span>
                </div>
              )}

              <div className="space-y-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(item.to);

                  return (
                    <div key={item.to} className="relative">
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.to)}
                        title={collapsed ? item.label : undefined}
                        aria-label={item.label}
                        className={`w-full flex items-center text-left rounded-xl transition-all duration-200 font-medium ${
                          collapsed ? "lg:justify-center lg:px-2 lg:py-3 gap-3 px-3 py-2.5" : "gap-3 lg:gap-4 px-3 lg:px-4 py-2.5 lg:py-3"
                        } ${active ? "bg-white text-[#1a2847] shadow-lg" : "text-white/90 hover:bg-white/15"} focus:outline-none focus:ring-2 focus:ring-white/30`}
                      >
                        <Icon size={20} className="flex-shrink-0" />
                        <span className={`${collapsed ? "lg:hidden" : ""} text-sm lg:text-base text-left`}>{item.label}</span>
                      </button>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative">
          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={`mt-3 flex items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition text-sm lg:text-base ${
              collapsed ? "w-full lg:w-12 lg:h-12 justify-center lg:self-center gap-2 px-3 py-2.5" : "w-full justify-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3"
            }`}
          >
            <LogOut size={16} />
            <span className={collapsed ? "lg:hidden" : ""}>Logout</span>
          </button>

        </div>

        <div className={`border-t border-white/20 pt-3 lg:pt-4 text-[10px] lg:text-xs text-white/70 mt-4 lg:mt-6 ${collapsed ? "lg:hidden" : ""}`}>
          <p className="font-semibold">Dinas Pemberdayaan Masyarakat dan Kalurahan Kabupaten Sleman</p>
          <p className="mt-1">Sistem Pendukung Keputusan Prioritas Alokasi Dana Desa</p>
        </div>
      </div>
    </aside>
  );
}