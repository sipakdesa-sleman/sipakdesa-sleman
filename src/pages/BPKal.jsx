import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, Layers3, Info } from "lucide-react";
import { getPeriod } from "../services/periodService";
import PeriodSelector from "../components/PeriodSelector";
import StatCard from "../components/StatCard";
import { useDialog } from "../context/DialogProvider";
import { PageSkeleton } from "../components/SkeletonLoader";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";
import { getBpkalConfig, saveBpkalConfig } from "../services/bpkalService";
import { createEmptyBpkalTemplate, isBpkalTemplateComplete, isBpkalTariffComplete } from "../utils/bpkal";
import { usePeriod } from "../context/PeriodContext";
import { MoneyInput, IntegerInput } from "../components/NumericInput";

function toInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function createBlankTariffs() {
  return {
    ketua: "",
    wakil: "",
    sekretaris: "",
    bidang: "",
    anggota: "",
  };
}

function createBlankTemplate(index = 0) {
  return {
    ...createEmptyBpkalTemplate(index),
    id: `template_${Date.now()}_${index}`,
    name: "",
    total_bpkal: "",
    ketua: 1,
    wakil: 1,
    sekretaris: 1,
    bidang: "",
    anggota: "",
    active: true,
  };
}

export default function BPKal() {
  const { selectedPeriod, setSelectedPeriod, periods } = usePeriod();
  const [periodMeta, setPeriodMeta] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("formasi");
  const [config, setConfig] = useState({
    period: "",
    active: true,
    tariffs: createBlankTariffs(),
    templates: [],
  });
  const { alert, confirm } = useDialog();
  const { markDirty, clearDirty } = useUnsavedChanges();

  const selectedPeriodData = periods.find(p => String(p.id) === String(selectedPeriod));
  const isLocked = !!(periodMeta?.locked || periodMeta?.praKalkulasiResult?.locked || selectedPeriodData?.locked || selectedPeriodData?.praKalkulasiResult?.locked);

  useEffect(() => {
    if (!selectedPeriod) {
      setPageLoading(false);
      return;
    }

    let alive = true;
    const loadConfig = async () => {
      setPageLoading(true);
      try {
        const [periodDoc, bpkalConfig] = await Promise.all([getPeriod(selectedPeriod), getBpkalConfig(selectedPeriod)]);
        if (!alive) return;

        setPeriodMeta(periodDoc);
        setConfig({
          period: bpkalConfig.period ?? String(selectedPeriod),
          active: bpkalConfig.active !== false,
          tariffs: {
            ketua: toInputValue(bpkalConfig.tariffs?.ketua),
            wakil: toInputValue(bpkalConfig.tariffs?.wakil),
            sekretaris: toInputValue(bpkalConfig.tariffs?.sekretaris),
            bidang: toInputValue(bpkalConfig.tariffs?.bidang),
            anggota: toInputValue(bpkalConfig.tariffs?.anggota),
          },
          templates: Array.isArray(bpkalConfig.templates) && bpkalConfig.templates.length
            ? bpkalConfig.templates.map((item, index) => ({
                id: String(item.id ?? `template_${index + 1}`),
                name: item.name ?? "",
                total_bpkal: toInputValue(item.total_bpkal),
                ketua: toInputValue(item.ketua ?? 1),
                wakil: toInputValue(item.wakil ?? 1),
                sekretaris: toInputValue(item.sekretaris ?? 1),
                bidang: toInputValue(item.bidang),
                anggota: toInputValue(item.anggota),
                active: item.active !== false,
              }))
            : [createBlankTemplate(0)],
        });
        clearDirty();
      } catch (e) {
        console.error(e);
        alert({ message: "Gagal memuat konfigurasi BPKal: " + (e?.message ?? e), type: "error" });
      } finally {
        if (alive) setPageLoading(false);
      }
    };

    loadConfig();
    return () => {
      alive = false;
    };
  }, [selectedPeriod, alert, clearDirty]);

  const templateStats = useMemo(() => {
    const total = config.templates.length;
    const active = config.templates.filter((item) => item.active !== false).length;
    const complete = config.templates.filter((item) => isBpkalTemplateComplete(item)).length;
    return { total, active, complete };
  }, [config.templates]);

  const tariffComplete = useMemo(() => isBpkalTariffComplete(config.tariffs), [config.tariffs]);

  const handleTemplateChange = (index, field, value) => {
    markDirty();
    setConfig((current) => ({
      ...current,
      templates: current.templates.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addTemplate = () => {
    markDirty();
    setConfig((current) => ({
      ...current,
      templates: [...current.templates, createBlankTemplate(current.templates.length)],
    }));
  };

  const removeTemplate = async (index) => {
    const template = config.templates[index];
    const ok = await confirm({
      title: "Hapus Formasi",
      message: `Hapus template ${template?.name || template?.id || "ini"}?`,
      confirmLabel: "Hapus",
      cancelLabel: "Batal",
    });
    if (!ok) return;

    markDirty();
    setConfig((current) => ({
      ...current,
      templates: current.templates.filter((_, idx) => idx !== index),
    }));
  };

  const handleTariffChange = (field, value) => {
    markDirty();
    setConfig((current) => ({
      ...current,
      tariffs: {
        ...current.tariffs,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedPeriod) return alert({ message: "Pilih periode terlebih dahulu.", type: "error" });
    if (isLocked) {
      return alert({
        message: (periodMeta?.locked || selectedPeriodData?.locked)
          ? "❌ Periode dikunci secara global. Buka kunci di menu Periode terlebih dahulu."
          : "❌ Alokasi Earmark periode ini telah difinalisasi. Buka kunci earmark terlebih dahulu.",
        type: "error",
      });
    }

    const invalidTemplate = config.templates.find((item) => item.active !== false && !isBpkalTemplateComplete(item));
    if (invalidTemplate) {
      return alert({ message: "Masih ada formasi BPKal yang belum lengkap.", type: "error" });
    }

    if (!isBpkalTariffComplete(config.tariffs)) {
      return alert({ message: "Tarif BPKal belum lengkap.", type: "error" });
    }

    setRunning(true);
    try {
      await saveBpkalConfig(selectedPeriod, {
        ...config,
        period: selectedPeriod,
        templates: config.templates.map((item) => ({
          ...item,
          total_bpkal: item.total_bpkal === "" ? null : Number(item.total_bpkal),
          ketua: item.ketua === "" ? null : Number(item.ketua),
          wakil: item.wakil === "" ? null : Number(item.wakil),
          sekretaris: item.sekretaris === "" ? null : Number(item.sekretaris),
          bidang: item.bidang === "" ? null : Number(item.bidang),
          anggota: item.anggota === "" ? null : Number(item.anggota),
        })),
        tariffs: {
          ketua: Number(config.tariffs.ketua),
          wakil: Number(config.tariffs.wakil),
          sekretaris: Number(config.tariffs.sekretaris),
          bidang: Number(config.tariffs.bidang),
          anggota: Number(config.tariffs.anggota),
        },
      });

      clearDirty();
      alert({ message: "Konfigurasi BPKal tersimpan.", type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal menyimpan konfigurasi BPKal: " + (e?.message ?? e), type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const totalPeopleConfigured = useMemo(() => {
    return config.templates.reduce((sum, item) => sum + (Number(item.total_bpkal) || 0), 0);
  }, [config.templates]);

  if (pageLoading && !periodMeta) {
    return (
      <div className="page-shell">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="page-header-container">
        <div className="page-header">
          <h1 className="page-title">BPKal</h1>
          <p className="page-subtitle">
            Kelola master template formasi keanggotaan dan rincian tarif tunjangan/operasional BPKal per periode.
          </p>
        </div>
      </div>

      {isLocked && (
        <div className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${
          (periodMeta?.locked || selectedPeriodData?.locked)
            ? "border-red-200 bg-red-50 text-red-950" 
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 shrink-0 ${(periodMeta?.locked || selectedPeriodData?.locked) ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            {(periodMeta?.locked || selectedPeriodData?.locked) ? (
              <>
                <p className="text-sm font-semibold">Periode Terkunci (Global)</p>
                <p className="text-xs text-red-700">Periode ini telah dikunci secara global oleh admin. Formasi dan tarif BPKal dinonaktifkan dari perubahan kecuali kunci dibuka di menu <span className="font-semibold">Periode</span>.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Alokasi Earmark Terkunci (Final)</p>
                <p className="text-xs text-amber-700">Hasil alokasi earmark periode ini sudah difinalisasi. Master data BPKal dinonaktifkan dari perubahan agar hasil perhitungan tetap konsisten. Buka kunci di menu <span className="font-semibold">Alokasi Earmark</span> untuk melakukan perubahan.</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="panel-info p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center">
          <Info size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Relasi Data</p>
          <p className="text-sm text-blue-800">
            Template formasi dipakai sebagai lookup berdasarkan jumlah orang BPKal di Data Kalurahan, sedangkan tarif jabatan disimpan di sini agar pra-kalkulasi tetap dinamis.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Total Template" value={templateStats.total} subtitle="Formasi BPKal tersimpan" />
        <StatCard title="Template Aktif" value={templateStats.active} subtitle="Siap dipakai hitung" />
        <StatCard title="Tarif Lengkap" value={tariffComplete ? "Ya" : "Belum"} subtitle="Siap dipakai pra-kalkulasi" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Panel Master BPKal</h2>
            <p className="text-sm text-slate-500">Pilih periode dan kelola formasi serta tarif BPKal dari satu menu.</p>
          </div>
          <div className="w-full md:max-w-xs">
            <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} allowOnlyActive={false} />
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {[
              ["formasi", "Breakdown Formasi"],
              ["tarif", "Tarif Tunjangan"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === key ? "bg-[#1a2847] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "formasi" && (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-900">Breakdown Formasi</p>
                  <p className="text-sm text-slate-600">Template ini dipasangkan dengan `jumlah_bpkal` di Data Kalurahan. Isi total orang dan komposisi per jabatan.</p>
                </div>
                <button
                  onClick={addTemplate}
                  disabled={isLocked}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} /> Tambah Formasi
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[1200px] w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Nama Template</th>
                      <th className="px-4 py-3 text-left">Total Orang</th>
                      <th className="px-4 py-3 text-left">Ketua</th>
                      <th className="px-4 py-3 text-left">Wakil</th>
                      <th className="px-4 py-3 text-left">Sekretaris</th>
                      <th className="px-4 py-3 text-left">Bidang</th>
                      <th className="px-4 py-3 text-left">Anggota</th>
                      <th className="px-4 py-3 text-left">Aktif</th>
                      <th className="px-4 py-3 text-left">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.templates.map((item, index) => (
                      <tr key={item.id ?? index} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3">
                          <input
                            value={item.name}
                            onChange={(e) => handleTemplateChange(index, "name", e.target.value)}
                            disabled={isLocked}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                            placeholder="Contoh: Formasi 9 Orang"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <IntegerInput
                            value={item.total_bpkal}
                            onChange={(val) => handleTemplateChange(index, "total_bpkal", val)}
                            disabled={isLocked}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input value={item.ketua} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600" />
                        </td>
                        <td className="px-4 py-3">
                          <input value={item.wakil} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600" />
                        </td>
                        <td className="px-4 py-3">
                          <input value={item.sekretaris} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600" />
                        </td>
                        <td className="px-4 py-3">
                          <IntegerInput
                            value={item.bidang}
                            onChange={(val) => handleTemplateChange(index, "bidang", val)}
                            disabled={isLocked}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <IntegerInput
                            value={item.anggota}
                            onChange={(val) => handleTemplateChange(index, "anggota", val)}
                            disabled={isLocked}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.active !== false}
                            onChange={(e) => handleTemplateChange(index, "active", e.target.checked)}
                            disabled={isLocked}
                            className="h-4 w-4 rounded border-slate-300 text-[#1a2847]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeTemplate(index)}
                            disabled={isLocked}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={14} /> Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500">Template aktif dengan total orang yang sama akan dipakai saat pra-kalkulasi sesuai angka `jumlah_bpkal` di Data Kalurahan.</p>
            </section>
          )}

          {activeTab === "tarif" && (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-900">Tarif Tunjangan</p>
                  <p className="text-sm text-slate-600">Isi rupiah per jabatan. Angka ini dipakai bersama komposisi formasi untuk menghitung tunjangan tahunan.</p>
                </div>
                <div className="text-xs text-slate-500">Sumber nominal BPKal dipusatkan di sini.</div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["ketua", "Tarif Ketua"],
                  ["wakil", "Tarif Wakil Ketua"],
                  ["sekretaris", "Tarif Sekretaris"],
                  ["bidang", "Tarif Kepala Bidang"],
                  ["anggota", "Tarif Anggota"],
                ].map(([field, label]) => (
                  <label key={field} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{label}</span>
                    <MoneyInput
                      value={config.tariffs[field]}
                      onChange={(val) => handleTariffChange(field, val)}
                      disabled={isLocked}
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:bg-slate-50 disabled:text-slate-500"
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <Layers3 size={16} className="text-slate-500" />
                  <span>Total template tersimpan: <strong>{templateStats.total}</strong></span>
                  <span>Total orang terkonfigurasi: <strong>{totalPeopleConfigured}</strong></span>
                  <span>Tarif lengkap: <strong>{tariffComplete ? "Ya" : "Belum"}</strong></span>
                </div>
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              Periode aktif: <span className="font-medium text-slate-800">{periodMeta?.label ?? periodMeta?.year ?? selectedPeriod ?? "-"}</span>
            </div>
            <button
              onClick={handleSave}
              disabled={running || !selectedPeriod || isLocked}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1a2847] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#14213a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} /> {running ? "Menyimpan..." : "Simpan BPKal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}