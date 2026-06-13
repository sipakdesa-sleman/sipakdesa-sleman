import { useEffect, useState } from "react";
import {
  ensurePeriodExists,
  updatePeriodStatus,
  setActivePeriod,
  copyAhpWeights,
  deletePeriod,
  deletePeriodForce,
  getAllPeriods,
} from "../services/periodService";
import { useDialog } from "../context/DialogProvider";
import { usePeriod } from "../context/PeriodContext";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  Unlock,
  Workflow,
  Trash2,
  Check,
  X,
} from "lucide-react";
import StatCard from "../components/StatCard";


export default function Periods() {
  const { refreshPeriods } = usePeriod();
  const [periods, setPeriods] = useState([]);
  const [newPeriod, setNewPeriod] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");
  const { alert, confirm } = useDialog();

  const lockedCount = periods.filter((p) => p.locked).length;
  const recalcCount = periods.filter((p) => p.needs_recalc).length;
  const completedCount = periods.filter((p) => p.ahpDone && p.praKalkulasiDone && p.mooraDone).length;

  const getStageDoneCount = (p) => [p.ahpDone, p.praKalkulasiDone, p.mooraDone].filter(Boolean).length;
  const getStagePercent = (p) => Math.round((getStageDoneCount(p) / 3) * 100);

  const load = async () => {
    try {
      const list = await getAllPeriods();
      setPeriods(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const handleCreate = async () => {
    if (!newPeriod.trim()) return alert({ message: "Isi nama/tahun periode", type: "error" });
    try {
      const periodId = newPeriod;
      await ensurePeriodExists(periodId);
      setNewPeriod("");
      await load();
      await refreshPeriods();
      alert({ message: `Periode ${periodId} dibuat`, type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: `Gagal membuat periode: ${e?.message ?? e}`, type: "error" });
    }
  };

  const handleSetActive = async (id) => {
    try {
      await setActivePeriod(id);
      await load();
      await refreshPeriods();
      alert({ message: `Periode ${id} diset aktif`, type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal set aktif", type: "error" });
    }
  };

  const toggleLock = async (p) => {
    try {
      await updatePeriodStatus(p.id, { locked: !p.locked });
      await load();
      await refreshPeriods();
      alert({ message: `Periode ${p.id} ${!p.locked ? "dikunci" : "dibuka"}`, type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal mengubah kunci periode", type: "error" });
    }
  };

  const clearNeedsRecalc = async (p) => {
    const ok = await confirm({ title: "Clear needs_recalc", message: `Hapus flag needs_recalc untuk periode ${p.id}?` });
    if (!ok) return;
    try {
      await updatePeriodStatus(p.id, { needs_recalc: false });
      await load();
      await refreshPeriods();
      alert({ message: `Flag needs_recalc dibersihkan untuk ${p.id}`, type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal membersihkan flag", type: "error" });
    }
  };

  const handleCopy = async () => {
    if (!copyFrom || !copyTo) return alert({ message: "Pilih sumber dan target periode", type: "error" });
    if (copyFrom === copyTo) return alert({ message: "Periode sumber dan target tidak boleh sama", type: "error" });
    try {
      await copyAhpWeights(copyFrom, copyTo);
      await load();
      await refreshPeriods();
      alert({ message: `Bobot AHP dari ${copyFrom} disalin ke ${copyTo}`, type: "info" });
      setCopyFrom("");
      setCopyTo("");
    } catch (e) {
      console.error(e);
      alert({ message: `Gagal menyalin bobot: ${e?.message ?? e}`, type: "error" });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Periode</h1>
        <p className="page-subtitle">
          Kelola periode penilaian: buat periode, salin bobot AHP, set aktif, kunci periode, dan pantau status recalculation.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Periode"
          value={periods.length}
          subtitle="Jumlah periode yang tersimpan"
          leadingIcon={<Calendar size={18} />}
        />
        <StatCard
          title="Periode Terkunci"
          value={lockedCount}
          subtitle="Periode terkunci saat ini"
          leadingIcon={<Lock size={18} />}
        />
        <StatCard
          title="Perlu Recalc"
          value={recalcCount}
          subtitle="Periode yang perlu hitung ulang"
          leadingIcon={<RefreshCw size={18} />}
        />
        <StatCard
          title="Siklus Lengkap"
          value={completedCount}
          subtitle="Periode dengan semua tahap selesai"
          leadingIcon={<CheckCircle2 size={18} />}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <aside className="space-y-4 lg:col-span-1">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Plus size={16} />
                </div>
                <h3 className="font-semibold text-slate-800">Buat Periode Baru</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">Gunakan format tahun (mis. 2026) atau label simulasi.</p>
            </div>
            <div className="space-y-3 p-5">
              <input
                placeholder="2026 atau Simulasi_1"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
              <button
                onClick={handleCreate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 font-medium text-white hover:bg-emerald-700"
              >
                <Plus size={16} />
                <span>Buat Periode</span>
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Copy size={16} />
                </div>
                <h3 className="font-semibold text-slate-800">Salin Bobot AHP</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">Akselerasi setup periode baru dari bobot periode sebelumnya.</p>
            </div>
            <div className="space-y-3 p-5">
              <select
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="">Dari periode sumber</option>
                {periods.map((p) => (
                  <option key={`source-${p.id}`} value={p.id}>
                    {p.year ?? p.id}
                  </option>
                ))}
              </select>
              <select
                value={copyTo}
                onChange={(e) => setCopyTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="">Ke periode target</option>
                {periods.map((p) => (
                  <option key={`target-${p.id}`} value={p.id}>
                    {p.year ?? p.id}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCopy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 font-medium text-white hover:bg-blue-700"
              >
                <Copy size={16} />
                <span>Salin Bobot</span>
              </button>
              <p className="text-xs text-slate-500">Bobot yang disalin dapat langsung digunakan di proses AHP periode target.</p>
            </div>
          </div>

          <div className="panel-indigo p-5">
            <div className="mb-3 flex items-center gap-2 text-sky-900">
              <Workflow size={16} />
              <h3 className="font-semibold">Alur Periode</h3>
            </div>
            <ul className="space-y-2 text-sm text-sky-900/90">
              <li>1. Buat periode baru lalu tetapkan sebagai aktif.</li>
              <li>2. Hitung AHP, lanjut Pra-kalkulasi, lalu MOORA.</li>
              <li>3. Jika master berubah, status recalc akan menyala.</li>
              <li>4. Kunci periode ketika hasil sudah final.</li>
            </ul>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Daftar Periode</h3>
              <p className="mt-1 text-xs text-slate-500">Pantau status periode dan jalankan aksi penting langsung dari tabel.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
              <ShieldAlert size={14} />
              <span>{recalcCount} periode perlu recalculation</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="table-core min-w-full">
              <thead className="table-head">
                <tr>
                  <th className="p-3 text-left">Periode</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Progress</th>
                  <th className="p-3 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="p-3 align-top">
                      <div className="font-semibold text-slate-800">{p.year ?? p.id}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {p.yearNumber ? `Tahun ${p.yearNumber}` : "Periode non-numerik"}
                      </div>
                    </td>

                    <td className="p-3 align-top">
                      <div className="flex flex-col gap-2">
                        {p.isActive || p.active ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            <Activity size={12} /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            Non-aktif
                          </span>
                        )}

                        {p.locked ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                            <Lock size={12} /> Terkunci
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            <Unlock size={12} /> Terbuka
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 align-top">
                      <div className="space-y-2">
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                            style={{ width: `${getStagePercent(p)}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-medium text-slate-500">
                          {getStageDoneCount(p)}/3 tahap selesai ({getStagePercent(p)}%)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs ${p.ahpDone ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            AHP {p.ahpDone ? "✓" : "-"}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-xs ${p.praKalkulasiDone ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            Pra {p.praKalkulasiDone ? "✓" : "-"}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-xs ${p.mooraDone ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            MOORA {p.mooraDone ? "✓" : "-"}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${p.needs_recalc ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {p.needs_recalc && <AlertTriangle size={12} />}
                            Recalc {p.needs_recalc ? "Perlu" : "Aman"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {!(p.isActive || p.active) ? (
                          <button
                            onClick={() => handleSetActive(p.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition duration-150"
                          >
                            <Check size={14} /> Set Aktif
                          </button>
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 cursor-not-allowed"
                          >
                            <Check size={14} /> Aktif
                          </button>
                        )}
                        <button
                          onClick={() => toggleLock(p)}
                          className={`rounded-lg px-3 py-2 text-xs font-medium ${p.locked ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-orange-500 text-white hover:bg-orange-600"}`}
                        >
                          {p.locked ? (
                            <span className="inline-flex items-center gap-2"><X size={12} /> Unlock</span>
                          ) : (
                            <span className="inline-flex items-center gap-2"><Lock size={12} /> Lock</span>
                          )}
                        </button>
                        {p.needs_recalc && (
                          <button
                            onClick={() => clearNeedsRecalc(p)}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-200 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-300"
                          >
                            <RefreshCw size={12} /> Clear Recalc
                          </button>
                        )}

                        <button
                          onClick={async () => {
                            if (p.isActive || p.active) {
                              return alert({ message: "Periode aktif tidak boleh dihapus", type: "error" });
                            }
                            const ok = await confirm({
                              title: "Hapus Periode",
                              message: `Hapus periode ${p.id} dari sistem? Tindakan ini tidak dapat dibatalkan.`,
                            });
                            if (!ok) return;

                            const force = await confirm({
                              title: "Hapus Semua Hasil?",
                              message:
                                "Apakah Anda ingin menghapus juga semua hasil AHP dan MOORA yang terkait dengan periode ini? OK = Hapus semua; Cancel = Hanya hapus jika aman (akan gagal jika ada hasil).",
                            });

                            try {
                              if (force) {
                                await deletePeriodForce(p.id);
                              } else {
                                await deletePeriod(p.id);
                              }
                              await load();
                              await refreshPeriods();
                              alert({ message: `Periode ${p.id} telah dihapus`, type: "info" });
                            } catch (e) {
                              console.error(e);
                              alert({ message: e?.message ?? "Gagal menghapus periode", type: "error" });
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
                        >
                          <Trash2 size={14} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {periods.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm text-slate-500">
                      Belum ada periode. Buat periode pertama pada panel sebelah kiri.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
