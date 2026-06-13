import { supabase } from "../supabase/supabaseConfig";

async function deletePeriodRelatedData(periodId) {
  const pId = String(periodId);

  try {
    await supabase.from("sipakdesa_ahp_runs").delete().eq("period_id", pId);
  } catch (e) {
    console.warn("Gagal hapus AHP runs:", e);
  }

  try {
    await supabase.from("sipakdesa_bpkal_configs").delete().eq("period_id", pId);
  } catch (e) {
    console.warn("Gagal hapus BPKal config:", e);
  }

  try {
    await supabase.from("sipakdesa_system_parameters").delete().eq("period_id", pId);
  } catch (e) {
    console.warn("Gagal hapus system parameters:", e);
  }

  try {
    await supabase.from("sipakdesa_desa_raw_values").delete().eq("period_id", pId);
  } catch (e) {
    console.warn("Gagal hapus raw values:", e);
  }

  try {
    await supabase.from("sipakdesa_pra_kalkulasi_runs").delete().eq("period_id", pId);
  } catch (e) {
    console.warn("Gagal hapus pra-kalkulasi runs:", e);
  }

  try {
    await supabase.from("sipakdesa_moora_runs").delete().eq("period_id", pId);
  } catch (e) {
    console.warn("Gagal hapus MOORA runs:", e);
  }
}

export const ensurePeriodExists = async (yearValue) => {
  if (!yearValue) throw new Error("Tahun/Periode wajib diisi");
  const yearStr = String(yearValue).trim();
  const yearNum = Number(yearStr);

  const { data, error: _error } = await supabase
    .from("sipakdesa_periods")
    .select("*")
    .eq("id", yearStr)
    .single();

  if (data) {
    return { id: data.id, year: data.year ?? yearStr };
  }

  // Re-creating active/deleted period clean setup
  await deletePeriodRelatedData(yearStr);

  const newPeriod = {
    id: yearStr,
    year: Number.isNaN(yearNum) ? null : yearNum,
    is_active: false,
    ahp_done: false,
    pra_kalkulasi_done: false,
    pra_kalkulasi_result: {},
    needs_recalc: false,
    moora_done: false,
    locked: false,
  };

  const { error: insertError } = await supabase
    .from("sipakdesa_periods")
    .insert([newPeriod]);

  if (insertError) {
    throw new Error(`Gagal membuat periode baru: ${insertError.message}`);
  }

  return { id: yearStr, year: yearStr };
};

export const updatePeriodStatus = async (id, data) => {
  const updateData = {};
  if (data.isActive !== undefined) updateData.is_active = data.isActive;
  if (data.locked !== undefined) updateData.locked = data.locked;
  if (data.needs_recalc !== undefined) updateData.needs_recalc = data.needs_recalc;
  if (data.ahpDone !== undefined) updateData.ahp_done = data.ahpDone;
  if (data.praKalkulasiDone !== undefined) updateData.pra_kalkulasi_done = data.praKalkulasiDone;
  if (data.mooraDone !== undefined) updateData.moora_done = data.mooraDone;

  // Safe mapping of dynamic parameters into JSONB
  if (data.pagu_total_kab !== undefined || data.paguKab !== undefined || data.is_kebijakan_active !== undefined) {
    const { data: currentPeriod } = await supabase
      .from("sipakdesa_periods")
      .select("pra_kalkulasi_result")
      .eq("id", String(id))
      .maybeSingle();

    const existingResult = currentPeriod?.pra_kalkulasi_result || {};
    updateData.pra_kalkulasi_result = {
      ...existingResult,
      pagu_total_kab: data.pagu_total_kab !== undefined ? data.pagu_total_kab : existingResult.pagu_total_kab,
      paguKab: data.paguKab !== undefined ? data.paguKab : existingResult.paguKab,
      is_kebijakan_active: data.is_kebijakan_active !== undefined ? data.is_kebijakan_active : existingResult.is_kebijakan_active,
    };
  } else if (data.praKalkulasiResult !== undefined) {
    updateData.pra_kalkulasi_result = data.praKalkulasiResult;
  }

  const { error } = await supabase
    .from("sipakdesa_periods")
    .update(updateData)
    .eq("id", String(id));

  if (error) throw new Error(`Gagal memperbarui status periode: ${error.message}`);
};

export const setPraKalkulasiResult = async (periodId, payload = {}) => {
  if (!periodId) throw new Error("periodId wajib diisi");
  const { error } = await supabase
    .from("sipakdesa_periods")
    .update({
      pra_kalkulasi_done: true,
      pra_kalkulasi_result: payload,
    })
    .eq("id", String(periodId));

  if (error) throw new Error(`Gagal menyimpan hasil pra-kalkulasi: ${error.message}`);
  return { id: String(periodId) };
};

export const markAllPeriodsNeedsRecalc = async () => {
  const { error } = await supabase
    .from("sipakdesa_periods")
    .update({ needs_recalc: true })
    .neq("id", "");

  if (error) throw new Error(`Gagal menandai kebutuhan kalkulasi ulang periode: ${error.message}`);
};

export const setActivePeriod = async (id) => {
  const targetId = String(id);

  const { error: errorDeactivate } = await supabase
    .from("sipakdesa_periods")
    .update({ is_active: false })
    .eq("is_active", true);

  if (errorDeactivate) throw new Error(`Gagal menonaktifkan periode: ${errorDeactivate.message}`);

  const { error: errorActivate } = await supabase
    .from("sipakdesa_periods")
    .update({ is_active: true })
    .eq("id", targetId);

  if (errorActivate) throw new Error(`Gagal mengaktifkan periode aktif: ${errorActivate.message}`);
};

export const copyAhpWeights = async (fromPeriod, toPeriod) => {
  const fId = String(fromPeriod);
  const tId = String(toPeriod);

  const { data: sourceRun, error: sourceError } = await supabase
    .from("sipakdesa_ahp_runs")
    .select("*")
    .eq("period_id", fId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sourceError || !sourceRun) {
    throw new Error(`Periode ${fromPeriod} tidak memiliki bobot AHP yang aktif`);
  }

  const { data: targetPeriod, error: targetError } = await supabase
    .from("sipakdesa_periods")
    .select("*")
    .eq("id", tId)
    .single();

  if (targetError || !targetPeriod) {
    throw new Error(`Periode ${toPeriod} belum dibuat. Buat periode dulu di halaman Periode.`);
  }

  const { error: copyError } = await supabase
    .from("sipakdesa_ahp_runs")
    .insert([
      {
        period_id: tId,
        label: `Salin dari Periode ${fId}`,
        cr: sourceRun.cr,
        weights: sourceRun.weights,
        matrix: sourceRun.matrix,
        active: true,
      },
    ]);

  if (copyError) throw new Error(`Gagal menyalin bobot AHP: ${copyError.message}`);

  await updatePeriodStatus(tId, { ahpDone: true });

  return { success: true, from: fromPeriod, to: toPeriod };
};

export const deletePeriod = async (periodId) => {
  if (!periodId) throw new Error("periodId wajib diisi");
  const pId = String(periodId);

  const { data: bpkal } = await supabase.from("sipakdesa_bpkal_configs").select("period_id").eq("period_id", pId).maybeSingle();
  if (bpkal) throw new Error(`Periode ${periodId} memiliki data BPKal. Hapus BPKal dulu.`);

  const { data: system } = await supabase.from("sipakdesa_system_parameters").select("period_id").eq("period_id", pId).maybeSingle();
  if (system) throw new Error(`Periode ${periodId} memiliki data parameter sistem. Hapus parameter dulu.`);

  const { data: ahpRun } = await supabase.from("sipakdesa_ahp_runs").select("id").eq("period_id", pId).limit(1);
  if (ahpRun && ahpRun.length) throw new Error(`Periode ${periodId} memiliki data AHP.`);

  const { data: praRun } = await supabase.from("sipakdesa_pra_kalkulasi_runs").select("id").eq("period_id", pId).limit(1);
  if (praRun && praRun.length) throw new Error(`Periode ${periodId} memiliki data pra-kalkulasi.`);

  const { data: mooraRun } = await supabase.from("sipakdesa_moora_runs").select("id").eq("period_id", pId).limit(1);
  if (mooraRun && mooraRun.length) throw new Error(`Periode ${periodId} memiliki hasil MOORA.`);

  const { error } = await supabase
    .from("sipakdesa_periods")
    .delete()
    .eq("id", pId);

  if (error) throw new Error(`Gagal menghapus periode: ${error.message}`);
  return { success: true, id: pId };
};

export const getAllPeriods = async () => {
  const { data, error } = await supabase
    .from("sipakdesa_periods")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Gagal memuat periode: ${error.message}`);
  }

  return data.map((p) => ({
    id: p.id,
    year: p.year,
    isActive: p.is_active,
    active: p.is_active,
    locked: p.locked,
    needs_recalc: p.needs_recalc,
    ahpDone: p.ahp_done,
    praKalkulasiDone: p.pra_kalkulasi_done,
    mooraDone: p.moora_done,
    praKalkulasiResult: p.pra_kalkulasi_result || {},
    createdAt: p.created_at,
  }));
};

export const getPeriod = async (periodId) => {
  const { data, error } = await supabase
    .from("sipakdesa_periods")
    .select("*")
    .eq("id", String(periodId))
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat detail periode: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    year: data.year,
    isActive: data.is_active,
    active: data.is_active,
    locked: data.locked,
    needs_recalc: data.needs_recalc,
    ahpDone: data.ahp_done,
    praKalkulasiDone: data.pra_kalkulasi_done,
    mooraDone: data.moora_done,
    praKalkulasiResult: data.pra_kalkulasi_result || {},
    createdAt: data.created_at,
  };
};

export const deletePeriodForce = async (periodId) => {
  if (!periodId) throw new Error("periodId wajib diisi");
  const pId = String(periodId);

  await deletePeriodRelatedData(pId);

  const { error } = await supabase
    .from("sipakdesa_periods")
    .delete()
    .eq("id", pId);

  if (error) {
    throw new Error(`Gagal menghapus periode: ${error.message}`);
  }

  return { success: true, id: pId };
};
