import { supabase } from "../supabase/supabaseConfig";

// Ambil daftar kriteria untuk AHP
export async function fetchCriteria() {
  const { data, error } = await supabase
    .from("sipakdesa_criteria")
    .select("code, name")
    .order("order_num", { ascending: true });

  if (error) {
    throw new Error(`Gagal mengambil kriteria: ${error.message}`);
  }

  return data.map((d) => ({
    id: d.code,
    code: d.code,
    name: d.name ?? "Unnamed",
  }));
}

// Ambil bobot kriteria AHP yang active
export async function getAHPCriteriaWeights(period) {
  if (period) {
    const { data, error } = await supabase
      .from("sipakdesa_ahp_runs")
      .select("id, weights")
      .eq("period_id", String(period))
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return { weights: normalizeWeights(data.weights), ahpId: data.id };
    }
  }

  // fallback: latest active
  const { data: latest, error } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("id, weights")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !latest) return { weights: {}, ahpId: null };
  return { weights: normalizeWeights(latest.weights), ahpId: latest.id };
}

// Ambil metadata AHP yang active (mis. Consistency Ratio) untuk ditampilkan di UI
export async function getLatestAhpMeta(period) {
  if (period) {
    const { data, error } = await supabase
      .from("sipakdesa_ahp_runs")
      .select("cr, period_id, created_at")
      .eq("period_id", String(period))
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return {
        CR: typeof data.cr === "number" ? data.cr : null,
        period: data.period_id ?? period,
        createdAt: data.created_at ?? null,
      };
    }
  }

  const { data: latest } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("cr, period_id, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return { CR: null, period: period ?? null };

  return {
    CR: typeof latest.cr === "number" ? latest.cr : null,
    period: latest.period_id ?? period ?? null,
    createdAt: latest.created_at ?? null,
  };
}

// Simpan hasil AHP dan set active flag
export const saveAhpResult = async ({ period, weights, CR, matrix, lambdaMax, CI, isConsistent, label = null }) => {
  if (!period) throw new Error("periode wajib diisi");

  // Matikan yang active lain untuk periode ini
  const { error: updateError } = await supabase
    .from("sipakdesa_ahp_runs")
    .update({ active: false })
    .eq("period_id", String(period));

  if (updateError) {
    console.warn("Gagal menonaktifkan AHP runs lama:", updateError.message);
  }

  // Konversi matrix menjadi objek baris jika berupa array
  const matrixObj = Array.isArray(matrix)
    ? Object.fromEntries(matrix.map((row, idx) => [String(idx), Array.isArray(row) ? row : []]))
    : {};

  // Tambahkan meta ke matrixObj agar tersimpan di database
  const enrichedMatrix = {
    ...matrixObj,
    _meta: {
      lambdaMax,
      CI,
      isConsistent: !!isConsistent
    }
  };

  const { data, error: insertError } = await supabase
    .from("sipakdesa_ahp_runs")
    .insert([
      {
        period_id: String(period),
        label: typeof label === "string" ? label.trim() : `AHP_${Date.now()}`,
        cr: CR,
        weights: weights || {},
        matrix: enrichedMatrix,
        active: true,
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Gagal menyimpan hasil AHP: ${insertError.message}`);
  }

  const runId = data.id;

  // Update status periode agar ahp_done = true
  const { updatePeriodStatus } = await import("./periodService");
  await updatePeriodStatus(String(period), { ahpDone: true });

  return { runId };
};

// util to normalize weights object/array
function normalizeWeights(weights) {
  if (!weights) return {};
  if (Array.isArray(weights)) {
    const map = {};
    weights.forEach((w) => {
      const code = w.code ?? w.key ?? w.name ?? "";
      if (code) map[code] = Number(w.weight ?? w.bobot ?? 0);
    });
    return map;
  }
  if (typeof weights === "object") {
    const map = {};
    Object.entries(weights).forEach(([k, v]) => {
      map[k] = Number(v ?? 0);
    });
    return map;
  }
  return {};
}

// Ambil metadata AHP berdasarkan ID dokumen
export async function getAhpMetaById(ahpId) {
  if (!ahpId) return null;
  const { data, error } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("id, period_id, cr, created_at")
    .eq("id", ahpId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    period: data.period_id ?? null,
    CR: typeof data.cr === "number" ? data.cr : null,
    createdAt: data.created_at ?? null,
  };
}

// Ambil seluruh data AHP by id termasuk weights
export async function getAhpById(ahpId) {
  if (!ahpId) return null;
  const { data, error } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("id, period_id, cr, weights, created_at")
    .eq("id", ahpId)
    .maybeSingle();

  if (error || !data) return null;

  let weightsArr = [];
  if (data.weights) {
    if (Array.isArray(data.weights)) {
      weightsArr = data.weights;
    } else if (typeof data.weights === "object") {
      weightsArr = Object.entries(data.weights).map(([code, weight]) => ({
        code,
        weight: Number(weight),
      }));
    }
  }

  return {
    id: data.id,
    period: data.period_id ?? null,
    CR: typeof data.cr === "number" ? data.cr : null,
    weights: weightsArr,
    createdAt: data.created_at ?? null,
  };
}

// Ambil detail AHP berdasarkan periode
export async function getAhpResultByPeriod(period) {
  if (!period) return null;
  const { data, error } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("*")
    .eq("period_id", String(period))
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const matrixMeta = data.matrix?._meta ?? {};
  return {
    id: data.id,
    period: data.period_id ?? String(period),
    matrix: normalizeMatrix(data.matrix),
    weights: normalizeWeights(data.weights),
    lambdaMax: matrixMeta.lambdaMax ?? null,
    CI: matrixMeta.CI ?? null,
    CR: typeof data.cr === "number" ? data.cr : null,
    isConsistent: matrixMeta.isConsistent ?? null,
    createdAt: data.created_at ?? null,
  };
}

function normalizeMatrix(matrix) {
  if (!matrix) return [];
  // Exclude meta field from matrix view if present
  const cleanMatrix = { ...matrix };
  delete cleanMatrix._meta;
  
  if (Array.isArray(cleanMatrix)) {
    return cleanMatrix.map((row) => (Array.isArray(row) ? row : []));
  }
  if (typeof cleanMatrix === "object") {
    const keys = Object.keys(cleanMatrix).sort((a, b) => Number(a) - Number(b));
    return keys.map((k) => (Array.isArray(cleanMatrix[k]) ? cleanMatrix[k] : []));
  }
  return [];
}

// List runs saved under a period
export async function getAhpRuns(period) {
  if (!period) return [];
  const { data, error } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("*")
    .eq("period_id", String(period))
    .order("created_at", { ascending: false });

  if (error) return [];
  return data.map(d => ({
    id: d.id,
    runId: d.id,
    period: d.period_id,
    label: d.label,
    cr: d.cr,
    weights: d.weights,
    matrix: d.matrix,
    active: d.active,
    created_at: d.created_at,
  }));
}

// Get a specific AHP run weights by period and runId
export async function getAhpRunById(period, runId) {
  if (!runId) return null;
  const { data, error } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    runId: data.id,
    period: data.period_id ?? String(period),
    CR: typeof data.cr === "number" ? data.cr : null,
    weights: normalizeWeights(data.weights),
    label: data.label ?? null,
    matrix: normalizeMatrix(data.matrix),
    createdAt: data.created_at ?? null,
  };
}

export async function getAllAhpRuns() {
  const { data, error } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("id, period_id, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Gagal mengambil semua run AHP: ${error.message}`);
  }

  return data.map((d) => ({
    id: d.period_id,
    active: d.active,
    createdAt: d.created_at,
  }));
}