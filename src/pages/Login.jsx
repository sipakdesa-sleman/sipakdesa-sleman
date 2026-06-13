import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoSipakdesa from "../assets/logo-sipakdesa-blue.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, sendForgotPasswordLink } = useAuth();
  const navigate = useNavigate();

  // State Lupa Password
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleResetSubmit(e) {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);

    try {
      await sendForgotPasswordLink(resetEmail);
      setResetSuccess(`Tautan reset kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau spam.`);
      setResetEmail("");
    } catch (err) {
      console.error("Forgot password error:", err);
      if (err.message === "email-not-registered") {
        setResetError("Email tidak terdaftar sebagai pengguna SIPAKDESA.");
      } else if (err.message === "user-suspended") {
        setResetError("Akun dengan email ini telah ditangguhkan. Silakan hubungi Super Admin.");
      } else {
        setResetError("Gagal mengirim link reset kata sandi. Periksa kembali email Anda.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setError("");
      setLoading(true);
      await login(email, password);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      if (err.message === "suspended") {
        setError("Akun Anda telah dinonaktifkan oleh administrator.");
      } else {
        setError("Gagal login. Periksa email dan password Anda.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-purple-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-gray-200">
        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-br from-[#1a2847] to-[#234166] rounded-2xl p-4 mb-4 shadow-lg">
            <img src={logoSipakdesa} alt="Logo" className="w-20 h-20" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Selamat Datang</h1>
          <p className="text-sm text-gray-600 mt-2 text-center">
            SPK Prioritas Alokasi Dana Desa Sleman
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1a2847] focus:border-transparent outline-none transition"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1a2847] focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
            <div className="text-right mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setResetEmail("");
                  setResetError("");
                  setResetSuccess("");
                  setIsResetModalOpen(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
              >
                Lupa Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#1a2847] to-[#234166] text-white font-semibold py-3 rounded-xl hover:from-[#0f1829] hover:to-[#1a2847] transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          Kabupaten Sleman © 2026
        </p>
      </div>

      {/* Modal Lupa Password */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Pemulihan Kata Sandi</h3>
              <button 
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Masukkan email instansi terdaftar Anda. Tautan untuk menyetel ulang kata sandi Anda akan dikirim jika email terdaftar dan aktif.
            </p>

            {resetError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 mb-4 text-xs font-semibold">
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 mb-4 text-xs font-semibold">
                {resetSuccess}
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Email Terdaftar
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-[#1a2847] hover:bg-[#0f1829] text-white rounded-lg inline-flex items-center gap-2 text-sm font-semibold transition disabled:opacity-50"
                >
                  {resetLoading ? "Memverifikasi..." : "Kirim Tautan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
