import { supabase } from "../supabase/supabaseConfig";
import { markAllPeriodsNeedsRecalc } from "./periodService";

export async function getAllCriteria() {
  const { data, error } = await supabase
    .from("sipakdesa_criteria")
    .select("*")
    .order("order_num", { ascending: true });

  if (error) {
    throw new Error(`Gagal mengambil data kriteria: ${error.message}`);
  }

  return data.map((d) => {
    const rawType = d.type ?? null;
    const type = rawType === null || rawType === ""
      ? null
      : (String(rawType).toLowerCase() === "cost" ? "cost" : String(rawType).toLowerCase() === "benefit" ? "benefit" : null);

    const rawNature = d.nature ?? null;
    const nature = rawNature === null || rawNature === ""
      ? "kuantitatif"
      : (String(rawNature).toLowerCase() === "kualitatif" ? "kualitatif" : "kuantitatif");

    return {
      id: d.code,
      code: String(d.code).toUpperCase(),
      name: d.name ?? "",
      type,
      nature,
      active: d.active !== false,
      order: typeof d.order_num === "number" ? d.order_num : null,
      createdAt: d.created_at ?? null,
      updatedAt: d.created_at ?? null,
    };
  });
}

export async function createCriteria(payload) {
  const code = String(payload.code ?? "").trim().toUpperCase();
  if (!code) throw new Error("Code kriteria wajib diisi");

  const type = String(payload.type ?? "").toLowerCase();
  const nature = String(payload.nature ?? "").toLowerCase() === "kualitatif" ? "kualitatif" : "kuantitatif";

  const { error } = await supabase
    .from("sipakdesa_criteria")
    .insert([
      {
        code,
        name: payload.name ?? "",
        type: type === "cost" || type === "benefit" ? type : null,
        nature,
        active: payload.active !== false,
        order_num: payload.order ?? null,
      },
    ]);

  if (error) {
    throw new Error(`Gagal membuat kriteria: ${error.message}`);
  }

  try {
    await markAllPeriodsNeedsRecalc();
  } catch (e) {
    console.warn("Failed to mark periods needs_recalc", e);
  }

  return { id: code, code };
}

export async function updateCriteria(code, payload) {
  const id = String(code).trim().toUpperCase();

  const updateData = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.type !== undefined) {
    const type = String(payload.type).toLowerCase();
    updateData.type = type === "cost" || type === "benefit" ? type : null;
  }
  if (payload.nature !== undefined) {
    updateData.nature = String(payload.nature).toLowerCase() === "kualitatif" ? "kualitatif" : "kuantitatif";
  }
  if (payload.active !== undefined) updateData.active = !!payload.active;
  if (payload.order !== undefined) updateData.order_num = payload.order;

  const { error } = await supabase
    .from("sipakdesa_criteria")
    .update(updateData)
    .eq("code", id);

  if (error) {
    throw new Error(`Gagal memperbarui kriteria: ${error.message}`);
  }

  try {
    await markAllPeriodsNeedsRecalc();
  } catch (e) {
    console.warn("Failed to mark periods needs_recalc", e);
  }

  return { id };
}

export async function deleteCriteria(code) {
  const id = String(code).trim().toUpperCase();

  // First delete parameters for this criteria
  const { error: paramErr } = await supabase
    .from("sipakdesa_parameters")
    .delete()
    .eq("criteria_code", id);

  if (paramErr) {
    console.warn("Gagal menghapus parameter kriteria:", paramErr.message);
  }

  // Then delete criteria
  const { error } = await supabase
    .from("sipakdesa_criteria")
    .delete()
    .eq("code", id);

  if (error) {
    throw new Error(`Gagal menghapus kriteria: ${error.message}`);
  }

  try {
    await markAllPeriodsNeedsRecalc();
  } catch (e) {
    console.warn("Failed to mark periods needs_recalc", e);
  }
}

export async function getParameterMap() {
  const { data, error } = await supabase
    .from("sipakdesa_parameters")
    .select("*");

  if (error) {
    throw new Error(`Gagal mengambil data parameter kriteria: ${error.message}`);
  }

  const grouped = {};

  data.forEach((row) => {
    const code = String(row.criteria_code).trim().toUpperCase();
    if (!code) return;

    if (!grouped[code]) {
      grouped[code] = { rows: [], active: true, createdAt: row.created_at, updatedAt: row.created_at };
    }

    grouped[code].rows.push({
      min: row.min_val === null || row.min_val === undefined || row.min_val === "" ? null : Number(row.min_val),
      max: row.max_val === null || row.max_val === undefined || row.max_val === "" ? null : Number(row.max_val),
      score: Number(row.score ?? 1),
      label: row.label ?? "",
    });
  });

  const map = {};
  Object.entries(grouped).forEach(([code, bucket]) => {
    // Sort rows ascending by min value
    bucket.rows.sort((a, b) => {
      const aMin = a.min === null ? Number.NEGATIVE_INFINITY : a.min;
      const bMin = b.min === null ? Number.NEGATIVE_INFINITY : b.min;
      if (aMin !== bMin) return aMin - bMin;
      return a.score - b.score;
    });

    map[code] = {
      id: code,
      criteriaCode: code,
      list: bucket.rows,
      active: bucket.active,
      complete: bucket.rows.length > 0,
      updatedAt: bucket.updatedAt,
      createdAt: bucket.createdAt,
    };
  });

  return map;
}

export async function getCriteriaWithWeight(period) {
  const criteriaData = await getAllCriteria();
  const parameterMap = await getParameterMap();

  let weightMap = {};
  if (period) {
    const { data: ahpRun, error } = await supabase
      .from("sipakdesa_ahp_runs")
      .select("weights")
      .eq("period_id", String(period))
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && ahpRun) {
      weightMap = normalizeWeights(ahpRun.weights);
    }
  }

  if (!Object.keys(weightMap).length) {
    const { data: latestAhpRun, error } = await supabase
      .from("sipakdesa_ahp_runs")
      .select("weights")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && latestAhpRun) {
      weightMap = normalizeWeights(latestAhpRun.weights);
    }
  }

  return criteriaData.map((c) => {
    const code = String(c.code).toUpperCase();
    const type = c.type ? String(c.type).toLowerCase() : null;
    const nature = c.nature ? String(c.nature).toLowerCase() : "kuantitatif";

    return {
      id: code,
      code,
      name: c.name ?? "",
      type: type === "cost" || type === "benefit" ? type : null,
      nature,
      weight: weightMap[code] ?? null,
      parametersComplete: !!parameterMap[code]?.complete,
    };
  });
}

function normalizeWeights(weights) {
  if (!weights) return {};
  if (Array.isArray(weights)) {
    const map = {};
    weights.forEach((w) => {
      const code = w.code ?? w.key ?? w.name ?? w.id;
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
