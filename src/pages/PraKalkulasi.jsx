import { useEffect, useMemo, useState } from "react";
import PeriodSelector from "../components/PeriodSelector";
import StatCard from "../components/StatCard";
import { getPraKalkulasiContext, executePraKalkulasi, savePraKalkulasiRun, savePraKalkulasiSystemParameters, getPraKalkulasiRun } from "../services/praKalkulasiService";
import { useDialog } from "../context/DialogProvider";
import { useAuth } from "../context/AuthContext";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";
import { MoneyInput, IntegerInput, DecimalInput } from "../components/NumericInput";
import { formatInteger } from "../utils/numberFormat";
import { updatePeriodStatus, unlockPraKalkulasiResult } from "../services/periodService";
import { Eye, EyeOff, Download } from "lucide-react";
import { PageSkeleton } from "../components/SkeletonLoader";
import { computeVillageSums } from "../utils/praKalkulasi";

import { clearDraft, readDraft, writeDraft } from "../utils/draftStorage";

const getDraftKey = (periodId) => periodId ? `sipakdesa:draft:pra-kalkulasi:${periodId}` : null;

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
  const [bpkalConfig, setBpkalConfig] = useState(null);
  const { alert, confirm } = useDialog();
  const { currentUser } = useAuth();
  const { markDirty, clearDirty } = useUnsavedChanges();

  useEffect(() => {
    if (refreshPeriods) refreshPeriods();
  }, [refreshPeriods]);
  useEffect(() => {
    const loadDraftState = () => {
      try {
        const activePeriod = selectedPeriod || localStorage.getItem("sipakdesa:selectedPeriod");
        if (!activePeriod) return;
        const draft = readDraft(getDraftKey(activePeriod));
        if (draft && String(draft.selectedPeriod) === String(activePeriod)) {
          if (draft.systemParams) setSystemParams((current) => ({ ...current, ...draft.systemParams }));
          if (draft.paguKab !== undefined) setPaguKab(Number(draft.paguKab) || 0);
          if (draft.isKebijakan !== undefined) setIsKebijakan(!!draft.isKebijakan);
          if (draft.showParams !== undefined) setShowParams(!!draft.showParams);
        }
        clearDirty();
      } catch (e) {
        console.error(e);
      }
    };
    loadDraftState();
  }, [clearDirty, selectedPeriod]);

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
        setBpkalConfig(ctx.bpkalConfig);
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

        const draft = readDraft(getDraftKey(selectedPeriod));
        if (draft && String(draft.selectedPeriod) === String(selectedPeriod)) {
          if (draft.systemParams) setSystemParams((current) => ({ ...current, ...draft.systemParams }));
          if (draft.paguKab !== undefined) setPaguKab(Number(draft.paguKab) || 0);
          if (draft.isKebijakan !== undefined) setIsKebijakan(!!draft.isKebijakan);
          if (draft.showParams !== undefined) setShowParams(!!draft.showParams);
        }
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
    if (pageLoading || !selectedPeriod) return;
    writeDraft(getDraftKey(selectedPeriod), {
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
      const aCode = String(a.code ?? a.id ?? "").trim();
      const bCode = String(b.code ?? b.id ?? "").trim();
      if (aCode && bCode) {
        // Try numeric comparison first (extract digits from code e.g. A1 -> 1)
        const aNum = parseInt(aCode.replace(/\D/g, ""), 10);
        const bNum = parseInt(bCode.replace(/\D/g, ""), 10);
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
        message: periodMeta.globalLocked
          ? "❌ Periode ini dikunci secara global oleh admin. Buka kunci di halaman Periode terlebih dahulu."
          : "❌ Alokasi Earmark telah difinalisasi. Buka kunci earmark terlebih dahulu untuk menghitung ulang.",
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
        message: periodMeta.globalLocked
          ? "❌ Periode ini dikunci secara global oleh admin. Buka kunci di halaman Periode terlebih dahulu."
          : "❌ Alokasi Earmark telah difinalisasi. Buka kunci earmark terlebih dahulu untuk menyimpan perubahan.",
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
        message: periodMeta.globalLocked
          ? "❌ Periode ini dikunci secara global oleh admin. Buka kunci di halaman Periode terlebih dahulu."
          : "❌ Alokasi Earmark telah difinalisasi.",
        type: "error",
      });
    }
    if (!result) return alert({ message: "Jalankan pra-kalkulasi dulu sebelum finalisasi.", type: "error" });
    if (Number(result.addKew ?? 0) <= 0) {
      return alert({
        message: "❌ Gagal Finalisasi: Sisa alokasi dana (ADD Kewenangan Kegiatan) bernilai Rp 0 atau negatif. Pagu Total Kabupaten (BKAD) harus lebih besar dari Total Potongan Wajib.",
        type: "error",
      });
    }
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
      clearDraft(getDraftKey(selectedPeriod));
      if (refreshPeriods) await refreshPeriods();
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal menyimpan pra-kalkulasi: " + (e?.message ?? e), type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const handleUnlockEarmark = async () => {
    if (!selectedPeriod) return alert({ message: "Pilih periode terlebih dahulu", type: "error" });
    if (periodMeta?.globalLocked) {
      return alert({
        message: "❌ Periode ini dikunci secara global oleh admin. Buka kunci di halaman Periode terlebih dahulu.",
        type: "error",
      });
    }
    const ok = await confirm({
      title: "Batal Finalisasi Earmark",
      message: "Apakah Anda yakin ingin membatalkan finalisasi alokasi earmark ini? Parameter akan dapat diubah dan dihitung ulang kembali.",
      confirmLabel: "Buka Kunci",
      cancelLabel: "Batal",
    });
    if (!ok) return;
    setRunning(true);
    try {
      await unlockPraKalkulasiResult(selectedPeriod);
      setPeriodMeta((prev) =>
        prev
          ? {
              ...prev,
              locked: false,
            }
          : null
      );
      if (refreshPeriods) await refreshPeriods();
      alert({ message: "Kunci alokasi earmark berhasil dibuka.", type: "info" });
    } catch (e) {
      console.error(e);
      alert({ message: "Gagal membuka kunci alokasi earmark: " + (e?.message ?? e), type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const handleExportExcel = () => {
    if (!result || !result.perVillage || !result.perVillage.length) {
      alert({ message: "Tidak ada data hasil untuk di-export.", type: "error" });
      return;
    }
    if (!bpkalConfigReady) {
      alert({ message: "Konfigurasi BPKal belum lengkap untuk periode ini.", type: "error" });
      return;
    }

    const periodYear = periods.find(p => p.id === selectedPeriod)?.year ?? selectedPeriod ?? "periode";
    const filename = `rincian-earmark-add-${periodYear}.xls`;

    // 1. Prepare system params for reconstruction
    const currentSystemParams = {
      umk_aktif: Number(systemParams.umk_aktif || 0),
      rate_bpjs_kes: Number(systemParams.rate_bpjs_kes || 0),
      rate_bpjs_naker: Number(systemParams.rate_bpjs_naker || 0),
      siltap_lurah: Number(systemParams.siltap_lurah || 0),
      siltap_carik: Number(systemParams.siltap_carik || 0),
      siltap_kasi: Number(systemParams.siltap_kasi || 0),
      siltap_dukuh: Number(systemParams.siltap_dukuh || 0),
      default_lurah_count: Number(systemParams.default_lurah_count || 1),
      default_carik_count: Number(systemParams.default_carik_count || 1),
      default_kasi_kaur_count: Number(systemParams.default_kasi_kaur_count || 6),
      bpjs_staff_count: Number(systemParams.bpjs_staff_count || 8),
    };

    const activeKebijakan = result.totals?.isKebijakan ?? result.totals?.is_kebijakan_active ?? isKebijakan;

    // 2. Reconstruct details and group by kecamatan
    const grouped = {};
    result.perVillage.forEach((row) => {
      let rowDetails = { ...row };
      if (row.tariffLurah === undefined || row.tariffLurah === null) {
        const reconstructed = computeVillageSums({
          village: {
            id: row.id,
            nama: row.nama ?? row.name,
            code: row.code,
            kecamatan: row.kecamatan,
            jumlah_dukuh: Number(row.jumlah_dukuh ?? row.siltapCount?.dukuh ?? 0),
            jumlah_bpkal: Number(row.jumlah_bpkal ?? row.bpkalCount ?? 0),
          },
          systemParameters: currentSystemParams,
          bpkalConfig,
        });
        rowDetails = { ...row, ...reconstructed };
      }

      rowDetails.addKeb = activeKebijakan ? Math.round(rowDetails.siltapPokok1 * 2) : 0;
      rowDetails.totalPotonganWajib = Number(rowDetails.addSil || 0) + Number(rowDetails.addKes || 0) + Number(rowDetails.addKer || 0) + Number(rowDetails.addBPKal || 0) + rowDetails.addKeb;

      const kec = String(rowDetails.kecamatan || "LAINNYA").toUpperCase().trim();
      if (!grouped[kec]) grouped[kec] = [];
      grouped[kec].push(rowDetails);
    });

    const compareByCode = (a, b) => {
      const aCode = String(a.code ?? a.id ?? "").trim();
      const bCode = String(b.code ?? b.id ?? "").trim();
      if (aCode && bCode) {
        // Try numeric comparison first (extract digits from code e.g. A1 -> 1)
        const aNum = parseInt(aCode.replace(/\D/g, ""), 10);
        const bNum = parseInt(bCode.replace(/\D/g, ""), 10);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        // Fallback to string comparison
        return aCode.localeCompare(bCode, undefined, { numeric: true });
      }
      if (aCode) return -1;
      if (bCode) return 1;
      return (a.nama || a.name || "").localeCompare(b.nama || b.name || "");
    };

    // Sort Kapanewon groups (kecKeys) by the minimum alternative code of their items to match Bupati Annex order (geographical)
    const kecKeys = Object.keys(grouped).sort((kecA, kecB) => {
      const minA = [...grouped[kecA]].sort(compareByCode)[0];
      const minB = [...grouped[kecB]].sort(compareByCode)[0];
      if (!minA) return 1;
      if (!minB) return -1;
      return compareByCode(minA, minB);
    });

    kecKeys.forEach((kec) => {
      grouped[kec].sort(compareByCode);
    });

    const createEmptyAccumulator = () => ({
      jumlah_dukuh: 0,
      siltapLurahYr: 0,
      siltapCarikYr: 0,
      siltapKasiYr: 0,
      siltapDukuhYr: 0,
      addSil: 0,
      jumlah_bpkal: 0,
      bpkalKetuaYr: 0,
      bpkalWakilYr: 0,
      bpkalSekretarisYr: 0,
      bpkalBidangYr: 0,
      bpkalAnggotaYr: 0,
      addBPKal: 0,
      addKes: 0,
      nakerLurah: 0,
      nakerCarik: 0,
      nakerKasi: 0,
      nakerDukuh: 0,
      nakerPamong: 0,
      nakerStaff: 0,
      addKer: 0,
      addKeb: 0,
      totalPotonganWajib: 0,
      addKewenanganKegiatan: 0
    });

    const accumulateRow = (acc, row) => {
      const siltapLurahYr = row.lurahCount * row.tariffLurah * 12;
      const siltapCarikYr = row.carikCount * row.tariffCarik * 12;
      const siltapKasiYr = row.kasiCount * row.tariffKasi * 12;
      const siltapDukuhYr = row.jumlah_dukuh * row.tariffDukuh * 12;
      
      const bpkalKetuaMth = row.bpkalKetua * row.bpkalTarifKetua;
      const bpkalWakilMth = row.bpkalWakil * row.bpkalTarifWakil;
      const bpkalSekretarisMth = row.bpkalSekretaris * row.bpkalTarifSekretaris;
      const bpkalBidangMth = row.bpkalBidang * row.bpkalTarifBidang;
      const bpkalAnggotaMth = row.bpkalAnggota * row.bpkalTarifAnggota;
      
      const bpkalKetuaYr = bpkalKetuaMth * 12;
      const bpkalWakilYr = bpkalWakilMth * 12;
      const bpkalSekretarisYr = bpkalSekretarisMth * 12;
      const bpkalBidangYr = bpkalBidangMth * 12;
      const bpkalAnggotaYr = bpkalAnggotaMth * 12;
      
      const nakerLurah = siltapLurahYr * row.rateBpjsNaker;
      const nakerCarik = siltapCarikYr * row.rateBpjsNaker;
      const nakerKasi = siltapKasiYr * row.rateBpjsNaker;
      const nakerDukuh = siltapDukuhYr * row.rateBpjsNaker;
      const nakerPamong = nakerLurah + nakerCarik + nakerKasi + nakerDukuh;
      const nakerStaff = row.addKerUmkPart;
      
      acc.jumlah_dukuh += Number(row.jumlah_dukuh || 0);
      acc.siltapLurahYr += siltapLurahYr;
      acc.siltapCarikYr += siltapCarikYr;
      acc.siltapKasiYr += siltapKasiYr;
      acc.siltapDukuhYr += siltapDukuhYr;
      acc.addSil += Number(row.addSil || 0);
      acc.jumlah_bpkal += Number(row.jumlah_bpkal || 0);
      acc.bpkalKetuaYr += bpkalKetuaYr;
      acc.bpkalWakilYr += bpkalWakilYr;
      acc.bpkalSekretarisYr += bpkalSekretarisYr;
      acc.bpkalBidangYr += bpkalBidangYr;
      acc.bpkalAnggotaYr += bpkalAnggotaYr;
      acc.addBPKal += Number(row.addBPKal || 0);
      acc.addKes += Number(row.addKes || 0);
      acc.nakerLurah += nakerLurah;
      acc.nakerCarik += nakerCarik;
      acc.nakerKasi += nakerKasi;
      acc.nakerDukuh += nakerDukuh;
      acc.nakerPamong += nakerPamong;
      acc.nakerStaff += nakerStaff;
      acc.addKer += Number(row.addKer || 0);
      acc.addKeb += Number(row.addKeb || 0);
      acc.totalPotonganWajib += Number(row.totalPotonganWajib || 0);
      acc.addKewenanganKegiatan += Number(row.addKewenanganKegiatan ?? row.alokasiFormula ?? 0);
    };

    const getExcelRowHtml = (no, name, row, isSubtotal = false, isTotal = false) => {
      const cellClass = isTotal ? 'bg-total font-bold' : isSubtotal ? 'bg-subtotal font-bold' : '';
      const numCellClass = `${cellClass} number-cell`;
      const currCellClass = `${cellClass} currency-cell`;
      
      if (isSubtotal || isTotal) {
        return `
          <tr>
            <td class="${cellClass} text-center" style="border: 1px solid black;">${no || ''}</td>
            <td class="${cellClass} text-left" style="border: 1px solid black;">${name}</td>
            
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            
            <td class="${numCellClass}" style="border: 1px solid black;">${row.jumlah_dukuh}</td>
            
            <td class="${currCellClass}" style="border: 1px solid black;">${row.siltapLurahYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.siltapCarikYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.siltapKasiYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.siltapDukuhYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.addSil}</td>
            
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            
            <td class="${numCellClass}" style="border: 1px solid black;">${row.jumlah_bpkal}</td>
            
            <td class="${currCellClass}" style="border: 1px solid black;">${row.bpkalKetuaYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.bpkalWakilYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.bpkalSekretarisYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.bpkalBidangYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.bpkalAnggotaYr}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.addBPKal}</td>
            
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${cellClass}" style="border: 1px solid black;">&nbsp;</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.addKes}</td>
            
            <td class="${currCellClass}" style="border: 1px solid black;">${row.nakerLurah}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.nakerCarik}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.nakerKasi}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.nakerDukuh}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.nakerPamong}</td>
            
            <td class="${currCellClass}" style="border: 1px solid black;">${row.nakerStaff}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.addKer}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.addKeb}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.totalPotonganWajib}</td>
            <td class="${currCellClass}" style="border: 1px solid black;">${row.addKewenanganKegiatan}</td>
          </tr>
        `;
      }
      
      const siltapLurahYr = row.lurahCount * row.tariffLurah * 12;
      const siltapCarikYr = row.carikCount * row.tariffCarik * 12;
      const siltapKasiYr = row.kasiCount * row.tariffKasi * 12;
      const siltapDukuhYr = row.jumlah_dukuh * row.tariffDukuh * 12;
      
      const bpkalKetuaMth = row.bpkalKetua * row.bpkalTarifKetua;
      const bpkalWakilMth = row.bpkalWakil * row.bpkalTarifWakil;
      const bpkalSekretarisMth = row.bpkalSekretaris * row.bpkalTarifSekretaris;
      const bpkalBidangMth = row.bpkalBidang * row.bpkalTarifBidang;
      const bpkalAnggotaMth = row.bpkalAnggota * row.bpkalTarifAnggota;
      
      const bpkalKetuaYr = bpkalKetuaMth * 12;
      const bpkalWakilYr = bpkalWakilMth * 12;
      const bpkalSekretarisYr = bpkalSekretarisMth * 12;
      const bpkalBidangYr = bpkalBidangMth * 12;
      const bpkalAnggotaYr = bpkalAnggotaMth * 12;
      
      const addKes1 = row.umk * row.rateBpjsKes;
      const addKes8 = addKes1 * row.bpjsStaffCount;
      
      const nakerLurah = siltapLurahYr * row.rateBpjsNaker;
      const nakerCarik = siltapCarikYr * row.rateBpjsNaker;
      const nakerKasi = siltapKasiYr * row.rateBpjsNaker;
      const nakerDukuh = siltapDukuhYr * row.rateBpjsNaker;
      const nakerPamong = nakerLurah + nakerCarik + nakerKasi + nakerDukuh;
      const nakerStaff = row.addKerUmkPart;
      
      return `
        <tr>
          <td class="text-center" style="border: 1px solid black;">${no}</td>
          <td class="text-left" style="border: 1px solid black;">${name}</td>
          
          <td class="currency-cell" style="border: 1px solid black;">${row.tariffLurah}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.tariffCarik}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.tariffKasi}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.tariffDukuh}</td>
          
          <td class="number-cell" style="border: 1px solid black;">${row.jumlah_dukuh}</td>
          
          <td class="currency-cell" style="border: 1px solid black;">${siltapLurahYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${siltapCarikYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${siltapKasiYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${siltapDukuhYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.addSil}</td>
          
          <td class="currency-cell" style="border: 1px solid black;">${bpkalKetuaMth}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalWakilMth}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalSekretarisMth}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalBidangMth}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalAnggotaMth}</td>
          
          <td class="number-cell" style="border: 1px solid black;">${row.jumlah_bpkal}</td>
          
          <td class="currency-cell" style="border: 1px solid black;">${bpkalKetuaYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalWakilYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalSekretarisYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalBidangYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${bpkalAnggotaYr}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.addBPKal}</td>
          
          <td class="currency-cell" style="border: 1px solid black;">${addKes1}</td>
          <td class="currency-cell" style="border: 1px solid black;">${addKes8}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.addKes}</td>
          
          <td class="currency-cell" style="border: 1px solid black;">${nakerLurah}</td>
          <td class="currency-cell" style="border: 1px solid black;">${nakerCarik}</td>
          <td class="currency-cell" style="border: 1px solid black;">${nakerKasi}</td>
          <td class="currency-cell" style="border: 1px solid black;">${nakerDukuh}</td>
          <td class="currency-cell" style="border: 1px solid black;">${nakerPamong}</td>
          
          <td class="currency-cell" style="border: 1px solid black;">${nakerStaff}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.addKer}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.addKeb}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.totalPotonganWajib}</td>
          <td class="currency-cell" style="border: 1px solid black;">${row.addKewenanganKegiatan ?? row.alokasiFormula ?? 0}</td>
        </tr>
      `;
    };

    const totalKab = createEmptyAccumulator();
    let rowsHtml = '';
    let globalIndex = 1;

    kecKeys.forEach((kec) => {
      rowsHtml += `
        <tr class="font-bold">
          <td style="border: 1px solid black; background-color: #f8fafc;">&nbsp;</td>
          <td colspan="36" style="border: 1px solid black; background-color: #f8fafc; text-align: left;">${kec}</td>
        </tr>
      `;

      const subTotal = createEmptyAccumulator();

      grouped[kec].forEach((village) => {
        rowsHtml += getExcelRowHtml(globalIndex++, village.nama ?? village.name, village);
        accumulateRow(subTotal, village);
        accumulateRow(totalKab, village);
      });

      rowsHtml += getExcelRowHtml('', `Jumlah ${kec}`, subTotal, true, false);
      // Empty separator row between Kapanewon groups
      rowsHtml += `
        <tr style="height: 20px; border: none;">
          <td colspan="37" style="border: none; background-color: transparent;">&nbsp;</td>
        </tr>
      `;
    });

    rowsHtml += getExcelRowHtml('', 'TOTAL KABUPATEN', totalKab, false, true);

    const bpjsStaffCount = currentSystemParams.bpjs_staff_count;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Alokasi Earmark</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Times New Roman', serif; }
          .title { text-align: center; font-size: 12pt; font-weight: bold; }
          table { border-collapse: collapse; }
          th { border: 1px solid black; background-color: #cbd5e1; font-weight: bold; text-align: center; vertical-align: middle; font-size: 9pt; }
          td { border: 1px solid black; font-size: 9pt; vertical-align: middle; }
          .number-cell { mso-number-format:"\\#\\,\\#\\#0"; text-align: right; }
          .currency-cell { mso-number-format:"\\#\\,\\#\\#0\\.00"; text-align: right; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .bg-subtotal { background-color: #f1f5f9; }
          .bg-total { background-color: #cbd5e1; }
        </style>
      </head>
      <body>
        <table style="border:none; border-collapse:collapse; width:100%;">
          <tr style="border:none;"><td colspan="37" style="border:none;" class="title">RINCIAN PERHITUNGAN ALOKASI EARMARK DANA DESA (ADD)</td></tr>
          <tr style="border:none;"><td colspan="37" style="border:none;" class="title">TAHUN ANGGARAN ${periodYear}</td></tr>
          <tr style="border:none;"><td colspan="37" style="border:none;">&nbsp;</td></tr>
        </table>

        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 50px;">NO.</th>
              <th rowspan="2" style="width: 200px;">KAPANEWON/<br/>KALURAHAN</th>
              <th colspan="4">SILTAP PER BULAN</th>
              <th rowspan="2" style="width: 100px;">JUMLAH DUKUH</th>
              <th colspan="5">SILTAP PER TAHUN</th>
              <th colspan="5">TUNJANGAN BPKAL PER BULAN</th>
              <th rowspan="2" style="width: 100px;">JUMLAH BPKAL</th>
              <th colspan="6">TUNJANGAN BPKAL PER TAHUN</th>
              <th colspan="3">BPJS KES STAF</th>
              <th colspan="5">BPJS NAKER LURAH & PAMONG KALURAHAN</th>
              <th rowspan="2" style="width: 150px;">BPJS NAKER STAF</th>
              <th rowspan="2" style="width: 150px;">BPJS NAKER TOTAL</th>
              <th rowspan="2" style="width: 180px;">ADD KEBIJAKAN<br/>(THR & KP 13)</th>
              <th rowspan="2" style="width: 180px;">TOTAL POTONGAN WAJIB</th>
              <th rowspan="2" style="width: 200px;">ADD KEWENANGAN KEGIATAN</th>
            </tr>
            <tr>
              <th>LURAH</th>
              <th>CARIK</th>
              <th>KASI/KAUR</th>
              <th>DUKUH</th>
              
              <th>LURAH</th>
              <th>CARIK</th>
              <th>KASI/KAUR</th>
              <th>DUKUH</th>
              <th>JUMLAH</th>
              
              <th>KETUA</th>
              <th>WAKIL</th>
              <th>SEKRETARIS</th>
              <th>BIDANG</th>
              <th>ANGGOTA</th>
              
              <th>KETUA</th>
              <th>WAKIL</th>
              <th>SEKRETARIS</th>
              <th>BIDANG</th>
              <th>ANGGOTA</th>
              <th>JUMLAH</th>
              
              <th>1 org/bln</th>
              <th>${bpjsStaffCount} org/bln</th>
              <th>${bpjsStaffCount} org/12 bln</th>
              
              <th>LURAH</th>
              <th>CARIK</th>
              <th>KASI/KAUR</th>
              <th>DUKUH</th>
              <th>JUMLAH</th>
            </tr>
            <tr style="background-color: #f1f5f9; font-weight: bold; text-align: center;">
              <td style="border: 1px solid black;" class="text-center">1</td>
              <td style="border: 1px solid black;" class="text-center">2</td>
              <td style="border: 1px solid black;" class="text-center">3</td>
              <td style="border: 1px solid black;" class="text-center">4</td>
              <td style="border: 1px solid black;" class="text-center">5</td>
              <td style="border: 1px solid black;" class="text-center">6</td>
              <td style="border: 1px solid black;" class="text-center">7</td>
              <td style="border: 1px solid black;" class="text-center">8 = 3 * 12</td>
              <td style="border: 1px solid black;" class="text-center">9 = 4 * 12</td>
              <td style="border: 1px solid black;" class="text-center">10 = 5 * 12</td>
              <td style="border: 1px solid black;" class="text-center">11 = 6 * 7 * 12</td>
              <td style="border: 1px solid black;" class="text-center">12 = 8+9+10+11</td>
              <td style="border: 1px solid black;" class="text-center">13</td>
              <td style="border: 1px solid black;" class="text-center">14</td>
              <td style="border: 1px solid black;" class="text-center">15</td>
              <td style="border: 1px solid black;" class="text-center">16</td>
              <td style="border: 1px solid black;" class="text-center">17</td>
              <td style="border: 1px solid black;" class="text-center">18</td>
              <td style="border: 1px solid black;" class="text-center">19 = 13 * 12</td>
              <td style="border: 1px solid black;" class="text-center">20 = 14 * 12</td>
              <td style="border: 1px solid black;" class="text-center">21 = 15 * 12</td>
              <td style="border: 1px solid black;" class="text-center">22 = 16 * 12</td>
              <td style="border: 1px solid black;" class="text-center">23 = 17 * 12</td>
              <td style="border: 1px solid black;" class="text-center">24 = 19+20+21+22+23</td>
              <td style="border: 1px solid black;" class="text-center">25 = UMK * rate</td>
              <td style="border: 1px solid black;" class="text-center">26 = 25 * ${bpjsStaffCount}</td>
              <td style="border: 1px solid black;" class="text-center">27 = 26 * 12</td>
              <td style="border: 1px solid black;" class="text-center">28 = 8 * rate</td>
              <td style="border: 1px solid black;" class="text-center">29 = 9 * rate</td>
              <td style="border: 1px solid black;" class="text-center">30 = 10 * rate</td>
              <td style="border: 1px solid black;" class="text-center">31 = 11 * rate</td>
              <td style="border: 1px solid black;" class="text-center">32 = 28+29+30+31</td>
              <td style="border: 1px solid black;" class="text-center">33 = UMK*rate*${bpjsStaffCount}*12</td>
              <td style="border: 1px solid black;" class="text-center">34 = 32+33</td>
              <td style="border: 1px solid black;" class="text-center">35 = monthly*2</td>
              <td style="border: 1px solid black;" class="text-center">36 = 12+24+27+34+35</td>
              <td style="border: 1px solid black;" class="text-center">37 = Pagu - 36</td>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert({ message: "Excel berhasil diunduh!", type: "info" });
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
      <div className="page-header-container">
        <div className="page-header">
          <h1 className="page-title">Alokasi Earmark</h1>
          <p className="page-subtitle">
            Lakukan pra-kalkulasi potongan wajib ADD Kabupaten (ADDSil, ADDKes, ADDKer, ADDKeb, dan Tunjangan BPKal) berdasarkan parameter alokasi earmark.
          </p>
        </div>
      </div>

      {periodMeta?.locked && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 shadow-sm mb-4 ${
          periodMeta.globalLocked 
            ? "border-red-200 bg-red-50 text-red-950" 
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}>
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 shrink-0 ${periodMeta.globalLocked ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              {periodMeta.globalLocked ? (
                <>
                  <p className="text-sm font-semibold">Periode Terkunci (Global)</p>
                  <p className="text-xs text-red-700">Periode ini telah dikunci oleh admin secara keseluruhan. Semua parameter dan perhitungan bersifat final dan tidak dapat diubah kecuali status kunci dibuka kembali di menu <span className="font-semibold">Periode</span>.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">Alokasi Earmark Telah Final & Terkunci</p>
                  <p className="text-xs text-amber-700">Hasil alokasi earmark untuk periode ini telah difinalisasi dan dikirim ke MOORA. Parameter dinonaktifkan untuk menjaga konsistensi data. Anda dapat membuka kembali kunci finalisasi ini jika ingin melakukan penyesuaian.</p>
                </>
              )}
            </div>
          </div>
          {!periodMeta.globalLocked && (
            <button
              type="button"
              onClick={handleUnlockEarmark}
              disabled={running}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100/50 disabled:opacity-50 shrink-0 shadow-sm"
            >
              🔓 Buka Kunci Earmark
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StatCard title="Total Kalurahan" value={formatInteger(summary.totalDesa)} subtitle="Kalurahan yang ikut dihitung" />
        <StatCard title="Total Dukuh" value={formatInteger(summary.totalDukuh)} subtitle="Akumulasi dukuh seluruh alternatif" />
        <StatCard title="Total BPKal" value={formatRp(summary.addBPKal)} subtitle="Potongan wajib khusus BPKal" />
        <StatCard title="Total Potongan Wajib" value={formatRp(summary.totalPotonganWajib)} subtitle="Siltap + BPJS + Kebijakan + BPKal" />
        <StatCard
          title="Sisa Alokasi"
          value={formatRp(summary.sisaAlokasi)}
          subtitle={summary.sisaAlokasi <= 0 ? "⚠️ Pagu BKAD Defisit/Kurang!" : "ADDKew yang dibawa ke MOORA"}
          isDanger={summary.sisaAlokasi <= 0}
        />
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
                    className="btn-action rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 shrink-0"
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
              className="btn-action rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Memproses..." : "Eksekusi Otomasi Pra-Kalkulasi"}
            </button>
            <button
              onClick={() => setResult(null)}
              disabled={periodMeta?.locked}
              className="btn-secondary rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Preview Hasil per Kalurahan</h2>
            <p className="text-sm text-slate-500">Tabel diringkas menjadi 10 kolom utama sesuai kebutuhan operasional.</p>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="btn-secondary inline-flex items-center gap-1.5"
              >
                <Download size={16} /> Export Excel
              </button>
            )}
            {result && !periodMeta?.locked && (
              <button
                type="button"
                onClick={handleFinalize}
                className="btn-action rounded-xl px-4 py-2 text-sm font-semibold transition"
              >
                Finalisasi & Kirim ke MOORA
              </button>
            )}
          </div>
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
