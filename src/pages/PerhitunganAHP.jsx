// src/pages/PerhitunganAHP.jsx
import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  createInitialMatrix,
  updateMatrixValue,
  calculateAHP,
} from "../utils/ahp";
import {
  fetchCriteria,
  saveAhpResult,
} from "../services/ahpService";
import { updatePeriodStatus, setActivePeriod, getPeriod } from "../services/periodService";
import { useDialog } from "../context/DialogProvider";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";
import PeriodSelector from "../components/PeriodSelector";
import { clearDraft, readDraft, writeDraft } from "../utils/draftStorage";
import { usePeriod } from "../context/PeriodContext";

const DRAFT_KEY = "sipakdesa:draft:ahp";

export default function PerhitunganAHP() {
  const { selectedPeriod, setSelectedPeriod, periods } = usePeriod();
  const [criteria, setCriteria] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const activePeriod = selectedPeriod || String(new Date().getFullYear());
  const { alert } = useDialog();
  const { markDirty, clearDirty } = useUnsavedChanges();

  useEffect(() => {
    const loadData = async () => {
      setResult(null);
      try {
        const data = await fetchCriteria();
        setCriteria(data);
        setMatrix(createInitialMatrix(data.length));

        const draft = readDraft(DRAFT_KEY);
        if (!selectedPeriod && draft?.selectedPeriod) {
          const exists = periods.some(p => String(p.id) === String(draft.selectedPeriod));
          if (exists) {
            setSelectedPeriod(draft.selectedPeriod);
          }
        }
        if (draft?.matrix?.length === data.length) {
          setMatrix(draft.matrix);
        }

        setDraftReady(true);
        clearDirty();
      } catch (err) {
        console.error("Error loading data", err);
      }
      setLoading(false);
    };
    loadData();
  }, [clearDirty, selectedPeriod, setSelectedPeriod, periods]);

  useEffect(() => {
    if (loading || !draftReady) return;
    writeDraft(DRAFT_KEY, { selectedPeriod, matrix });
  }, [loading, draftReady, selectedPeriod, matrix]);


  const handleChange = (row, col, value) => {
    markDirty();
    if (value === "") {
      const updated = updateMatrixValue(matrix, row, col, 0);
      setMatrix(updated);
      return;
    }

    const clean = String(value).replace(/[^\d]/g, "");
    if (!clean) {
      const updated = updateMatrixValue(matrix, row, col, 0);
      setMatrix(updated);
      return;
    }

    const numValue = parseInt(clean, 10);
    if (Number.isNaN(numValue)) return;
    
    const clamped = Math.max(1, Math.min(9, numValue));
    const updated = updateMatrixValue(matrix, row, col, clamped);
    setMatrix(updated);
  };

  const handleBlur = (row, col) => {
    const value = matrix[row][col];
    if (!value || value < 1 || value > 9) {
      const updated = updateMatrixValue(matrix, row, col, 0);
      setMatrix(updated);
    }
  };

  const handleCalculate = () => {
    // Validasi: semua sel di atas diagonal harus terisi (>0)
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix.length; j++) {
        const val = Number(matrix[i][j]);
        if (!val || val < 1 || val > 9) {
          alert({ message: "Lengkapi semua nilai perbandingan (1 - 9, bilangan bulat) sebelum menghitung.", type: "error" });
          return;
        }
      }
    }

    const res = calculateAHP(matrix);
    setResult(res);
  };

  const handleSave = async () => {
    if (!result?.isConsistent) {
      alert({ message: "CR ≥ 0.1, matriks tidak konsisten!", type: "error" });
      return;
    }

    const weightsObj = {};
    criteria.forEach((c, i) => {
      weightsObj[c.code] = Number(result.weights[i].toFixed(4));
    });

    try {
      if (!selectedPeriod) {
        alert({ message: "Pilih periode yang sudah dibuat di halaman Periode terlebih dahulu, atau buka 'Kelola Periode'.", type: "error" });
        return;
      }
      const periodId = String(selectedPeriod);
      
      // Check if period already has MOORA results (locked)
      const periodRecord = await getPeriod(periodId);
      
      if (periodRecord && periodRecord.mooraDone) {
        alert({ message: `❌ TIDAK BISA MENYIMPAN!\n\nPeriode ${activePeriod} sudah memiliki hasil perhitungan MOORA dan tidak dapat diubah lagi.\n\nMengubah bobot AHP akan membuat hasil MOORA menjadi tidak valid.\n\nSolusi: Buat periode baru untuk simulasi atau analisis ulang.`, type: "error" });
        return;
      }

      // Prevent saving AHP when period is locked or marked needs_recalc
      if (periodRecord && periodRecord.locked) {
        alert({ message: `❌ TIDAK BISA MENYIMPAN!\n\nPeriode ${activePeriod} dikunci (locked) oleh admin. Buka kunci di halaman Periode untuk mengubah bobot.`, type: "error" });
        return;
      }

      if (periodRecord && periodRecord.needs_recalc) {
        alert({ message: `❌ TIDAK BISA MENYIMPAN!\n\nPeriode ${activePeriod} ditandai membutuhkan recalculation karena perubahan master data (kriteria/parameter). Bersihkan flag needs_recalc di halaman Periode sebelum menyimpan.`, type: "error" });
        return;
      }

      const payload = {
        period: periodId,
        weights: weightsObj,
        CR: result.CR,
        matrix,
        lambdaMax: result.lambdaMax,
        CI: result.CI,
        isConsistent: result.isConsistent,
      };

      await saveAhpResult(payload);

      // Mark this period as having AHP results
      await updatePeriodStatus(periodId, { ahpDone: true });
      // Set this period as the only active period
      await setActivePeriod(periodId);

      alert({ message: "✓ Bobot AHP berhasil disimpan untuk periode " + activePeriod + ".\n\nBobot ini akan digunakan untuk perhitungan MOORA dan ditampilkan di halaman Kriteria & Bobot.", type: "info" });
      clearDirty();
      clearDraft(DRAFT_KEY);
    } catch (err) {
      console.error("Gagal menyimpan AHP", err);
      alert({ message: "Gagal menyimpan bobot AHP: " + (err?.message ?? err), type: "error" });
    }
  };

  const totalWeight = useMemo(
    () => (result?.weights || []).reduce((s, w) => s + (Number(w) || 0), 0),
    [result]
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Pembobotan Kriteria (AHP)</h1>
        <p className="page-subtitle">
          Tentukan bobot prioritas kriteria melalui matriks perbandingan berpasangan.
        </p>
      </div>

      {/* Periode Selection */}
      <div className="panel-info p-5 space-y-4">
        <h3 className="text-sm font-semibold text-blue-900">Pilih Periode</h3>
        <PeriodSelector
          value={selectedPeriod}
          onChange={(v) => { setSelectedPeriod(v); }}
          allowOnlyActive={false}
        />
      </div>

      {/* Banner info */}
      <div className="panel-info p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center">
          <Info size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Tentang Metode AHP</p>
          <p className="text-sm text-blue-800">
            AHP (Analytical Hierarchy Process) menggunakan perbandingan berpasangan untuk menentukan bobot kriteria. Consistency Ratio (CR) harus &lt; 0.1 agar hasil valid.
          </p>
        </div>
      </div>


      <div className="panel-info p-5">
        <h3 className="text-sm font-semibold text-amber-900 mb-4">Skala Penilaian Saaty (Panduan)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {[
            { v: 9, l: "Mutlak lebih penting" },
            { v: 7, l: "Sangat lebih penting" },
            { v: 5, l: "Lebih penting" },
            { v: 3, l: "Sedikit lebih penting" },
            { v: 1, l: "Sama penting" },
          ].map((item) => (
            <div key={item.v} className="border border-amber-200 rounded-xl p-3 text-center bg-white">
              <div className="text-2xl font-semibold text-amber-700">{item.v}</div>
              <p className="text-xs text-amber-700 mt-1 leading-tight">{item.l}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-700 mt-3">Anda bisa menggunakan nilai bulat (1, 3, 5, 7, 9) atau desimal (1.5, 2.3, 4.7, dst) untuk fine-tuning bobot agar lebih optimal dan konsisten.</p>
      </div>

      {/* Panduan penggunaan */}
      <div className="panel-indigo p-5">
        <h3 className="text-sm font-semibold text-cyan-900 mb-3">Panduan Penggunaan</h3>
        <ol className="list-decimal list-inside text-xs text-cyan-800 space-y-1">
          <li>Bandingkan setiap pasangan kriteria memakai skala Saaty (1-9, boleh desimal).</li>
          <li>Nilai 1 = sama penting, nilai 9 = mutlak lebih penting.</li>
          <li>Isi hanya bagian segitiga atas matriks; bagian bawah otomatis terisi.</li>
          <li>Klik "Hitung Bobot AHP" untuk mendapatkan bobot prioritas.</li>
          <li>Pastikan CR &lt; 0.1 agar hasil konsisten sebelum menyimpan bobot.</li>
        </ol>
      </div>

      {/* Matriks */}
      <div className="panel-indigo p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-indigo-900">Matriks Perbandingan Berpasangan</h3>
          <p className="text-xs text-indigo-700">Bandingkan setiap pasangan kriteria (1 - 9, bilangan bulat). Nilai yang lebih tinggi berarti kriteria baris lebih penting dari kriteria kolom.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="table-core text-xs md:text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="table-head">
              <tr>
                <th className="border border-gray-200 p-2 text-left">Kriteria</th>
                {criteria.map((c) => (
                  <th key={c.id} className="border border-gray-200 p-2 text-center min-w-[120px]">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((row, i) => (
                <tr key={row.id} className="bg-white">
                  <td className="border border-gray-200 p-2 font-semibold text-gray-800">{row.name}</td>
                  {criteria.map((_, j) => (
                    <td key={j} className="border border-gray-200 p-1">
                      {i === j && (
                        <input
                          type="number"
                          value={1}
                          disabled
                          className="w-full text-center bg-gray-100 rounded-md px-2 py-2"
                        />
                      )}

                      {i < j && (
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max="9"
                          placeholder="0"
                          value={matrix[i][j]}
                          onChange={(e) => handleChange(i, j, e.target.value)}
                          onBlur={() => handleBlur(i, j)}
                          onFocus={(e) => e.target.select()}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      {i > j && (
                        <input
                          type="number"
                          value={matrix[i][j]}
                          disabled
                          className="w-full text-center bg-gray-50 rounded-md px-2 py-2"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCalculate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Hitung Bobot AHP
          </button>
          {result?.isConsistent && (
            <button
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Simpan Bobot
            </button>
          )}
        </div>
      </div>

      {/* RESULT SECTIONS (only after calculate) */}
      {result && (
        <>
          {/* Consistency card */}
          <div className={`rounded-2xl border p-4 flex items-center gap-3 ${result.isConsistent ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${result.isConsistent ? "bg-emerald-500" : "bg-amber-500"}`}>
              ✓
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Consistency Ratio (CR): {result.CR.toFixed(4)}</p>
              <p className="text-xs text-gray-600">
                {result.isConsistent
                  ? "Matriks konsisten! (CR < 0.1) - Hasil dapat digunakan untuk perhitungan selanjutnya"
                  : "CR ≥ 0.1, matriks belum konsisten. Perbaiki nilai perbandingan."}
              </p>
            </div>
          </div>

          {/* Bobot prioritas */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Bobot Prioritas Kriteria</h3>
            <div className="space-y-4">
              {criteria.map((c, i) => {
                const w = result.weights[i] ?? 0;
                const percent = (w * 100).toFixed(2);
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-gray-800">
                      <span>{c.name}</span>
                      <span className="font-semibold">{Number(percent).toFixed(2)}%</span>
                    </div>
                    <div className="text-xs text-gray-500">Bobot: {w.toFixed(4)}</div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${Math.min(100, w * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t pt-3 text-sm text-gray-700 flex items-center gap-2">
              <span className="font-semibold">Total Bobot:</span>
              <span>{totalWeight.toFixed(4)}</span>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
