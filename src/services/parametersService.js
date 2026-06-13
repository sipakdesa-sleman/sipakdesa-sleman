import { supabase } from "../supabase/supabaseConfig";
import { getAllCriteria, getParameterMap } from "./criteriaService";
import { markAllPeriodsNeedsRecalc } from "./periodService";

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    min: item.min === undefined || item.min === null || item.min === "" ? null : Number(item.min),
    max: item.max === undefined || item.max === null || item.max === "" ? null : Number(item.max),
    score: Number(item.score ?? 1),
    label: item.label ?? "",
  }));
}

export async function getAllParameters() {
  const criteria = await getAllCriteria();
  const map = await getParameterMap();

  const rows = [];
  for (const item of criteria) {
    const parameter = map[item.code];
    if (parameter) {
      rows.push(parameter);
    }
  }

  return rows;
}

export async function getParameterByCode(criteriaCode) {
  const code = String(criteriaCode).trim().toUpperCase();
  if (!code) return null;

  const { data, error } = await supabase
    .from("sipakdesa_parameters")
    .select("*")
    .eq("criteria_code", code);

  if (error) {
    throw new Error(`Gagal mengambil data parameter: ${error.message}`);
  }

  if (!data || data.length === 0) return null;

  const rows = data.map((d) => ({
    min: d.min_val === null || d.min_val === "" ? null : Number(d.min_val),
    max: d.max_val === null || d.max_val === "" ? null : Number(d.max_val),
    score: Number(d.score ?? 1),
    label: d.label ?? "",
  }));

  // Sort rows ascending by min value
  rows.sort((a, b) => {
    const aMin = a.min === null ? Number.NEGATIVE_INFINITY : a.min;
    const bMin = b.min === null ? Number.NEGATIVE_INFINITY : b.min;
    if (aMin !== bMin) return aMin - bMin;
    return a.score - b.score;
  });

  return {
    id: code,
    criteriaCode: code,
    list: rows,
    active: true,
    complete: rows.length > 0,
    createdAt: data[0].created_at,
    updatedAt: data[0].created_at,
  };
}

export async function upsertParameter(criteriaCode, payload = {}) {
  const code = String(criteriaCode).trim().toUpperCase();
  if (!code) throw new Error("criteriaCode wajib diisi");

  const normalizedList = payload.list ? normalizeList(payload.list) : [];

  // Delete old parameters for this criteria
  const { error: deleteError } = await supabase
    .from("sipakdesa_parameters")
    .delete()
    .eq("criteria_code", code);

  if (deleteError) {
    throw new Error(`Gagal menghapus parameter lama kriteria: ${deleteError.message}`);
  }

  // Insert new parameters
  if (normalizedList.length > 0) {
    const rowsToInsert = normalizedList.map((row) => ({
      criteria_code: code,
      min_val: row.min,
      max_val: row.max,
      score: row.score,
      label: row.label,
    }));

    const { error: insertError } = await supabase
      .from("sipakdesa_parameters")
      .insert(rowsToInsert);

    if (insertError) {
      throw new Error(`Gagal menyimpan parameter baru kriteria: ${insertError.message}`);
    }
  }

  try {
    const { clearParameterCache } = await import("../utils/moora");
    clearParameterCache();
  } catch (e) {
    console.warn("Failed to clear MOORA parameter cache", e);
  }

  try {
    await markAllPeriodsNeedsRecalc();
  } catch (e) {
    console.warn("Failed to mark periods needs_recalc", e);
  }

  return { id: code, criteriaCode: code, list: normalizedList };
}

export async function deleteParameter(criteriaCode) {
  const code = String(criteriaCode).trim().toUpperCase();
  if (!code) return;

  const { error } = await supabase
    .from("sipakdesa_parameters")
    .delete()
    .eq("criteria_code", code);

  if (error) {
    throw new Error(`Gagal menghapus parameter: ${error.message}`);
  }

  try {
    const { clearParameterCache } = await import("../utils/moora");
    clearParameterCache();
  } catch (e) {
    console.warn("Failed to clear MOORA parameter cache", e);
  }

  try {
    await markAllPeriodsNeedsRecalc();
  } catch (e) {
    console.warn("Failed to mark periods needs_recalc", e);
  }
}
