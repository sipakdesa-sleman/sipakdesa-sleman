// src/pages/PerhitunganMOORA.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { attachNominalAllocation, calculateMOORA, getScore } from "../utils/moora";
import { getCriteriaTypes } from "../services/mooraService";
import { getAllCriteria } from "../services/criteriaService";
import { getAllParameters } from "../services/parametersService";
import { formatDecimalDisplay } from "../utils/numberFormat";
import { getAHPCriteriaWeights, getLatestAhpMeta, getAhpRuns, getAhpRunById } from "../services/ahpService";
import { getAllDesa, getVillagesWithPeriodData } from "../services/desaService";
import { saveMooraResults } from "../services/resultService";
import { updatePeriodStatus, setActivePeriod } from "../services/periodService";
import PeriodSelector from "../components/PeriodSelector";

import { useDialog } from "../context/DialogProvider";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";
import { useNavigate } from "react-router-dom";

import { clearDraft, readDraft, writeDraft } from "../utils/draftStorage";
import { usePeriod } from "../context/PeriodContext";
import { PageSkeleton } from "../components/SkeletonLoader";
import { IntegerInput, DecimalInput } from "../components/NumericInput";

const getDraftKey = (periodId) => periodId ? `sipakdesa:draft:moora:${periodId}` : null;



const formatNumber = (value, digits = 4) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value));
};

function compareByCodeThenName(a, b) {
  const aCode = String(a.code ?? "").trim();
  const bCode = String(b.code ?? "").trim();
  if (aCode && bCode) {
    const aNum = parseInt(aCode, 10);
    const bNum = parseInt(bCode, 10);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return aCode.localeCompare(bCode, undefined, { numeric: true });
  }
  if (aCode) return -1;
  if (bCode) return 1;
  return String(a.nama ?? a.name ?? "").localeCompare(String(b.nama ?? b.name ?? ""), undefined, { numeric: true });
}

export default function PerhitunganMOORA() {
  const { selectedPeriod, setSelectedPeriod, periods, refreshPeriods } = usePeriod();

  const selectedPeriodData = useMemo(() => {
    return periods.find((p) => String(p.id ?? p.year) === String(selectedPeriod));
  }, [periods, selectedPeriod]);

  const allocationPool = useMemo(() => {
    if (!selectedPeriodData) return 0;
    return Number(selectedPeriodData.praKalkulasiResult?.addKew ?? selectedPeriodData.praKalkulasiResult?.summary?.sisaAlokasi ?? 0);
  }, [selectedPeriodData]);

  const [criteria, setCriteria] = useState([]);

  const [weights, setWeights] = useState({});
  const [ahpId, setAhpId] = useState(null);
  const [ahpMeta, setAhpMeta] = useState(null);
  const [criteriaTypes, setCriteriaTypes] = useState({});
  const [desaList, setDesaList] = useState([]);
  const [selectedDesaIds, setSelectedDesaIds] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [results, setResults] = useState([]);
  const [detail, setDetail] = useState(null);
  const [ahpRuns, setAhpRuns] = useState([]);
  const [selectedAhpRun, setSelectedAhpRun] = useState("");
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchDesa, setSearchDesa] = useState("");
  const [showDetail, setShowDetail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingRawFromDesa, setLoadingRawFromDesa] = useState(false);
  const [parameters, setParameters] = useState([]);
  const { alert } = useDialog();
  const { markDirty, clearDirty } = useUnsavedChanges();
  const [draftReady, setDraftReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [criteriaData, desaData, paramData, parametersData] = await Promise.all([
        getAllCriteria(),
        getAllDesa(),
        getCriteriaTypes().catch(() => ({})),
        getAllParameters().catch(() => []),
      ]);

      setCriteria(criteriaData);
      setCriteriaTypes(paramData ?? {});
      setParameters(parametersData);
      const sortedDesa = [...desaData].sort(compareByCodeThenName);

      setDesaList(sortedDesa);

      const initialIds = sortedDesa.map(d => d.id);
      setSelectedDesaIds(initialIds);
      setAlternatives(
        sortedDesa.map(d => ({
          id: d.id,
          code: d.code ?? null,
          name: d.nama ?? d.name ?? "Kalurahan",
          kecamatan: d.kecamatan ?? ""
        }))
      );

      setDraftReady(true);
      clearDirty();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [clearDirty]);

  useEffect(() => {
    if (refreshPeriods) refreshPeriods();
  }, [refreshPeriods]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!draftReady || !selectedPeriod) return;
    writeDraft(getDraftKey(selectedPeriod), {
      selectedPeriod,
      selectedDesaIds,
      alternatives,
      showDropdown,
      searchDesa,
      showDetail,
    });
  }, [draftReady, selectedPeriod, selectedDesaIds, alternatives, showDropdown, searchDesa, showDetail]);

  useEffect(() => {
    setSelectedAhpRun("");
  }, [selectedPeriod]);

  useEffect(() => {
    const loadRuns = async () => {
      if (!selectedPeriod) {
        setAhpRuns([]);
        return;
      }

      const runs = await getAhpRuns(selectedPeriod).catch(() => []);
      const sortedRuns = [...(runs || [])].sort((a, b) => {
        const aTime = a.created_at?.seconds ?? a.createdAt?.seconds ?? 0;
        const bTime = b.created_at?.seconds ?? b.createdAt?.seconds ?? 0;
        return bTime - aTime;
      });
      setAhpRuns(sortedRuns);

      const currentExists = selectedAhpRun && sortedRuns.some((run) => (run.runId ?? run.id) === selectedAhpRun);
      if (sortedRuns.length > 1 && !currentExists) {
        setSelectedAhpRun(sortedRuns[0].runId ?? sortedRuns[0].id ?? "");
      }
      if (sortedRuns.length <= 1) {
        setSelectedAhpRun("");
      }
    };

    loadRuns();
  }, [selectedPeriod, selectedAhpRun]);

  // Load raw values from Data Desa for the selected period and merge into alternatives
  const loadRawFromDesa = useCallback(async (period, showAlert = true) => {
    if (!period) return;
    setLoadingRawFromDesa(true);
    try {
      const villagesWithPeriod = await getVillagesWithPeriodData(period);
      
      if (!villagesWithPeriod || villagesWithPeriod.length === 0) {
        if (showAlert) alert({ message: "Tidak ditemukan data mentah di Data Kalurahan untuk periode ini.", type: "info" });
        return;
      }

      setAlternatives(prev => prev.map(alt => {
        const match = villagesWithPeriod.find(v => v.id === alt.id);
        if (!match) return alt;
        
        const dynamicValues = {};
        criteria.forEach(c => {
          const codeUpper = String(c.code).toUpperCase();
          const codeLower = String(c.code).toLowerCase();
          dynamicValues[codeUpper] = match[codeUpper] ?? match[codeLower] ?? 0;
          dynamicValues[codeLower] = match[codeUpper] ?? match[codeLower] ?? 0;
        });

        return {
          ...alt,
          ...dynamicValues,
          jumlah_bpkal: match.jumlah_bpkal,
        };
      }));

      if (showAlert) alert({ message: "Matriks nilai mentah berhasil diambil dari Data Kalurahan.", type: "success" });
    } catch (err) {
      console.error(err);
      if (showAlert) alert({ message: "Gagal mengambil data mentah dari Data Kalurahan.", type: "error" });
    } finally {
      setLoadingRawFromDesa(false);
    }
  }, [alert, criteria]);

  useEffect(() => {
    if (!selectedPeriod || !draftReady) return;
    
    const draft = readDraft(getDraftKey(selectedPeriod));
    if (draft && String(draft.selectedPeriod) === String(selectedPeriod)) {
      if (Array.isArray(draft.selectedDesaIds)) setSelectedDesaIds(draft.selectedDesaIds);
      if (Array.isArray(draft.alternatives)) setAlternatives(draft.alternatives);
      if (draft.showDropdown !== undefined) setShowDropdown(!!draft.showDropdown);
      if (draft.searchDesa !== undefined) setSearchDesa(String(draft.searchDesa ?? ""));
      if (draft.showDetail !== undefined) setShowDetail(!!draft.showDetail);
    } else {
      // auto-load when period changes and no draft exists
      loadRawFromDesa(selectedPeriod, false).catch(() => {});
    }
  }, [selectedPeriod, draftReady, loadRawFromDesa]);

  useEffect(() => {
    const loadWeights = async () => {
      if (!selectedPeriod) {
        setWeights({});
        setAhpId(null);
        setAhpMeta(null);
        return;
      }

      if (selectedAhpRun) {
        const run = await getAhpRunById(selectedPeriod, selectedAhpRun).catch(() => null);
        if (run) {
          setWeights(run.weights ?? {});
          setAhpId(run.runId ?? null);
          setAhpMeta({ CR: run.CR ?? null, period: run.period ?? selectedPeriod });
          return;
        }
      }

      const weightsResult = await getAHPCriteriaWeights(selectedPeriod);
      const weightsObj = weightsResult.weights ?? weightsResult ?? {};
      const ahpResultId = weightsResult.ahpId ?? null;
      setWeights(weightsObj);
      setAhpId(ahpResultId);

      const meta = await getLatestAhpMeta(selectedPeriod);
      setAhpMeta(meta);
    };

    loadWeights();
  }, [selectedPeriod, selectedAhpRun]);

  const handleChange = (id, code, value) => {
    const normalizedKey = code.toLowerCase();
    markDirty();

    const cObj = criteria.find(c => String(c.code).toUpperCase() === String(code).toUpperCase());
    const isQualitative = cObj?.nature === "kualitatif";
    const processedValue = isQualitative
      ? value
      : (value === "" ? "" : Number(value));

    setAlternatives(prev =>
      prev.map(alt =>
        alt.id === id
          ? {
              ...alt,
              [code]: processedValue,
              [normalizedKey]: processedValue
            }
          : alt
      )
    );
  };

  const toggleDesaSelection = desa => {
    markDirty();
    setSelectedDesaIds(prev => {
      const exists = prev.includes(desa.id);
      const nextIds = exists
        ? prev.filter(id => id !== desa.id)
        : [...prev, desa.id];

      setAlternatives(prevAlt => {
        const map = new Map(prevAlt.map(a => [a.id, a]));
        if (!exists && !map.has(desa.id)) {
          map.set(desa.id, {
            id: desa.id,
            code: desa.code ?? null,
            name: desa.nama ?? desa.name ?? "Kalurahan",
            kecamatan: desa.kecamatan ?? ""
          });
        }

        // Susun data lalu urutkan konsisten berdasarkan code
        const nextAlternatives = nextIds.map(id => {
          if (map.has(id)) return map.get(id);
          const ref = desaList.find(d => d.id === id);
          return {
            id,
            code: ref?.code ?? null,
            name: ref?.nama ?? ref?.name ?? "Kalurahan",
            kecamatan: ref?.kecamatan ?? ""
          };
        });
        return nextAlternatives.sort(compareByCodeThenName);
      });

      setResults([]);
      setDetail(null);
      return nextIds;
    });
  };

  const toggleSelectAll = () => {
    markDirty();
    if (selectedDesaIds.length === desaList.length) {
      setSelectedDesaIds([]);
      setAlternatives([]);
      setResults([]);
      setDetail(null);
      return;
    }

    const ids = desaList.map(d => d.id);
    setSelectedDesaIds(ids);
    setAlternatives(
      desaList.map(d => ({
        id: d.id,
        code: d.code ?? null,
        name: d.nama ?? d.name ?? "Kalurahan",
        kecamatan: d.kecamatan ?? ""
      }))
    );
    setResults([]);
    setDetail(null);
  };

  const selectedAlternatives = useMemo(
    () => alternatives.filter(a => selectedDesaIds.includes(a.id)).sort(compareByCodeThenName),
    [alternatives, selectedDesaIds]
  );

  const hasWeights = useMemo(
    () => Object.keys(weights || {}).length > 0,
    [weights]
  );

  const filteredDesaList = useMemo(() => {
    const q = searchDesa.trim().toLowerCase();
    if (!q) return desaList;
    return desaList.filter(d => {
      const nama = (d.nama ?? d.name ?? "").toLowerCase();
      const kec = (d.kecamatan ?? "").toLowerCase();
      return nama.includes(q) || kec.includes(q);
    });
  }, [desaList, searchDesa]);

  const buildMooraDetail = async (alts, weightsObj) => {
    const { fetchParameterRanges } = await import("../utils/moora");
    const parameterRanges = await fetchParameterRanges();

    const codes = criteria.length
      ? criteria.map(c => c.code)
      : Object.keys(weightsObj ?? {});

    const typeMap = codes.reduce((acc, code) => {
      const rawType = criteriaTypes?.[code];
      const normalized = rawType === null || rawType === undefined || rawType === ""
        ? null
        : String(rawType).toLowerCase();
      acc[code] = normalized === "cost" || normalized === "benefit" ? normalized : null;
      return acc;
    }, {});

    const missingTypes = codes.filter((code) => !typeMap[code]);
    if (missingTypes.length > 0) {
      throw new Error(`Tipe kriteria belum lengkap untuk: ${missingTypes.join(", ")}.`);
    }

    const withScores = alts.map(alt => {
      const rawValues = {};
      const scores = {};
      codes.forEach(code => {
        const key = code.toLowerCase();
        const rawVal = alt[code] ?? alt[key] ?? "";
        const cObj = criteria.find(c => String(c.code).toUpperCase() === String(code).toUpperCase());
        const isQualitative = cObj?.nature === "kualitatif";
        const value = isQualitative ? String(rawVal) : (rawVal === "" ? 0 : Number(rawVal));
        rawValues[code] = value;
        if (isQualitative) {
          scores[code] = getScore(value, code, parameterRanges);
        } else {
          scores[code] = value;
        }
      });
      return { ...alt, rawValues, scores };
    });

    const denominators = {};
    codes.forEach(code => {
      const sumSquares = withScores.reduce(
        (sum, alt) => sum + Math.pow(alt.scores[code] ?? 0, 2),
        0
      );
      denominators[code] = Math.sqrt(sumSquares || 0);
    });

    const normalizedMatrix = withScores.map(alt => {
      const values = {};
      codes.forEach(code => {
        const denom = denominators[code] || 1;
        values[code] = denom ? (alt.scores[code] ?? 0) / denom : 0;
      });
      return { id: alt.id, name: alt.name, values };
    });

    const weightedMatrix = withScores.map(alt => {
      const values = {};
      codes.forEach(code => {
        const denom = denominators[code] || 1;
        const normalized = denom ? (alt.scores[code] ?? 0) / denom : 0;
        values[code] = normalized * (weightsObj?.[code] ?? 0);
      });
      return { id: alt.id, name: alt.name, values };
    });

    const yiRows = withScores.map(alt => {
      let benefit = 0;
      let cost = 0;
      codes.forEach(code => {
        const denom = denominators[code] || 1;
        const normalized = denom ? (alt.scores[code] ?? 0) / denom : 0;
        const weighted = normalized * (weightsObj?.[code] ?? 0);
        if (typeMap[code] === "cost") {
          cost += weighted;
        } else {
          benefit += weighted;
        }
      });
      return { id: alt.id, name: alt.name, benefit, cost, yi: benefit - cost };
    });

    return {
      codes,
      typeMap,
      denominators,
      rawMatrix: withScores.map(({ id, name, rawValues }) => ({ id, name, values: rawValues })),
      scoreMatrix: withScores.map(({ id, name, scores }) => ({ id, name, values: scores })),
      normalizedMatrix,
      weightedMatrix,
      yiRows
    };
  };

  const calculate = async () => {
    if (!selectedAlternatives.length) return;
    if (!selectedPeriod) {
      alert({ message: "Pilih periode terlebih dahulu", type: "error" });
      return;
    }
    
    // Validasi: periode harus aktif
    const selectedPeriodData = periods.find(p => (p.id ?? p.year) === selectedPeriod);
    if (!selectedPeriodData) {
      alert({ message: "Periode yang dipilih tidak ditemukan. Silakan pilih periode yang sudah dibuat di halaman Periode.", type: "error" });
      return;
    }
    if (!selectedPeriodData.isActive && !selectedPeriodData.active) {
      alert({ message: "❌ Hanya periode AKTIF yang bisa digunakan untuk MOORA.\n\nPeriode yang Anda pilih tidak aktif. Hubungi admin atau gunakan periode aktif terbaru.", type: "error" });
      return;
    }
    // Prevent MOORA when period locked
    if (selectedPeriodData.locked) {
      alert({ message: "❌ Periode ini dikunci oleh admin. Buka kunci di halaman Periode untuk menjalankan MOORA.", type: "error" });
      return;
    }

    // Validasi: pra-kalkulasi harus sudah dijalankan untuk periode ini
    if (!selectedPeriodData.praKalkulasiDone) {
      alert({ message: "❌ Pra-Kalkulasi belum dijalankan untuk periode ini. Jalankan Pra-Kalkulasi terlebih dahulu sebelum menghitung MOORA.", type: "error" });
      return;
    }

    // Validasi: sisa alokasi tidak boleh negatif atau 0
    if (allocationPool <= 0) {
      alert({
        message: `❌ Perhitungan Dibatalkan: Sisa alokasi dana (ADD Kewenangan Kegiatan) untuk periode ini bernilai Rp ${new Intl.NumberFormat("id-ID").format(allocationPool)} atau kurang.\n\nSilakan buka kembali kunci earmark di menu Alokasi Earmark dan tingkatkan nominal Pagu Kabupaten terlebih dahulu.`,
        type: "error",
      });
      return;
    }
    
    if (!hasWeights) {
      alert({ message: "Belum ada bobot AHP aktif untuk periode ini. Buat/simpan bobot AHP periode tersebut dahulu.", type: "error" });
      return;
    }
    
    // Validasi: matriks data desa harus diisi minimal ada satu nilai
    const hasData = selectedAlternatives.some(alt => 
      Object.keys(alt).some(key => {
        const keyUpper = key.toUpperCase();
        if (!keyUpper.startsWith('C')) return false;
        const cObj = criteria.find(c => String(c.code).toUpperCase() === keyUpper);
        const isQualitative = cObj?.nature === "kualitatif";
        const val = alt[key];
        if (isQualitative) {
          return val !== undefined && val !== null && String(val).trim() !== "";
        } else {
          return val !== undefined && val !== null && val !== "" && Number(val) > 0;
        }
      })
    );
    
    if (!hasData) {
      alert({ message: "❌ Matriks data kalurahan masih kosong!\n\nSilakan isi nilai kriteria (C1-C6) untuk setiap kalurahan yang dipilih sebelum menghitung MOORA.", type: "error" });
      return;
    }

    try {
      setSaving(true);
      const periodId = String(selectedPeriod);
      const periodRecord = periods.find(p => String(p.id ?? p.year) === periodId);
      const allocationPool = Number(periodRecord?.praKalkulasiResult?.addKew ?? periodRecord?.praKalkulasiResult?.summary?.sisaAlokasi ?? 0);

      const ranked = attachNominalAllocation(
        (await calculateMOORA(selectedAlternatives, weights, criteriaTypes))
          .sort((a, b) => Number(b.yi ?? 0) - Number(a.yi ?? 0))
          .map((r, idx) => ({ ...r, rank: idx + 1 })),
        allocationPool
      );
      const detailData = await buildMooraDetail(selectedAlternatives, weights);
      setResults(ranked);
      setDetail(detailData);
      setShowDetail(true);
      setShowDropdown(false);

      const saved = await saveMooraResults({ periodId, rankings: ranked, ahpId, detail: detailData });
      await updatePeriodStatus(periodId, { mooraDone: true, isActive: true, active: true });
      await setActivePeriod(periodId);

      clearDirty();
      clearDraft(getDraftKey(selectedPeriod));
      
      // Refresh global periods to reflect active status change
      await refreshPeriods();
      // Navigate to results page for the new run automatically
      if (saved?.runId) {
        navigate(`/peringkat?period=${encodeURIComponent(periodId)}&run=${encodeURIComponent(saved.runId)}`);
      }
    } catch (err) {
      console.error("Gagal menyimpan hasil MOORA", err);
      alert({ message: "Gagal menyimpan hasil MOORA. Coba lagi.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          <h1 className="page-title">Alokasi Kegiatan (MOORA)</h1>
          <p className="page-subtitle">
            Hitung prioritas dan perangkingan alokasi dana desa (ADD) kalurahan menggunakan metode MOORA dengan bobot kriteria dari AHP.
          </p>
        </div>
      </div>

      {/* Banner info */}
      <div className="panel-info p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center">
          <Info size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Tentang Metode MOORA</p>
          <p className="text-sm text-blue-800">
            MOORA memperhitungkan beberapa atribut secara bersamaan dengan menimbang nilai optimasi Yi = Σ(Y benefit) - Σ(Y cost). Semakin tinggi nilai Yi, semakin prioritas kalurahan tersebut.
          </p>
        </div>
      </div>

      {selectedPeriodData?.praKalkulasiDone && allocationPool <= 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-900">Sisa Alokasi Defisit / Kurang (Rp 0 atau kurang)</p>
            <p className="text-xs text-red-700 leading-relaxed font-normal">
              Sisa alokasi dana desa (ADD Kewenangan Kegiatan) untuk periode ini bernilai Rp {new Intl.NumberFormat("id-ID").format(allocationPool)}. 
              Perhitungan MOORA tidak dapat dijalankan. Silakan masuk ke menu <strong>Alokasi Earmark</strong> untuk menyesuaikan Pagu Total Kabupaten terlebih dahulu.
            </p>
          </div>
        </div>
      )}

      <div className="panel bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <h3 className="text-sm font-semibold text-slate-800">Pilih Periode Perhitungan</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pilih periode yang akan digunakan untuk perhitungan MOORA. Pemilihan periode ini juga akan menarik data kriteria kalurahan, sisa alokasi dana desa (Pra-Kalkulasi), dan bobot kriteria AHP dari periode terpilih.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-sm font-semibold text-slate-700">Periode:</span>
            <PeriodSelector
              value={selectedPeriod}
              onChange={(v) => setSelectedPeriod(v)}
              filter={(p) => p.ahpDone === true}
              runs={ahpRuns}
              selectedRun={selectedAhpRun}
              onRunChange={setSelectedAhpRun}
              showRunSelector={ahpRuns.length > 1}
            />
          </div>
        </div>
      </div>

      {selectedPeriod && (() => {
        const p = periods.find(pp => (pp.id ?? pp.year) === selectedPeriod);
        if (!p) return null;
        return (
          <div className="mt-3">
            {p.needs_recalc && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">Perhatian: Periode ini ditandai membutuhkan recalculation karena perubahan master data. Bersihkan flag di halaman Periode sebelum melanjutkan.</div>
            )}
            {!p.praKalkulasiDone && (
              <div className="text-sm text-rose-800 bg-rose-50 border border-rose-100 rounded-md px-3 py-2 mt-2">Perhatian: Pra-Kalkulasi belum dijalankan untuk periode ini. Jalankan Pra-Kalkulasi dulu.</div>
            )}
            {p.locked && (
              <div className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-md px-3 py-2 mt-2">Perhatian: Periode dikunci (locked). Buka kunci di halaman Periode untuk menjalankan perhitungan.</div>
            )}
          </div>
        );
      })()}

      <div className="panel-indigo p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-600 font-medium">Bobot kriteria hasil AHP</p>
            <h2 className="text-lg font-bold text-indigo-900">Bobot Kriteria dari AHP</h2>
          </div>
          <p className="text-xs text-indigo-600 font-medium">Nilai Yi = Σ(Y benefit) - Σ(Y cost)</p>
        </div>

        {!hasWeights && selectedPeriod && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span className="font-semibold">Perhatian:</span>
            <span>Belum ada bobot AHP aktif untuk periode {selectedPeriod}. Simpan bobot AHP periode ini dulu.</span>
          </div>
        )}

        {hasWeights && (
          <div className="flex items-center gap-3 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
            <span className="font-semibold">Bobot yang dipakai:</span>
            <span>Periode {ahpMeta?.period ?? selectedPeriod ?? "-"}</span>
            <span className="text-indigo-600">CR: {ahpMeta?.CR != null ? ahpMeta.CR.toFixed(3) : "-"}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {criteria.map((c, idx) => {
            // Warna gradasi untuk setiap card
            const colors = [
              { bg: 'from-purple-50 to-purple-100', border: 'border-purple-200', badge: 'bg-purple-600 text-white', text: 'text-purple-900', weight: 'text-purple-700' },
              { bg: 'from-blue-50 to-blue-100', border: 'border-blue-200', badge: 'bg-blue-600 text-white', text: 'text-blue-900', weight: 'text-blue-700' },
              { bg: 'from-green-50 to-green-100', border: 'border-green-200', badge: 'bg-green-600 text-white', text: 'text-green-900', weight: 'text-green-700' },
              { bg: 'from-amber-50 to-amber-100', border: 'border-amber-200', badge: 'bg-amber-600 text-white', text: 'text-amber-900', weight: 'text-amber-700' },
              { bg: 'from-rose-50 to-rose-100', border: 'border-rose-200', badge: 'bg-rose-600 text-white', text: 'text-rose-900', weight: 'text-rose-700' },
              { bg: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', badge: 'bg-indigo-600 text-white', text: 'text-indigo-900', weight: 'text-indigo-700' },
            ];
            const color = colors[idx % colors.length];
            
            return (
              <div
                key={c.code}
                className={`rounded-xl border ${color.border} bg-gradient-to-br ${color.bg} px-3 py-3 flex flex-col gap-1 shadow-sm`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Kriteria</span>
                  <span className={`font-bold ${color.badge} px-2 py-0.5 rounded-md text-[10px]`}>{c.code}</span>
                </div>
                <p className={`text-sm font-semibold ${color.text} leading-tight`}>{c.name}</p>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className={`${color.text} font-medium uppercase text-[10px]`}>
                    {criteriaTypes?.[c.code] ?? "-"}
                  </span>
                  <span className={`font-bold ${color.weight} text-sm`}>{formatNumber(weights?.[c.code] ?? 0, 3)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-emerald p-5 space-y-4 relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-emerald-900">Matriks Data Kalurahan</h2>
            <p className="text-sm text-emerald-700">
              Input nilai kriteria untuk tiap kalurahan yang dipilih. Pilih kalurahan melalui dropdown kemudian isi nilai C1 - C{criteria.length}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-medium">
              {selectedDesaIds.length} dari {desaList.length} kalurahan dipilih
            </div>
            <button
              onClick={calculate}
              disabled={!selectedAlternatives.length || saving || !hasWeights}
              className={`px-4 py-2 rounded-lg text-white text-sm font-semibold shadow transition ${
                selectedAlternatives.length && !saving && hasWeights
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {saving ? "Menyimpan..." : "Hitung MOORA"}
            </button>
            <button
              onClick={() => {
                if (!selectedPeriod) return alert({ message: "Pilih periode terlebih dahulu", type: "error" });
                loadRawFromDesa(selectedPeriod, true);
              }}
              className="text-sm px-4 py-2 rounded-lg border-2 border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 font-medium transition"
            >
              {loadingRawFromDesa ? "Memuat..." : "Ambil Matriks dari Data Kalurahan"}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setShowDropdown(s => !s)}
              className="w-full md:w-72 border-2 border-emerald-200 rounded-xl px-4 py-3 bg-white shadow-sm flex items-center justify-between text-sm hover:border-emerald-300 transition"
            >
              <span className="flex items-center gap-2 font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Pilih Kalurahan
              </span>
              <span className="text-xs text-gray-500">{selectedDesaIds.length} dipilih</span>
            </button>
            {showDropdown && (
              <div className="absolute z-20 mt-2 w-full md:w-80 max-h-96 overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white shadow-xl">
                <div className="sticky top-0 bg-gradient-to-r from-emerald-50 to-teal-50 border-b-2 border-emerald-200 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-900">Daftar Kalurahan</span>
                    <button
                      className="text-xs px-2 py-1 border-2 border-emerald-300 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 font-medium"
                      onClick={toggleSelectAll}
                    >
                      {selectedDesaIds.length === desaList.length ? "Kosongkan" : "Pilih Semua"}
                    </button>
                  </div>
                  <input
                    className="w-full border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Cari nama / kecamatan"
                    value={searchDesa}
                    onChange={e => setSearchDesa(e.target.value)}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                  {filteredDesaList.map(desa => (
                    <label
                      key={desa.id}
                      className="flex items-center gap-3 border-2 border-gray-200 rounded-lg px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600"
                        checked={selectedDesaIds.includes(desa.id)}
                        onChange={() => toggleDesaSelection(desa)}
                      />
                      <div className="flex flex-col text-sm">
                        <span className="font-bold text-emerald-900">{desa.nama ?? desa.name}</span>
                        {desa.kecamatan && (
                          <span className="text-xs text-emerald-600">Kec. {desa.kecamatan}</span>
                        )}
                      </div>
                    </label>
                  ))}
                  {!desaList.length && (
                    <p className="text-sm text-emerald-700 text-center py-4">Daftar kalurahan belum tersedia.</p>
                  )}
                  {desaList.length > 0 && filteredDesaList.length === 0 && (
                    <p className="text-sm text-emerald-700 text-center py-4">Tidak ada kalurahan yang cocok dengan pencarian.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={toggleSelectAll}
            className="text-sm px-4 py-2 rounded-lg border-2 border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 font-medium transition"
          >
            {selectedDesaIds.length === desaList.length ? "Kosongkan Semua" : "Pilih Semua Kalurahan"}
          </button>
        </div>

        {!selectedAlternatives.length && (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center">
            Pilih kalurahan yang akan dihitung terlebih dahulu.
          </p>
        )}

        {selectedAlternatives.length > 0 && (
          <div className="overflow-x-auto rounded-xl border-2 border-emerald-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-900">
                <tr>
                  <th className="border-b-2 border-emerald-200 p-3 text-left font-bold min-w-[200px]">Nama Kalurahan</th>
                  {criteria.map(c => (
                    <th key={c.code} className="border-b-2 border-emerald-200 p-3 text-center min-w-[140px]">
                      <div className="font-bold text-emerald-900">{c.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedAlternatives.map((alt, idx) => (
                  <tr key={alt.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"}>
                    <td className="border-b border-gray-100 p-3 align-top">
                      <div className="font-bold text-emerald-900">{alt.name}</div>
                      {alt.kecamatan && (
                        <div className="text-xs text-emerald-600">Kec. {alt.kecamatan}</div>
                      )}
                    </td>
                    {criteria.map(c => {
                      const value = alt[c.code] ?? alt[c.code.toLowerCase()] ?? "";
                      const paramConfig = parameters.find((p) => String(p.criteriaCode).toUpperCase() === String(c.code).toUpperCase());
                      const options = paramConfig?.list ?? [];
                      
                      return (
                        <td key={c.code} className="border-b border-gray-100 p-2">
                          {c.nature === "kualitatif" && options.length > 0 ? (
                            <select
                              value={value}
                              onChange={e => handleChange(alt.id, c.code, e.target.value)}
                              className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                            >
                              <option value="">Pilih opsi</option>
                              {options.map((opt, i) => (
                                <option key={i} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <DecimalInput
                              className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                              placeholder={`Nilai ${c.code}`}
                              value={value}
                              onChange={val => handleChange(alt.id, c.code, val)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div className="panel-indigo p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-purple-900">Hasil Ranking Prioritas</h3>
                <p className="text-sm text-purple-700">Urutan prioritas berdasarkan nilai Yi tertinggi</p>
              </div>

              <div className="space-y-2">
                {results.map(r => (
                  <div
                    key={r.rank}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm ${
                      r.rank === 1
                        ? "bg-yellow-50 border-yellow-200"
                        : r.rank === 2
                        ? "bg-blue-50 border-blue-200"
                        : r.rank === 3
                        ? "bg-orange-50 border-orange-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          r.rank === 1
                            ? "bg-yellow-400 text-white"
                            : r.rank === 2
                            ? "bg-blue-500 text-white"
                            : r.rank === 3
                            ? "bg-orange-500 text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {r.rank}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-500">Ranking #{r.rank} dari {results.length} kalurahan</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase text-gray-500">Nilai Yi</p>
                      <p className="text-lg font-bold text-blue-700">{formatNumber(r.yi)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-info p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-cyan-900">Detail Perhitungan MOORA</h3>
                  <p className="text-sm text-cyan-700">Lihat proses perhitungan lengkap</p>
                </div>
                <button
                  onClick={() => setShowDetail(s => !s)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showDetail ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>

              {showDetail && detail && (
                <div className="mt-4 space-y-6 text-sm text-gray-700">
                  <div className="space-y-2">
                    <p className="font-semibold">1. Matriks Normalisasi</p>
                    <p className="text-xs text-gray-500">Rumus: xij = xij / √(Σ xij²)</p>
                    <div className="overflow-x-auto border-2 border-sky-200 rounded-xl shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gradient-to-r from-sky-100 to-blue-100">
                          <tr>
                            <th className="p-3 text-left border-b-2 border-sky-200 font-bold text-sky-900">Kalurahan</th>
                            {detail.codes.map(code => (
                              <th key={code} className="p-3 text-center border-b-2 border-sky-200 font-bold text-sky-900">
                                {criteria.find(c => String(c.code).toUpperCase() === String(code).toUpperCase())?.name ?? code}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.normalizedMatrix.map((row, idx) => (
                            <tr key={row.name} className={idx % 2 === 0 ? "bg-white" : "bg-sky-50/30"}>
                              <td className="p-3 border-b border-gray-100 text-left font-bold text-sky-900">{row.name}</td>
                              {detail.codes.map(code => (
                                <td key={code} className="p-3 border-b border-gray-100 text-center text-gray-700">
                                  {formatNumber(row.values[code])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold">2. Matriks Terormalisasi Terbobot</p>
                    <p className="text-xs text-gray-500">Rumus: Vij = Wij × Rij</p>
                    <div className="overflow-x-auto border-2 border-violet-200 rounded-xl shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gradient-to-r from-violet-100 to-purple-100">
                          <tr>
                            <th className="p-3 text-left border-b-2 border-violet-200 font-bold text-violet-900">Kalurahan</th>
                            {detail.codes.map(code => (
                              <th key={code} className="p-3 text-center border-b-2 border-violet-200 font-bold text-violet-900">
                                {criteria.find(c => String(c.code).toUpperCase() === String(code).toUpperCase())?.name ?? code}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.weightedMatrix.map((row, idx) => (
                            <tr key={row.name} className={idx % 2 === 0 ? "bg-white" : "bg-violet-50/30"}>
                              <td className="p-3 border-b border-gray-100 text-left font-bold text-violet-900">{row.name}</td>
                              {detail.codes.map(code => (
                                <td key={code} className="p-3 border-b border-gray-100 text-center text-gray-700">
                                  {formatNumber(row.values[code])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold">3. Perhitungan Nilai Yi</p>
                    <p className="text-xs text-gray-500">Rumus: Yi = Σ(Y benefit) - Σ(Y cost)</p>
                    <div className="overflow-x-auto border-2 border-amber-200 rounded-xl shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gradient-to-r from-amber-100 to-orange-100">
                          <tr>
                            <th className="p-3 text-left border-b-2 border-amber-200 font-bold text-amber-900">Kalurahan</th>
                            <th className="p-3 text-center border-b-2 border-amber-200 font-bold text-amber-900">Σ Benefit</th>
                            <th className="p-3 text-center border-b-2 border-amber-200 font-bold text-amber-900">Σ Cost</th>
                            <th className="p-3 text-center border-b-2 border-amber-200 font-bold text-amber-900">Yi = Benefit - Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.yiRows.map((row, idx) => (
                            <tr key={row.name} className={idx % 2 === 0 ? "bg-white" : "bg-amber-50/30"}>
                              <td className="p-3 border-b border-gray-100 text-left font-bold text-amber-900">{row.name}</td>
                              <td className="p-3 border-b border-gray-100 text-center text-emerald-700 font-semibold">{formatNumber(row.benefit)}</td>
                              <td className="p-3 border-b border-gray-100 text-center text-rose-700 font-semibold">{formatNumber(row.cost)}</td>
                              <td className="p-3 border-b border-gray-100 text-center text-blue-700 font-bold">{formatNumber(row.yi)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-lg p-5">
              <h3 className="text-lg font-semibold mb-1">Rekomendasi Prioritas</h3>
              <p className="text-sm text-blue-100 mb-4">Berdasarkan hasil perhitungan AHP-MOORA</p>
              <div className="space-y-3">
                {results.slice(0, 3).map(r => (
                  <div key={r.rank} className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/30 text-white font-bold flex items-center justify-center">
                        {r.rank}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="text-[11px] text-blue-100">Nilai Yi: {formatNumber(r.yi)}</p>
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-blue-50">Prioritas #{r.rank}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-amber p-5 space-y-3">
              <h3 className="text-lg font-semibold text-orange-900">Konversi Nilai Kriteria</h3>
              <p className="text-xs text-orange-700">Nilai mentah tiap kriteria dan hasil konversi ke parameter MOORA.</p>
              {detail && (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left border-b border-gray-200">Kalurahan</th>
                        {detail.codes.map(code => (
                          <th key={code} className="p-3 text-center border-b border-gray-200">{code}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.rawMatrix.map((row, idx) => {
                        const scoreRow = detail.scoreMatrix.find(r => r.id === row.id);
                        return (
                          <tr key={row.name} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="p-3 border-b border-gray-100 text-left font-semibold text-gray-800">{row.name}</td>
                            {detail.codes.map(code => {
                              const rawVal = row.values?.[code];
                              const convVal = scoreRow?.values?.[code];
                              const cObj = criteria.find(c => String(c.code).toUpperCase() === String(code).toUpperCase());
                              const isQualitative = cObj?.nature === "kualitatif";
                              
                              const displayRaw = (rawVal === undefined || rawVal === null || rawVal === "")
                                ? "-"
                                : (isQualitative
                                    ? String(rawVal)
                                    : formatDecimalDisplay(rawVal));

                              return (
                                <td key={code} className="p-3 border-b border-gray-100 text-center text-gray-700">
                                  <div className="text-gray-900 font-medium">{displayRaw}</div>
                                  <div className="text-blue-600 text-[10px]">Skor: {Number(convVal).toFixed(0)}</div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
