import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Plus, RefreshCw, Pencil, Trash2, Save, Settings2 } from "lucide-react";
import { useDialog } from "../context/DialogProvider";
import { getCriteriaWithWeight, createCriteria, updateCriteria, deleteCriteria, getAllCriteria } from "../services/criteriaService";
import { getAllParameters, getParameterByCode, upsertParameter } from "../services/parametersService";
import { getLatestAhpMeta, getAllAhpRuns } from "../services/ahpService";
import { getAllPeriods } from "../services/periodService";

const emptyCriteriaForm = { code: "", name: "", type: "", nature: "kuantitatif", active: true };

function normalizeRanges(list = []) {
  return list.map((item) => ({
    label: item.label ?? "",
    min: item.min === null || item.min === undefined ? "" : item.min,
    max: item.max === null || item.max === undefined ? "" : item.max,
    score: item.score ?? 1,
  }));
}

function isRangeValid(row, isQualitative = false) {
  const hasScore = row.score !== "" && row.score !== null && row.score !== undefined;
  if (isQualitative) {
    return hasScore && String(row.label).trim() !== "";
  }
  const hasBound = row.min !== "" || row.max !== "";
  return hasScore && hasBound;
}

export default function KriteriaBobot() {
  const { alert, confirm } = useDialog();

  const [activeTab, setActiveTab] = useState("criteria");
  const [criteria, setCriteria] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [criteriaWeights, setCriteriaWeights] = useState([]);
  const [meta, setMeta] = useState({ CR: null, period: null });
  const [displayPeriod, setDisplayPeriod] = useState("-");
  const [ahpPeriods, setAhpPeriods] = useState([]);
  const [selectedAhpPeriod, setSelectedAhpPeriod] = useState("");
  const [loading, setLoading] = useState(true);

  const [criteriaModalOpen, setCriteriaModalOpen] = useState(false);
  const [criteriaForm, setCriteriaForm] = useState(emptyCriteriaForm);
  const [editingCriteria, setEditingCriteria] = useState(null);

  const [parameterModalOpen, setParameterModalOpen] = useState(false);
  const [parameterCode, setParameterCode] = useState("");
  const [parameterRows, setParameterRows] = useState([]);
  const [parameterActive, setParameterActive] = useState(true);

  const parameterMap = useMemo(() => {
    const map = {};
    parameters.forEach((p) => {
      map[String(p.criteriaCode).toUpperCase()] = p;
    });
    return map;
  }, [parameters]);

  const loadMasterData = useCallback(async () => {
    try {
      const [criteriaData, parameterData, periodList, allAhp] = await Promise.all([
        getAllCriteria(),
        getAllParameters(),
        getAllPeriods(),
        getAllAhpRuns(),
      ]);

      setCriteria(criteriaData);
      setParameters(parameterData);
      setAhpPeriods(allAhp);

      const activeAhp = allAhp[0] ?? null;
      const activePeriodDoc = periodList.find((p) => p.isActive || p.active) ?? null;
      const latestYear = periodList
        .map((p) => p.year)
        .filter((y) => y !== undefined && y !== null)
        .sort((a, b) => Number(b) - Number(a))[0];

      const chosenPeriod = activeAhp?.id ?? activePeriodDoc?.year ?? latestYear ?? null;
      const periodParam = chosenPeriod ? String(chosenPeriod) : undefined;

      setDisplayPeriod(chosenPeriod ?? "-");
      setSelectedAhpPeriod(chosenPeriod ?? (allAhp[0]?.id ?? ""));

      const weightData = await getCriteriaWithWeight(periodParam);
      setCriteriaWeights(weightData);

      if (chosenPeriod) {
        const latest = await getLatestAhpMeta(periodParam);
        setMeta(latest);
      } else {
        setMeta({ CR: null, period: null });
      }
    } catch (err) {
      console.error("Gagal memuat data kriteria", err);
      alert({ message: "Gagal memuat data kriteria dan parameter.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    const run = async () => {
      try {
        const periodParam = selectedAhpPeriod || undefined;
        const data = await getCriteriaWithWeight(periodParam);
        setCriteriaWeights(data);
        const latest = await getLatestAhpMeta(periodParam);
        setMeta(latest);
        setDisplayPeriod(latest?.period ?? selectedAhpPeriod ?? "-");
      } catch (e) {
        console.error("Gagal memuat bobot untuk periode", selectedAhpPeriod, e);
      }
    };
    if (selectedAhpPeriod) run();
  }, [selectedAhpPeriod]);

  const criteriaStats = useMemo(() => {
    const active = criteria.filter((c) => c.active !== false);
    const activeQualitativeCodes = new Set(
      active.filter(c => String(c.nature).toLowerCase() === "kualitatif").map(c => String(c.code).toUpperCase())
    );
    const totalParameters = parameters
      .filter(p => activeQualitativeCodes.has(String(p.criteriaCode).toUpperCase()))
      .reduce((sum, item) => sum + (Array.isArray(item.list) ? item.list.length : 0), 0);
    return { total: criteria.length, active: active.length, totalParameters };
  }, [criteria, parameters]);

  const openCreateCriteria = () => {
    setEditingCriteria(null);
    setCriteriaForm(emptyCriteriaForm);
    setCriteriaModalOpen(true);
  };

  const openEditCriteria = (item) => {
    setEditingCriteria(item.code);
    setCriteriaForm({
      code: item.code,
      name: item.name ?? "",
      type: item.type ?? "",
      nature: item.nature ?? "kuantitatif",
      active: item.active !== false,
    });
    setCriteriaModalOpen(true);
  };

  const saveCriteria = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: criteriaForm.code,
        name: criteriaForm.name,
        type: criteriaForm.type,
        nature: criteriaForm.nature ?? "kuantitatif",
        active: criteriaForm.active,
      };

      if (editingCriteria) {
        await updateCriteria(editingCriteria, payload);
      } else {
        await createCriteria(payload);
      }

      await loadMasterData();
      setCriteriaModalOpen(false);
      alert({ message: `Kriteria ${payload.code} berhasil disimpan.`, type: "info" });
    } catch (err) {
      console.error("Gagal menyimpan kriteria", err);
      alert({ message: err?.message ?? "Gagal menyimpan kriteria.", type: "error" });
    }
  };

  const removeCriteria = async (item) => {
    const ok = await confirm({
      title: "Hapus Kriteria",
      message: `Hapus kriteria ${item.code} - ${item.name}? Parameter terkait juga akan dihapus.`,
      confirmLabel: "Hapus",
      cancelLabel: "Batal",
    });
    if (!ok) return;

    try {
      await deleteCriteria(item.code);
      await loadMasterData();
      alert({ message: `Kriteria ${item.code} dihapus.`, type: "info" });
    } catch (err) {
      console.error("Gagal menghapus kriteria", err);
      alert({ message: err?.message ?? "Gagal menghapus kriteria.", type: "error" });
    }
  };

  const openParameterEditor = async (item) => {
    const code = String(item.code).toUpperCase();
    const existing = await getParameterByCode(code);
    const ranges = existing?.list?.length ? existing.list : [];
    setParameterCode(code);
    setParameterRows(normalizeRanges(ranges));
    setParameterActive(existing?.active !== false);
    setParameterModalOpen(true);
  };

  const addParameterRow = () => {
    setParameterRows((prev) => [...prev, { label: "", min: "", max: "", score: 1 }]);
  };

  const removeParameterRow = (idx) => {
    setParameterRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateParameterRow = (idx, field, value) => {
    setParameterRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const saveParameters = async (e) => {
    e.preventDefault();
    try {
      const currentCriteriaObj = criteria.find((c) => c.code === parameterCode);
      const isQualitative = currentCriteriaObj?.nature === "kualitatif";

      const normalized = parameterRows.map((row) => ({
        label: row.label,
        min: isQualitative || row.min === "" ? null : Number(row.min),
        max: isQualitative || row.max === "" ? null : Number(row.max),
        score: Number(row.score),
      }));

      await upsertParameter(parameterCode, {
        list: normalized,
        complete: normalized.every((row) => isRangeValid(row, isQualitative)),
        active: parameterActive,
      });

      await loadMasterData();
      setParameterModalOpen(false);
      alert({ message: `Parameter ${parameterCode} berhasil disimpan.`, type: "info" });
    } catch (err) {
      console.error("Gagal menyimpan parameter", err);
      alert({ message: err?.message ?? "Gagal menyimpan parameter.", type: "error" });
    }
  };

  const totalWeight = useMemo(
    () => criteriaWeights.reduce((sum, c) => sum + (typeof c.weight === "number" ? c.weight : 0), 0),
    [criteriaWeights]
  );

  const consistencyText = useMemo(() => {
    if (meta.CR === null || meta.CR === undefined) return "-";
    return meta.CR.toFixed(3);
  }, [meta]);

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading...</div>;

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Kriteria & Bobot</h1>
        <p className="page-subtitle">
          Kelola kriteria dan parameter konversi per kriteria. Bobot AHP tetap ditampilkan terpisah sebagai hasil perhitungan.
        </p>
      </div>

      <div className="panel-info p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center">
          <Info size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">Catatan Arsitektur</p>
          <p className="text-sm text-blue-800">
            Bobot AHP dihasilkan dari matriks perbandingan, sedangkan parameter per kriteria dipakai MOORA untuk konversi nilai mentah menjadi skor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox label="Total Kriteria" value={criteriaStats.total} helper="Master kriteria" />
        <StatBox label="Kriteria Aktif" value={criteriaStats.active} helper="Digunakan dalam proses" highlight />
        <StatBox label="Total Parameters" value={criteriaStats.totalParameters} helper="Total range tersimpan" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          ["criteria", "Kriteria"],
          ["weights", "Bobot AHP"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === key ? "bg-[#1a2847] text-white" : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "criteria" && (
        <section className="panel-surface overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-3 flex-wrap border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">Master Kriteria</p>
              <p className="text-sm text-gray-500">`code` kriteria bersifat immutable. Parameter diubah lewat tombol Parameter pada tiap baris kriteria.</p>
            </div>
            <button onClick={openCreateCriteria} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
              <Plus size={16} /> Tambah Kriteria
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Tipe</th>
                  <th className="px-4 py-3 text-left">Sifat Nilai</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Parameter</th>
                  <th className="px-4 py-3 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((item) => {
                  const p = parameterMap[String(item.code).toUpperCase()];
                  return (
                    <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.code}</td>
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3">{item.type}</td>
                      <td className="px-4 py-3">
                        <Badge tone={item.nature === "kualitatif" ? "purple" : "blue"}>
                          {item.nature === "kualitatif" ? "Kualitatif" : "Kuantitatif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={item.active !== false ? "green" : "gray"}>{item.active !== false ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.nature === "kualitatif" ? (
                          <Badge tone={p?.complete ? "blue" : "yellow"}>
                            {p?.complete ? `Lengkap (${p.list?.length || 0} opsi)` : "Belum lengkap"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium italic">Tidak Perlu</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => openEditCriteria(item)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold">
                            <Pencil size={14} /> Edit
                          </button>
                          {item.nature === "kualitatif" ? (
                            <button onClick={() => openParameterEditor(item)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-100 text-sky-800 text-xs font-semibold">
                              <Settings2 size={14} /> Parameter
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-xs font-semibold border border-gray-200 cursor-not-allowed" title="Kriteria Kuantitatif langsung dihitung menggunakan nilai mentah">
                              <Settings2 size={14} /> Parameter
                            </span>
                          )}
                          <button onClick={() => removeCriteria(item)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-800 text-xs font-semibold">
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "weights" && (
        <section className="space-y-4">
          <div className="panel-info p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-sky-900">Daftar Bobot AHP</p>
                <p className="text-xs text-sky-700">Bobot AHP periode {meta.period ?? displayPeriod}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-sky-800 font-semibold">Periode AHP</span>
                <select
                  className="border-2 border-sky-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={selectedAhpPeriod}
                  onChange={(e) => setSelectedAhpPeriod(e.target.value)}
                >
                  {ahpPeriods.length === 0 && <option value="">Belum ada data AHP</option>}
                  {ahpPeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} {p.active ? "(aktif)" : "(non-aktif)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatBox label="Total Bobot" value={totalWeight.toFixed(2)} helper="Harus 1.00" highlight />
              <StatBox label="Consistency Ratio" value={consistencyText} helper="Valid jika < 0.1" />
              <StatBox label="Kriteria Ditampilkan" value={criteriaWeights.length} helper="Berdasarkan bobot AHP" />
            </div>

            <div className="space-y-3 md:hidden">
              {criteriaWeights.map((c) => {
                const percent = typeof c.weight === "number" ? (c.weight * 100).toFixed(2) : "-";
                const p = parameterMap[String(c.code).toUpperCase()];
                return (
                  <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 break-words">{c.code} - {c.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{c.type}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-gray-500">Bobot</p>
                        <p className="text-lg font-semibold text-blue-700 leading-tight">{percent}%</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.type === "benefit" ? "green" : "yellow"}>{c.type}</Badge>
                      <Badge tone={c.nature === "kualitatif" ? "purple" : "blue"}>
                        {c.nature === "kualitatif" ? "Kualitatif" : "Kuantitatif"}
                      </Badge>
                      {c.nature === "kualitatif" && (
                        <Badge tone={p?.complete ? "blue" : "red"}>
                          {p?.complete ? `Parameter lengkap (${p.list?.length || 0} opsi)` : "Parameter belum lengkap"}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {criteriaWeights.map((c) => {
                const percent = typeof c.weight === "number" ? (c.weight * 100).toFixed(2) : "-";
                const p = parameterMap[String(c.code).toUpperCase()];
                return (
                  <div key={c.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-900">{c.code} - {c.name}</p>
                      <p className="text-xs text-gray-500">
                        <span className="capitalize">{c.type}</span> • {c.nature === "kualitatif" ? "Kualitatif" : "Kuantitatif"}
                        {c.nature === "kualitatif" && ` • Parameter: ${p?.complete ? "lengkap" : "belum lengkap"}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Bobot</p>
                      <p className="text-lg font-semibold text-blue-700">{percent}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {criteriaModalOpen && (
        <Modal title={editingCriteria ? "Edit Kriteria" : "Tambah Kriteria"} onClose={() => setCriteriaModalOpen(false)}>
          <form className="space-y-4" onSubmit={saveCriteria}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <input
                value={criteriaForm.code}
                onChange={(e) => setCriteriaForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                disabled={!!editingCriteria}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">Code kriteria tidak boleh berubah setelah dibuat.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nama</label>
              <input
                value={criteriaForm.name}
                onChange={(e) => setCriteriaForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipe</label>
                <select
                  value={criteriaForm.type}
                  onChange={(e) => setCriteriaForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                >
                  <option value="" disabled>Pilih tipe</option>
                  <option value="benefit">Benefit</option>
                  <option value="cost">Cost</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sifat Nilai</label>
                <select
                  value={criteriaForm.nature}
                  onChange={(e) => setCriteriaForm((prev) => ({ ...prev, nature: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                >
                  <option value="kuantitatif">Kuantitatif</option>
                  <option value="kualitatif">Kualitatif</option>
                </select>
              </div>
              <div className="flex items-end pb-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={criteriaForm.active}
                    onChange={(e) => setCriteriaForm((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  Aktif
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCriteriaModalOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700">Batal</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#1a2847] text-white inline-flex items-center gap-2"><Save size={16} /> Simpan</button>
            </div>
          </form>
        </Modal>
      )}

      {parameterModalOpen && (() => {
        const currentCriteriaObj = criteria.find((c) => c.code === parameterCode);
        const isQualitative = currentCriteriaObj?.nature === "kualitatif";
        return (
          <Modal title={`Parameter ${parameterCode} (${isQualitative ? "Kualitatif" : "Kuantitatif"})`} onClose={() => setParameterModalOpen(false)} wide>
            <form className="space-y-4" onSubmit={saveParameters}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{isQualitative ? "Edit Opsi Konversi Kualitatif" : "Edit range konversi Kuantitatif"}</p>
                  <p className="text-xs text-gray-500">{isQualitative ? "Tentukan skor untuk setiap opsi label kualitatif." : "Setiap baris menentukan skor untuk satu rentang nilai mentah."}</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={parameterActive} onChange={(e) => setParameterActive(e.target.checked)} />
                  Aktif
                </label>
              </div>

              {parameterRows.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Belum ada range/opsi tersimpan untuk kriteria ini. Tambahkan secara manual.
                </div>
              )}

              <div className="space-y-3 max-h-[55vh] overflow-auto pr-1">
                {parameterRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-xl border border-gray-200 p-3">
                    <div className={isQualitative ? "md:col-span-9" : "md:col-span-3"}>
                      <label className="block text-xs font-medium text-gray-600">{isQualitative ? "Label Opsi (Data Mentah Kualitatif)" : "Label"}</label>
                      <input value={row.label} onChange={(e) => updateParameterRow(idx, "label", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={isQualitative ? "misal: Sangat Rawan" : "misal: Sangat Rendah"} required />
                    </div>
                    {!isQualitative && (
                      <>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-gray-600">Min</label>
                          <input value={row.min} onChange={(e) => updateParameterRow(idx, "min", e.target.value)} type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-gray-600">Max</label>
                          <input value={row.max} onChange={(e) => updateParameterRow(idx, "max", e.target.value)} type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        </div>
                      </>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600">Score</label>
                      <input value={row.score} onChange={(e) => updateParameterRow(idx, "score", e.target.value)} type="number" min="1" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end">
                      <button type="button" onClick={() => removeParameterRow(idx)} className="rounded-lg bg-red-100 text-red-700 px-3 py-2 text-xs font-semibold">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between gap-2 pt-2 flex-wrap">
                <button type="button" onClick={addParameterRow} className="px-4 py-2 rounded-lg bg-sky-100 text-sky-800 font-semibold">+ Tambah Baris</button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setParameterModalOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700">Batal</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-[#1a2847] text-white inline-flex items-center gap-2"><Save size={16} /> Simpan Parameter</button>
                </div>
              </div>
            </form>
          </Modal>
        );
      })()}
    </div>
  );
}

function StatBox({ label, value, helper, highlight }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm border ${highlight ? "bg-gradient-to-br from-[#1a2847] to-[#234166] text-white border-white/20" : "bg-white border-gray-200"}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${highlight ? "text-white/80" : "text-gray-500"}`}>{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${highlight ? "text-white" : "text-gray-900"}`}>{value}</p>
      <p className={`text-xs mt-1 ${highlight ? "text-white/80" : "text-gray-500"}`}>{helper}</p>
    </div>
  );
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    green: "bg-green-100 text-green-700 border-green-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    red: "bg-red-100 text-red-700 border-red-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
  };

  return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${tones[tone] ?? tones.gray}`}>{children}</span>;
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] ${wide ? "sm:max-w-5xl" : "sm:max-w-2xl"} max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-sm p-1 rounded" aria-label="close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
