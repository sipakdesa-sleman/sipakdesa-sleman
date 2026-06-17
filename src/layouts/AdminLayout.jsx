import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth, USER_ROLES } from "../context/AuthContext";
import { User, LogOut, Shield, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";

export default function AdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [openProfile, setOpenProfile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const popoverRef = useRef(null);
  const { prompt, confirmNavigation, cancelNavigation } = useUnsavedChanges();

  const initials = currentUser?.email
    ? currentUser.email.slice(0, 2).toUpperCase()
    : "SP";

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setOpenProfile(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function onKey(e) {
      // Ctrl+B to toggle sidebar collapsed on desktop
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleAutoLogout, 15 * 60 * 1000); // 15 Menit
    };

    const handleAutoLogout = async () => {
      console.warn("Sesi berakhir karena tidak ada aktivitas selama 15 menit.");
      try {
        await logout();
        navigate("/login", { replace: true });
      } catch (err) {
        console.error("Auto logout error:", err);
      }
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [currentUser, logout, navigate]);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-purple-50 via-blue-50 to-purple-100 p-2 lg:p-2.5 lg:pl-0 overflow-x-hidden">
      <div className="flex flex-1 h-full relative lg:pl-2.5 overflow-hidden">
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - hidden on mobile, slide in when open */}
        <div className={`fixed lg:relative inset-y-0 left-0 z-50 h-full transform transition-transform duration-300 lg:transform-none ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <Sidebar
            onClose={() => setMobileMenuOpen(false)}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />
        </div>

        {/* Desktop toggle button (placed in header to avoid overflow) */}

        <main className={`flex-1 flex flex-col h-full bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden ml-0 ${
          sidebarCollapsed ? "lg:ml-1.5" : "lg:ml-2"
        }`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a2847] via-[#1e3559] to-[#234166] backdrop-blur px-4 md:px-5 py-2 md:py-2.5 flex items-center justify-between shadow-lg relative z-30" ref={popoverRef}>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/20 transition text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

              {/* Desktop: toggle sidebar (non-absolute, avoids horizontal overflow) */}
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  className="hidden lg:inline-flex ml-2 p-2 rounded-lg hover:bg-white/10 transition text-white"
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-expanded={!sidebarCollapsed}
                >
                  <ChevronRight size={20} />
                </button>
              )}

              {/* Sidebar collapse controlled inside Sidebar component */}

            {/* Spacer for desktop to push profile to right */}
            <div className="flex-1 hidden lg:block" />

            {/* Profile Button */}
            <button
              onClick={() => setOpenProfile((prev) => !prev)}
              className="flex items-center gap-1.5 md:gap-2 bg-white/10 border border-white/30 rounded-full px-2 md:px-2.5 py-1 md:py-1.5 hover:bg-white/20 transition backdrop-blur"
            >
              <div className="text-right hidden sm:block">
                <p className="text-[11px] md:text-xs font-semibold text-white">{currentUser?.email || "Administrator"}</p>
                <p className="text-[9px] md:text-[10px] text-blue-100">
                  {currentUser?.role === USER_ROLES.SUPER_ADMIN ? "Super Admin" : "Admin"}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center text-white font-bold text-[11px] md:text-xs border-2 border-white/40">
                {initials}
              </div>
              <User size={14} className="text-white/80 hidden sm:block" />
            </button>

            {openProfile && (
              <div className="absolute right-2 md:right-8 top-16 md:top-20 w-64 md:w-72 bg-gradient-to-b from-[#1a2847] via-[#1e3559] to-[#234166] text-white rounded-xl shadow-2xl border border-blue-400/20 p-4 z-[100]">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm border-2 border-white/30 flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{currentUser?.name || "Pengguna"}</p>
                    <p className="text-xs text-white/70 truncate">{currentUser?.email || ""}</p>
                    <p className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full inline-block mt-1 font-semibold">
                      Role: {currentUser?.role === USER_ROLES.SUPER_ADMIN ? "Super Admin" : "Admin"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setOpenProfile(false);
                    navigate("/pengguna");
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium shadow-md"
                >
                  <User size={16} />
                  Pengaturan Akun
                </button>

                <button
                  onClick={handleLogout}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/90 text-red-600 hover:bg-white transition text-sm font-medium shadow-md"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 bg-white p-3 md:p-4 lg:p-5 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={!!prompt}
        title="Perubahan belum disimpan"
        message="Anda memiliki perubahan yang belum disimpan. Jika Anda meninggalkan halaman ini, draft perhitungan akan hilang. Apakah Anda yakin?"
        confirmLabel="Tinggalkan"
        cancelLabel="Tetap di halaman"
        variant="warning"
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </div>
  );
}