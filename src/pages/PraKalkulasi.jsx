import { useEffect, useMemo, useState } from "react";
import PeriodSelector from "../components/PeriodSelector";
import StatCard from "../components/StatCard";
import { getPraKalkulasiContext, executePraKalkulasi, savePraKalkulasiRun, savePraKalkulasiSystemParameters, getPraKalkulasiRun } from "../services/praKalkulasiService";
import { useDialog } from "../context/DialogProvider";
import { useAuth } from "../context/AuthContext";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";
import { MoneyInput, IntegerInput, DecimalInput } from "../components/NumericInput";
import { formatInteger } from "../utils/numberFormat";
import { updatePeriodStatus } from "../services/periodService";
import { Eye, EyeOff } from "lucide-react";
import { PageSkeleton } from "../components/SkeletonLoader";

import { clearDraft, readDraft, writeDraft } from "../utils/draftStorage";

const DRAFT_KEY = "sipakdesa:draft:pra-kalkulasi";

const rupiah = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatRp(value) {
  return rupiah.format(Number(value) || 0);
}

function toInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function getVillageTitle(row) {
  return row.nama || row.name || row.id || "-";
}

function getFieldNumber(row, keys, fallback = 0) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return Number(value);
  }
  return Number(fallback);
}

function DetailModal({ village, onClose }) {
  if (!village) return null;

  const monthly = getFieldNumber(village, ["monthly"]);
  const annual = getFieldNumber(village, ["siltapPokok12", "addSil"]);
  const addKes = getFieldNumber(village, ["addKes"]);
  const addKer = getFieldNumber(village, ["addKer"]);
  const addBPKal = getFieldNumber(village, ["addBPKal"]);
  const addKeb = getFieldNumber(village, ["addKeb"]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:items-center sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Detail Perangkat</p>
            <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">{getVillageTitle(village)}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Tutup detail">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Komponen Siltap</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between gap-3"><span>Lurah</span><span>{formatRp(village.tariffLurah ?? 0)} x 1</span></div>
              <div className="flex justify-between gap-3"><span>Carik</span><span>{formatRp(village.tariffCarik ?? 0)} x 1</span></div>
              <div className="flex justify-between gap-3"><span>Kasi/Kaur</span><span>{formatRp(village.tariffKasi ?? 0)} x 8</span></div>
              <div className="flex justify-between gap-3"><span>Dukuh</span><span>{formatRp(village.tariffDukuh ?? 0)} x {formatInteger(village.jumlah_dukuh ?? 0)}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between gap-3 font-semibold text-slate-900">
                <span>Siltap per bulan</span>
                <span>{formatRp(monthly)}</span>
              </div>
              <div className="flex justify-between gap-3 font-semibold text-slate-900">
                <span>Siltap setahun</span>
                <span>{formatRp(annual)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ADD Wajib</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between gap-3"><span>BPJS Kesehatan</span><span>{formatRp(addKes)}</span></div>
              <div className="flex justify-between gap-3"><span>BPJS Naker</span><span>{formatRp(addKer)}</span></div>
              <div className="flex justify-between gap-3"><span>Tunjangan BPKal</span><span>{formatRp(addBPKal)}</span></div>
              <div className="flex justify-between gap-3"><span>ADD Kebijakan</span><span>{formatRp(addKeb)}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between gap-3 font-semibold text-slate-900">
                <span>Total Potongan Wajib</span>
                <span>{formatRp(village.totalPotonganWajib ?? 0)}</span>
              </div>
              <div className="flex justify-between gap-3 font-semibold text-slate-900">
                <span>ADD Kewenangan Kegiatan</span>
                <span>{formatRp(village.addKewenanganKegiatan ?? village.alokasiFormula ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { usePeriod } from "../context/PeriodContext";

export default function PraKalkulasi() {
  const { selectedPeriod, setSelectedPeriod, periods, refreshPeriods } = usePeriod();
  const [periodMeta, setPeriodMeta] = useState(null);
  const [systemParams, setSystemParams] = useState({
    umk_aktif: "",
    rate_bpjs_kes: "",
    rate_bpjs_naker: "",
    siltap_lurah: "",
    siltap_carik: "",
    siltap_kasi: "",
    siltap_dukuh: "",
    default_lurah_count: "",
    default_carik_count: "",
    default_kasi_kaur_count: "",
    bpjs_staff_count: "",
  });
  const [paguKab, setPaguKab] = useState(0);
  const [isKebijakan, setIsKebijakan] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [villages, setVillages] = useState([]);
  const [showParams, setShowParams] = useState(true);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [systemParamsReady, setSystemParamsReady] = useState(true);
  const [bpkalConfigReady, setBpkalConfigReady] = useState(true);
  const { alert, confirm } = useDialog();
  const { currentUser } = useAuth();
  const { markDirty, clearDirty } = useUnsavedChanges();

  useEffect(() => {
    if (refreshPeriods) refreshPeriods();
  }, [refreshPeriods]);
  useEffect(() => {
    const loadDraftState = () => {
      try {
        const draft = readDraft(DRAFT_KEY);
        if (!selectedPeriod && draft?.selectedPeriod) {
          const exists = periods.some(p => String(p.id) === String(draft.selectedPeriod));
          if (exists) {
            setSelectedPeriod(draft.selectedPeriod);
          }
        }
        if (draft?.systemParams) setSystemParams((current) => ({ ...current, ...draft.systemParams }));
        if (draft?.paguKab !== undefined) setPaguKab(Number(draft.paguKab) || 0);
        if (draft?.isKebijakan !== undefined) setIsKebijakan(!!draft.isKebijakan);
        if (draft?.showParams !== undefined) setShowParams(!!draft.showParams);
        clearDirty();
      } catch (e) {
        console.error(e);
      }
    };
    loadDraftState();
  }, [clearDirty, selectedPeriod, setSelectedPeriod, periods]);

  useEffect(() => {
    if (!selectedPeriod) {
      setPageLoading(false);
      return;
    }
    let alive = true;

    const loadContext = async () => {
      setPageLoading(true);
      try {
        const ctx = await getPraKalkulasiContext(selectedPeriod);
        if (!alive) return;
        setPeriodMeta(ctx.period);
        setVillages(ctx.villages || []);
        setSystemParams({
          umk_aktif: toInputValue(ctx.systemParameters.umk_aktif),
          rate_bpjs_kes: toInputValue(ctx.systemParameters.rate_bpjs_kes),
          rate_bpjs_naker: toInputValue(ctx.systemParameters.rate_bpjs_naker),
          siltap_lurah: toInputValue(ctx.systemParameters.siltap_lurah),
          siltap_carik: toInputValue(ctx.systemParameters.siltap_carik),
          siltap_kasi: toInputValue(ctx.systemParameters.siltap_kasi),
          siltap_dukuh: toInputValue(ctx.systemParameters.siltap_dukuh),
          default_lurah_count: toInputValue(ctx.systemParameters.default_lurah_count),
          default_carik_count: toInputValue(ctx.systemParameters.default_carik_count),
          default_kasi_kaur_count: toInputValue(ctx.systemParameters.default_kasi_kaur_count),
          bpjs_staff_count: toInputValue(ctx.systemParameters.bpjs_staff_count),
        });
        setSystemParamsReady(!!ctx.hasSystemParameters);
        setBpkalConfigReady(!!ctx.hasBpkalConfig);
        setPaguKab(Number(ctx.period.pagu_total_kab ?? ctx.period.paguKab ?? 0));
        setIsKebijakan(!!ctx.period.is_kebijakan_active);
        if (ctx.period.praKalkulasiDone && ctx.period.praKalkulasiResult?.runId) {
          try {
            const savedRun = await getPraKalkulasiRun(selectedPeriod, ctx.period.praKalkulasiResult.runId);
            if (savedRun && alive) {
              setResult(savedRun);
            } else if (alive) {
              setResult(null);
            }
          } catch (e) {
            console.warn("Failed to load saved pra-kalkulasi run:", e);
            if (alive) setResult(null);
          }
        } else {
          setResult(null);
        }

        const draft = readDraft(DRAFT_KEY);
        if (draft?.systemParams) setSystemParams((current) => ({ ...current, ...draft.systemParams }));
        if (draft?.paguKab !== undefined) setPaguKab(Number(draft.paguKab) || 0);
        if (draft?.isKebijakan !== undefined) setIsKebijakan(!!draft.isKebijakan);
        if (draft?.showParams !== undefined) setShowParams(!!draft.showParams);
        clearDirty();
      } catch (e) {
        console.error(e);
        alert({ message: "Gagal memuat parameter pra-kalkulasi: " + (e?.message ?? e), type: "error" });
      } finally {
        if (alive) setPageLoading(false);
      }
    };

    loadContext();
    return () => {
      alive = false;
    };
  }, [selectedPeriod, alert, clearDirty]);

  useEffect(() => {
    if (pageLoading) return;
    writeDraft(DRAFT_KEY, {
      selectedPeriod,
      systemParams,
      paguKab,
      isKebijakan,
      showParams,
    });
  }, [pageLoading, selectedPeriod, systemParams, paguKab, isKebijakan, showParams]);

  const detailRows = useMemo(() => {
    const rows = [...(result?.perVillage ?? [])];
    return rows.sort((a, b) => {
      // Sort by code first (if both have code)
      const aCode = String(a.code ?? "").trim();
      const bCode = String(b.code ?? "").trim();
      if (aCode && bCode) {
        // Try numeric comparison first
        const aNum = parseInt(aCode, 10);
        const bNum = parseInt(bCode, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        // Fallback to string comparison
        return aCode.localeCompare(bCode, undefined, { numeric: true });
      }
      if (aCode) return -1;
      if (bCode) return 1;
      
      // Fallback: sort by numeric id/kode
      const an = Number(a.id ?? a.kode ?? 0) || 0;
      const bn = Number(b.id ?? b.kode ?? 0) || 0;
      if (an !== 0 || bn !== 0) return an - bn;
      
      // Final fallback: sort by name alphabetically
      return String(a.nama || a.name || "").localeCompare(String(b.nama || b.name || ""), undefined, { numeric: true });
    });
  }, [result]);

  const summary = useMemo(() => {
    const totals = result?.totals ?? {};
    const hasResult = !!result;
    return {
      totalDesa: hasResult ? detailRows.length : villages.length,
      totalDukuh: hasResult
        ? detailRows.reduce((sum, row) => sum + Number(row.jumlah_dukuh || 0), 0)
        : villages.reduce((sum, row) => sum + Number(row.jumlah_dukuh ?? row.jumlah_padukuhan ?? 0), 0),
      totalJumlahBpkal: hasResult
        ? detailRows.reduce((sum, row) => sum + Number(row.jumlah_bpkal || 0), 0)
        : villages.reduce((sum, row) => sum + Number(row.jumlah_bpkal ?? 0), 0),
      totalPotonganWajib: Number(totals.totalPotonganWajib ?? 0),
      sisaAlokasi: Number(result?.addKew ?? 0),
      addSil: Number(totals.addSil ?? 0),
      addKes: Number(totals.addKes ?? 0),
      addKer: Number(totals.addKer ?? 0),
      addBPKal: Number(totals.addBPKal ?? 0),
      addKeb: Number(totals.addKeb ?? 0),
    };
  }, [detailRows, result, villages]);

  const handleParameterChange = (field, value) => {
    markDirty();
    setSystemParams((current) => ({ ...current, [field]: value }));
  };

  const handleExecute = async () => {
    if (!selectedPeriod) return alert({ message: "Pilih periode terlebih dahulu", type: "error" });
    if (periodMeta?.locked) {
      return alert({
        message: "❌ Periode ini dikunci oleh admin. Buka kunci di halaman Periode untuk menjalankan atau mengubah Pra-Kalkulasi.",
        type: "error",
      });
    }
    if (!bpkalConfigReady) {
      return alert({
        message: "❌ Konfigurasi BPKal belum diatur untuk periode ini. Harap simpan formasi dan tarif tunjangan BPKal di menu BPKal terlebih dahulu.",
        type: "error",
      });
    }
    const requiredFields = ["umk_aktif", "rate_bpjs_kes", "rate_bpjs_naker", "siltap_lurah", "siltap_carik", "siltap_kasi", "siltap_dukuh", "default_lurah_count", "default_carik_count", "default_kasi_kaur_count", "bpjs_staff_count"];
    const missing = requiredFields.filter((field) => systemParams[field] === "" || systemParams[field] === null || systemParams[field] === undefined);
    if (missing.length) {
      return alert({
        message: `Asumsi & Estimasi belum lengkap: ${missing.join(", ")}. Simpan dulu Asumsi & Estimasi Anggarannya.`,
        type: "error",
      });
    }
    setRunning(true);
    try {
      const response = await executePraKalkulasi(selectedPeriod, paguKab, {
        ...systemParams,
        is_kebijakan_active: isKebijakan,
      });
      setResult(response.result);
      markDirty();
      alert({ message: "Pra-kalkulasi selesai. Preview hasil sudah diperbarui.", type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal eksekusi pra-kalkulasi: " + (e?.message ?? e), type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const handleSaveParameters = async () => {
    if (!selectedPeriod) return alert({ message: "Pilih periode terlebih dahulu", type: "error" });
    if (periodMeta?.locked) {
      return alert({
        message: "❌ Periode ini dikunci oleh admin. Buka kunci di halaman Periode untuk menyimpan Asumsi & Estimasi Anggaran.",
        type: "error",
      });
    }
    setRunning(true);
    try {
      await savePraKalkulasiSystemParameters(selectedPeriod, systemParams);
      await updatePeriodStatus(selectedPeriod, {
        pagu_total_kab: paguKab,
        paguKab: paguKab,
        is_kebijakan_active: isKebijakan,
      });
      setPeriodMeta((prev) =>
        prev
          ? {
              ...prev,
              pagu_total_kab: paguKab,
              paguKab: paguKab,
              is_kebijakan_active: isKebijakan,
            }
          : null
      );
      setSystemParamsReady(true);
      clearDirty();
      if (refreshPeriods) await refreshPeriods();
      alert({ message: "Asumsi & Estimasi Anggaran berhasil disimpan.", type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal menyimpan Asumsi & Estimasi Anggaran: " + (e?.message ?? e), type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedPeriod) return alert({ message: "Pilih periode terlebih dahulu", type: "error" });
    if (periodMeta?.locked) {
      return alert({
        message: "❌ Periode ini dikunci oleh admin. Buka kunci di halaman Periode untuk melakukan finalisasi.",
        type: "error",
      });
    }
    if (!result) return alert({ message: "Jalankan pra-kalkulasi dulu sebelum finalisasi.", type: "error" });
    const ok = await confirm({
      title: "Finalisasi & Kirim Pagu ke MOORA",
      message: `Simpan sisa alokasi sebesar Rp ${formatRp(result.addKew)} dan finalisasi alokasi earmark ini untuk dikirim ke MOORA?`,
      confirmLabel: "Finalisasi & Simpan",
      cancelLabel: "Batal",
    });
    if (!ok) return;
    setRunning(true);
    try {
      const runPayload = {
        perVillage: result.perVillage,
        totals: {
          ...result.totals,
          paguTotalKab: paguKab,
          paguKab: paguKab,
          isKebijakan: isKebijakan,
        },
        addKew: result.addKew,
        label: `pra_kalkulasi_${selectedPeriod}_${Date.now()}`,
      };
      const saved = await savePraKalkulasiRun(selectedPeriod, runPayload, currentUser);
      alert({ message: `Tersimpan sebagai run ${saved.runId}`, type: "info" });
      setPeriodMeta((prev) =>
        prev
          ? {
              ...prev,
              locked: true,
              praKalkulasiDone: true,
              praKalkulasiResult: {
                runId: saved.runId,
                addKew: Number(runPayload.addKew ?? 0),
                summary: runPayload.totals ?? {},
              },
            }
          : null
      );
      clearDirty();
      clearDraft(DRAFT_KEY);
      if (refreshPeriods) await refreshPeriods();
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal menyimpan pra-kalkulasi: " + (e?.message ?? e), type: "error" });
    } finally {
      setRunning(false);
    }
  };

  if (pageLoading && !periodMeta) {
    return (
      <div className="page-shell">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Alokasi Earmark</h1>
        <p className="page-subtitle">
          Halaman ini membaca parameter dinamis dari <span className="font-medium">system_parameters</span> dan data kalurahan dari <span className="font-medium">alternatives</span>, lalu menampilkan ringkasan 10 kolom utama agar preview tetap bersih.
        </p>
        <p className="text-xs text-slate-500">{periods.length} periode termuat.</p>
      </div>

      {periodMeta?.locked && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p className="text-sm font-semibold">Periode Terkunci</p>
            <p className="text-xs text-red-700">Periode ini telah dikunci oleh admin. Hasil alokasi earmark bersifat final dan tidak dapat diubah kembali kecuali kunci dibuka di menu Periode.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StatCard title="Total Kalurahan" value={formatInteger(summary.totalDesa)} subtitle="Kalurahan yang ikut dihitung" />
        <StatCard title="Total Dukuh" value={formatInteger(summary.totalDukuh)} subtitle="Akumulasi dukuh seluruh alternatif" />
        <StatCard title="Total BPKal" value={formatRp(summary.addBPKal)} subtitle="Potongan wajib khusus BPKal" />
        <StatCard title="Total Potongan Wajib" value={formatRp(summary.totalPotonganWajib)} subtitle="Siltap + BPJS + Kebijakan + BPKal" />
        <StatCard title="Sisa Alokasi" value={formatRp(summary.sisaAlokasi)} subtitle="ADDKew yang dibawa ke MOORA" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Panel Kontrol Utama</h2>
            <p className="text-sm text-slate-500">Pilih periode, isi pagu BKAD, lalu jalankan otomasi.</p>
          </div>
          <div className="w-full md:max-w-xs">
            <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} allowOnlyActive={false} />
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setShowParams(!showParams)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100/50 rounded-t-2xl"
            >
              <span className="flex items-center gap-2">
                {showParams ? <Eye size={18} className="text-slate-500" /> : <EyeOff size={18} className="text-slate-400" />}
                Asumsi & Estimasi Anggaran
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${showParams ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showParams && (
              <div className="border-t border-slate-200 p-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>UMK Aktif</span>
                    <MoneyInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.umk_aktif}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("umk_aktif", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Rate BPJS Kesehatan</span>
                    <DecimalInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.rate_bpjs_kes}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("rate_bpjs_kes", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Rate BPJS Ketenagakerjaan</span>
                    <DecimalInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.rate_bpjs_naker}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("rate_bpjs_naker", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>ADD Kabupaten BKAD</span>
                    <MoneyInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={paguKab}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => setPaguKab(val)}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Tarif Siltap Lurah</span>
                    <MoneyInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.siltap_lurah}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("siltap_lurah", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Tarif Siltap Carik</span>
                    <MoneyInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.siltap_carik}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("siltap_carik", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Tarif Siltap Kasi</span>
                    <MoneyInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.siltap_kasi}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("siltap_kasi", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Tarif Siltap Dukuh</span>
                    <MoneyInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.siltap_dukuh}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("siltap_dukuh", val)}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Default Lurah Count</span>
                    <IntegerInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.default_lurah_count}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("default_lurah_count", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Default Carik Count</span>
                    <IntegerInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.default_carik_count}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("default_carik_count", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>Default Kasi/Kaur Count</span>
                    <IntegerInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.default_kasi_kaur_count}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("default_kasi_kaur_count", val)}
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span>BPJS Staff Count</span>
                    <IntegerInput
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-[#1a2847] focus:ring-2 focus:ring-[#1a2847]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      value={systemParams.bpjs_staff_count}
                      disabled={periodMeta?.locked || running}
                      onChange={(val) => handleParameterChange("bpjs_staff_count", val)}
                    />
                  </label>
                </div>

                <div className="border-t border-slate-200 pt-4 flex flex-col gap-3 md:flex-row md:items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={isKebijakan}
                        disabled={periodMeta?.locked || running}
                        onChange={(e) => setIsKebijakan(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#1a2847] focus:ring-[#1a2847] disabled:opacity-50"
                      />
                      Sertakan Anggaran Kebijakan (THR & Gaji Ke-13)?
                    </label>
                    <span className="text-xs text-slate-500 pl-7">Toggle ini mengubah kolom ADD Kebijakan pada preview.</span>
                  </div>

                  <button
                    onClick={handleSaveParameters}
                    disabled={running || periodMeta?.locked}
                    className="inline-flex items-center justify-center rounded-xl bg-[#1a2847] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#14213a] disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
                  >
                    Simpan Asumsi & Estimasi
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              onClick={handleExecute}
              disabled={running || periodMeta?.locked}
              className="inline-flex items-center justify-center rounded-xl bg-[#1a2847] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#14213a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Memproses..." : "Eksekusi Otomasi Pra-Kalkulasi"}
            </button>
            <button
              onClick={() => setResult(null)}
              disabled={periodMeta?.locked}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Bersihkan Preview
            </button>
            {periodMeta && (
              <div className="text-sm text-slate-500">
                Periode aktif: <span className="font-medium text-slate-800">{periodMeta.label ?? periodMeta.id ?? selectedPeriod}</span>
                {periodMeta.locked && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                    🔒 Terkunci
                  </span>
                )}
              </div>
            )}
            {!systemParamsReady && (
              <div className="text-sm font-medium text-amber-700">
                Asumsi & Estimasi Anggaran untuk periode ini belum ada. Isi lalu klik Simpan Asumsi & Estimasi.
              </div>
            )}
            {!bpkalConfigReady && (
              <div className="text-sm font-medium text-rose-700 mt-2">
                ⚠️ Konfigurasi BPKal untuk periode ini belum ada. Atur dan simpan BPKal di menu BPKal.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Preview Hasil per Kalurahan</h2>
            <p className="text-sm text-slate-500">Tabel diringkas menjadi 10 kolom utama sesuai kebutuhan operasional.</p>
          </div>
          {result && !periodMeta?.locked && (
            <button
              onClick={handleFinalize}
              className="rounded-xl border border-[#1a2847] bg-[#1a2847] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#14213a]"
            >
              Finalisasi & Kirim ke MOORA
            </button>
          )}
        </div>

        {!result ? (
          <div className="px-5 py-10 text-sm text-slate-500">Jalankan otomasi alokasi earmark untuk melihat preview hasil.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">No</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Kalurahan</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Jumlah Dukuh</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Jumlah BPKal</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Siltap Tahunan</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">BPJS Kes</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">BPJS Naker</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">BPKal</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">ADD Kebijakan</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Total Potongan Wajib</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">ADD Kewenangan Kegiatan</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Aksi Detail</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row, index) => (
                  <tr key={row.id ?? `${row.nama}-${index}`} className="table-row">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-3 font-medium text-slate-700">{index + 1}</td>
                    <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">{getVillageTitle(row)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">{formatInteger(row.jumlah_dukuh ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">{formatInteger(row.jumlah_bpkal ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">{formatRp(row.addSil ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">{formatRp(row.addKes ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">{formatRp(row.addKer ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">{formatRp(row.addBPKal ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-700">{formatRp(row.addKeb ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right font-semibold text-slate-900">{formatRp(row.totalPotonganWajib ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right text-slate-500">{formatRp(row.addKewenanganKegiatan ?? row.alokasiFormula ?? 0)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedVillage(row)}
                        className="btn-action-sm"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800" colSpan={2}>Total Kabupaten</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatInteger(summary.totalDukuh)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatInteger(summary.totalJumlahBpkal)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatRp(summary.addSil)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatRp(summary.addKes)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatRp(summary.addKer)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatRp(summary.addBPKal)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatRp(summary.addKeb)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatRp(summary.totalPotonganWajib)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatRp(summary.sisaAlokasi)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {selectedVillage && <DetailModal village={selectedVillage} onClose={() => setSelectedVillage(null)} />}
    </div>
  );
}
