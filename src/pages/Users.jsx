import { useEffect, useState, useCallback } from "react";
import { useAuth, USER_ROLES } from "../context/AuthContext";
import { useDialog } from "../context/DialogProvider";
import { 
  Key, 
  Users as UsersIcon, 
  UserPlus, 
  UserX, 
  UserCheck, 
  Save, 
  Plus, 
  X, 
  Search,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Mail,
  Calendar,
  Shield,
  User
} from "lucide-react";
import { 
  getAllUsers, 
  registerUser, 
  updateUser, 
  toggleSuspendUser, 
  deleteUser 
} from "../services/userService";


export default function Users() {
  const { currentUser, resetPassword } = useAuth();
  const { alert, confirm } = useDialog();

  // State Reset Password via Email
  const [resetLoading, setResetLoading] = useState(false);

  // State Manajemen Pengguna (Super Admin)
  const [usersList, setUsersList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  
  // State Form Registrasi Baru
  const [regNama, setRegNama] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState(USER_ROLES.ADMIN);
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);

  // State Edit Pengguna (Super Admin)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editNama, setEditNama] = useState("");
  const [editRole, setEditRole] = useState(USER_ROLES.ADMIN);
  const [editLoading, setEditLoading] = useState(false);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const fetchUsers = useCallback(async () => {
    if (currentUser?.role !== USER_ROLES.SUPER_ADMIN) return;
    setListLoading(true);
    try {
      const list = await getAllUsers();
      setUsersList(list);
    } catch (err) {
      console.error("Gagal memuat pengguna:", err);
      alert({ message: "Gagal memuat daftar pengguna.", type: "error" });
    } finally {
      setListLoading(false);
    }
  }, [currentUser, alert]);

  useEffect(() => {
    if (currentUser?.role === USER_ROLES.SUPER_ADMIN) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

  const handleSendResetLink = async () => {
    if (!currentUser?.email) return;
    setResetLoading(true);
    try {
      await resetPassword(currentUser.email);
      alert({ 
        message: `Link reset kata sandi berhasil dikirim ke email Anda (${currentUser.email}). Silakan cek kotak masuk atau folder spam Anda.`, 
        type: "success" 
      });
    } catch (err) {
      console.error("Gagal mengirim link reset password:", err);
      alert({ 
        message: "Gagal mengirim link reset kata sandi. Silakan coba beberapa saat lagi.", 
        type: "error" 
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!regNama || !regEmail || !regPassword || !regRole) {
      alert({ message: "Semua kolom registrasi wajib diisi.", type: "error" });
      return;
    }
    if (regPassword.length < 6) {
      alert({ message: "Password awal minimal 6 karakter.", type: "error" });
      return;
    }

    setRegLoading(true);
    try {
      await registerUser({
        name: regNama,
        email: regEmail,
        password: regPassword,
        role: regRole,
      });

      alert({ message: `Pengguna ${regNama} berhasil terdaftar.`, type: "success" });
      
      // Reset form & reload list
      setRegNama("");
      setRegEmail("");
      setRegPassword("");
      setRegRole(USER_ROLES.ADMIN);
      setIsRegisterModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Pendaftaran gagal:", err);
      let errMsg = "Gagal mendaftarkan pengguna baru.";
      if (err.code === "auth/email-already-in-use" || err.message?.includes("already-in-use") || err.message?.includes("already registered")) {
        errMsg = "Email sudah digunakan oleh akun lain.";
      } else if (err.code === "auth/invalid-email" || err.message?.includes("invalid-email")) {
        errMsg = "Format email tidak valid.";
      } else {
        errMsg = err.message || errMsg;
      }
      alert({ message: errMsg, type: "error" });
    } finally {
      setRegLoading(false);
    }
  };

  const handleToggleSuspend = async (user) => {
    if (!user || !user.uid) return;
    if (user.uid === currentUser?.uid) {
      alert({ message: "Anda tidak dapat menonaktifkan akun Anda sendiri.", type: "error" });
      return;
    }

    const actionText = user.suspended ? "mengaktifkan kembali" : "menonaktifkan";
    const ok = await confirm({
      title: "Konfirmasi Akun",
      message: `Apakah Anda yakin ingin ${actionText} akun ${user.name || user.email}?`,
      confirmLabel: user.suspended ? "Aktifkan" : "Nonaktifkan",
      cancelLabel: "Batal"
    });

    if (!ok) return;

    try {
      await toggleSuspendUser(user.uid, user.suspended);

      alert({ message: `Akun ${user.name} berhasil ${user.suspended ? 'diaktifkan' : 'dinonaktifkan'}.`, type: "success" });
      fetchUsers();
    } catch (err) {
      console.error("Gagal memperbarui status akun:", err);
      alert({ message: "Gagal memperbarui status akun.", type: "error" });
    }
  };

  const handleOpenEdit = (user) => {
    setEditUser(user);
    setEditNama(user.name || "");
    setEditRole(user.role || USER_ROLES.ADMIN);
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editUser || !editNama || !editRole) {
      alert({ message: "Semua kolom edit wajib diisi.", type: "error" });
      return;
    }
    setEditLoading(true);
    try {
      const updateData = {
        name: editNama,
      };
      
      // Jangan ijinkan merubah role akun sendiri demi keamanan
      if (editUser.uid !== currentUser?.uid) {
        updateData.role = editRole;
      }
      
      await updateUser(editUser.uid, updateData);
      
      alert({ message: `Profil ${editNama} berhasil diperbarui.`, type: "success" });
      setIsEditModalOpen(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Gagal memperbarui pengguna:", err);
      alert({ message: "Gagal memperbarui profil pengguna.", type: "error" });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!user || !user.uid) return;
    if (user.uid === currentUser?.uid) {
      alert({ message: "Anda tidak dapat menghapus akun Anda sendiri.", type: "error" });
      return;
    }

    const ok = await confirm({
      title: "Hapus Pengguna",
      message: `Apakah Anda yakin ingin menghapus data profil ${user.name || user.email} dari database?

Catatan: Akun login di Supabase Auth akan tetap ada karena batasan client-side. Anda harus menonaktifkannya (Suspend) jika ingin memblokir akses login secara instan.`,
      confirmLabel: "Hapus Profil",
      cancelLabel: "Batal"
    });

    if (!ok) return;

    try {
      await deleteUser(user.uid);

      alert({ message: `Pengguna ${user.name || user.email} berhasil dihapus dari sistem.`, type: "success" });
      fetchUsers();
    } catch (err) {
      console.error("Gagal menghapus pengguna:", err);
      alert({ message: "Gagal menghapus pengguna.", type: "error" });
    }
  };

  const filteredUsers = usersList.filter(u => 
    (u.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.role || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="page-title">Informasi Profil & Detail Akun</h1>
        <p className="page-subtitle mt-1">
          Pantau rincian kredensial akun Anda serta lakukan pemulihan kata sandi dengan aman.
        </p>
      </div>

      {/* Komponen Atas: Detail Akun */}
      <div className="panel-info rounded-xl max-w-3xl">
        <div className="p-4 border-b border-blue-100 flex items-center gap-2">
          <User className="text-blue-700" size={20} />
          <h2 className="text-base font-bold text-gray-900">Rincian Akun Pengguna</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-gray-100">
            {/* Avatar Badge */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1a2847] to-[#234166] flex items-center justify-center text-white text-2xl font-bold border-4 border-blue-50 shadow-md">
              {currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : "SP"}
            </div>
            
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h3 className="text-xl font-bold text-gray-950">{currentUser?.name || "Pengguna"}</h3>
              <p className="text-sm text-gray-600 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                <Mail size={14} className="text-gray-400" /> {currentUser?.email || "-"}
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                  currentUser?.role === USER_ROLES.SUPER_ADMIN 
                    ? "bg-purple-100 text-purple-800" 
                    : "bg-blue-100 text-blue-800"
                }`}>
                  <Shield size={12} />
                  {currentUser?.role === USER_ROLES.SUPER_ADMIN ? "Super Admin" : "Admin"}
                </span>
                
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                  Aktif
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Lengkap</span>
              <p className="text-sm font-semibold text-gray-950">{currentUser?.name || "-"}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Instansi</span>
              <p className="text-sm font-semibold text-gray-950 font-mono">{currentUser?.email || "-"}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Peran Otoritas</span>
              <p className="text-sm font-semibold text-gray-950">
                {currentUser?.role === USER_ROLES.SUPER_ADMIN ? "Super Admin (Akses Kontrol Penuh)" : "Admin (Akses Operasional)"}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} /> Tanggal Registrasi
              </span>
              <p className="text-sm font-semibold text-gray-950">
                {currentUser?.createdAt ? (
                  currentUser.createdAt.toDate && typeof currentUser.createdAt.toDate === "function"
                    ? currentUser.createdAt.toDate().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                    : new Date(currentUser.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                ) : "-"}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 max-w-md">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Key size={14} className="text-blue-700" /> Keamanan & Reset Kata Sandi
              </h4>
              <p className="text-xs text-gray-500">
                Untuk mengubah kata sandi, sistem akan mengirimkan tautan pemulihan khusus langsung ke alamat email terdaftar Anda.
              </p>
            </div>
            
            <button
              onClick={handleSendResetLink}
              disabled={resetLoading}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mail size={16} />
              {resetLoading ? "Mengirim Tautan..." : "Kirim Link Reset Password"}
            </button>
          </div>
        </div>
      </div>

      {/* Komponen Bawah: Kelola Pengguna (Khusus Super Admin) */}
      {currentUser?.role === USER_ROLES.SUPER_ADMIN && (
        <div className="panel-info rounded-xl">
          <div className="p-4 border-b border-green-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="text-green-700" size={20} />
              <div>
                <h2 className="text-base font-bold text-gray-900">Manajemen Pengguna Sistem</h2>
                <p className="text-xs text-gray-500">Daftarkan akun administrator baru dan kelola status suspensi.</p>
              </div>
            </div>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <UserPlus size={16} /> Registrasi Pengguna Baru
            </button>
          </div>

          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Cari nama, email, atau peran..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            </div>
            <div className="text-xs text-gray-500">
              Menampilkan {paginatedUsers.length} dari {filteredUsers.length} pengguna
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-core">
              <thead className="table-head">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">NO</th>
                  <th className="px-6 py-3 text-left font-medium">NAMA PENGGUNA</th>
                  <th className="px-6 py-3 text-left font-medium">EMAIL</th>
                  <th className="px-6 py-3 text-left font-medium">HAK AKSES / PERAN</th>
                  <th className="px-6 py-3 text-left font-medium">STATUS AKUN</th>
                  <th className="px-6 py-3 text-left font-medium">AKSI KONTROL</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  Array.from({ length: 5 }).map((_, r) => (
                    <tr key={r} className="animate-pulse border-t border-gray-100">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded-md w-6"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded-md w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded-md w-48"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded-md w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded-md w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-8 bg-slate-100 rounded-lg w-36"></div></td>
                    </tr>
                  ))
                ) : paginatedUsers.map((user, idx) => (
                  <tr key={user.id} className="table-row">
                    <td className="px-6 py-4">{startIndex + idx + 1}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{user.name || "-"}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        user.role === USER_ROLES.SUPER_ADMIN 
                          ? "bg-purple-100 text-purple-800" 
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {user.role === USER_ROLES.SUPER_ADMIN ? "Super Admin" : "Admin"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        user.suspended 
                          ? "bg-red-100 text-red-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        {user.suspended ? "Ditangguhkan" : "Aktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                          title="Edit Profil"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        
                        {user.uid !== currentUser?.uid ? (
                          <>
                            <button
                              onClick={() => handleToggleSuspend(user)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                                user.suspended 
                                  ? "bg-green-50 text-green-600 hover:bg-green-100" 
                                  : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                              }`}
                              title={user.suspended ? "Aktifkan Akun" : "Nonaktifkan Akun"}
                            >
                              {user.suspended ? <UserCheck size={13} /> : <UserX size={13} />}
                              {user.suspended ? "Aktifkan" : "Suspend"}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                              title="Hapus Pengguna"
                            >
                              <Trash2 size={13} /> Hapus
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic self-center ml-1">Akun Anda aktif</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && !listLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                      Tidak ada pengguna ditemukan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Halaman {Math.min(page, totalPages)} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`btn-secondary-sm ${page <= 1 ? "cursor-not-allowed opacity-50" : ""}`}
              >
                Previous
              </button>
              <button className="px-3 py-1 text-sm bg-green-600 text-white rounded">
                {Math.min(page, totalPages)}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`btn-secondary-sm ${page >= totalPages ? "cursor-not-allowed opacity-50" : ""}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrasi Pengguna Baru */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:max-w-lg sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Registrasi Pengguna Baru</h3>
            <form onSubmit={handleRegisterUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold">Nama Lengkap</label>
                <input
                  type="text"
                  value={regNama}
                  onChange={(e) => setRegNama(e.target.value)}
                  required
                  placeholder="Nama lengkap admin"
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold">Email Instansi</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  placeholder="admin@sleman.go.id"
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold">Password Awal</label>
                <div className="relative mt-1">
                  <input
                    type={showRegPass ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    placeholder="Min. 6 karakter"
                    className="block w-full border border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass(!showRegPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    {showRegPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold font-semibold">Hak Akses / Peran</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={USER_ROLES.ADMIN}>Admin (Akses Operasional)</option>
                  <option value={USER_ROLES.SUPER_ADMIN}>Super Admin (Akses Kontrol Penuh)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Super Admin dapat mengelola user lain dan melakukan penangguhan akun.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsRegisterModalOpen(false)} 
                  className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={regLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded inline-flex items-center gap-2 text-sm font-medium hover:bg-green-700 transition"
                >
                  {regLoading ? "Mendaftar..." : "Daftarkan Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Pengguna */}
      {isEditModalOpen && editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:max-w-lg sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Profil Pengguna</h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold">Email (Tidak dapat diubah)</label>
                <input
                  type="email"
                  value={editUser.email}
                  disabled
                  className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold">Nama Lengkap</label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  required
                  placeholder="Nama lengkap pengguna"
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 font-semibold">Hak Akses / Peran</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  required
                  disabled={editUser.uid === currentUser?.uid}
                  className={`mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white ${
                    editUser.uid === currentUser?.uid ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
                  }`}
                >
                  <option value={USER_ROLES.ADMIN}>Admin (Akses Operasional)</option>
                  <option value={USER_ROLES.SUPER_ADMIN}>Super Admin (Akses Kontrol Penuh)</option>
                </select>
                {editUser.uid === currentUser?.uid && (
                  <p className="mt-1 text-xs text-orange-600 font-medium">
                    Anda tidak dapat merubah peran akun Anda sendiri untuk menghindari hilangnya akses Super Admin.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditUser(null);
                  }} 
                  className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded inline-flex items-center gap-2 text-sm font-medium hover:bg-blue-700 transition"
                >
                  {editLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
