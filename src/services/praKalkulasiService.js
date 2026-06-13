import { supabase } from "../supabase/supabaseConfig";
import { getVillagesWithPeriodData } from "./desaService";
import { computePraKalkulasi } from "../utils/praKalkulasi";
import { setPraKalkulasiResult } from "./periodService";
import { getBpkalConfig } from "./bpkalService";

async function getPeriodDoc(periodId) {
  const { data, error } = await supabase
    .from("sipakdesa_periods")
    .select("*")
    .eq("id", String(periodId))
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal mengambil data periode: ${error.message}`);
  }
  return data;
}

async function getSystemParametersDoc(yearKey) {
  const { data, error } = await supabase
    .from("sipakdesa_system_parameters")
    .select("*")
    .eq("period_id", String(yearKey))
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal mengambil parameter sistem: ${error.message}`);
  }
  return data;
}

function resolveSystemYear(periodId, period) {
  return String(period?.year ?? periodId).trim();
}

function normalizeSystemParameters(data = {}) {
  return {
    umk_aktif: data.umk_aktif ?? data.umk ?? data.umkAktif ?? null,
    rate_bpjs_kes: data.rate_bpjs_kes ?? data.bpjsKes ?? null,
    rate_bpjs_naker: data.rate_bpjs_naker ?? data.bpjsNaker ?? null,
    siltap_lurah: data.siltap_lurah ?? data.tarif_lurah ?? data.lurah ?? null,
    siltap_carik: data.siltap_carik ?? data.tarif_carik ?? data.carik ?? null,
    siltap_kasi: data.siltap_kasi ?? data.tarif_kasi ?? data.kasi ?? null,
    siltap_dukuh: data.siltap_dukuh ?? data.tarif_dukuh ?? data.dukuh ?? null,
    default_lurah_count: data.default_lurah_count ?? data.lurah_count ?? 1,
    default_carik_count: data.default_carik_count ?? data.carik_count ?? 1,
    default_kasi_kaur_count: data.default_kasi_kaur_count ?? data.kasi_kaur_count ?? 6,
    bpjs_staff_count: data.bpjs_staff_count ?? 8,
  };
}

export async function getPraKalkulasiContext(periodId) {
  if (!periodId) throw new Error("periodId wajib diisi");
  const period = await getPeriodDoc(periodId);
  if (!period) throw new Error("Periode tidak ditemukan: " + periodId);
  const yearKey = resolveSystemYear(periodId, period);
  const systemParameters = await getSystemParametersDoc(yearKey);
  const bpkalConfig = await getBpkalConfig(periodId);
  const villages = await getVillagesWithPeriodData(periodId);

  // Extract pagu and kebijakan parameters stored inside jsonb pra_kalkulasi_result
  const paguTotalKab = period.pra_kalkulasi_result?.pagu_total_kab ?? period.pra_kalkulasi_result?.paguKab ?? 0;
  const isKebijakanActive = !!period.pra_kalkulasi_result?.is_kebijakan_active;

  return {
    period: {
      id: period.id,
      year: period.year,
      isActive: period.is_active,
      active: period.is_active,
      locked: period.locked || !!period.pra_kalkulasi_result?.locked,
      globalLocked: period.locked,
      needs_recalc: period.needs_recalc,
      ahp_done: period.ahp_done,
      ahpDone: period.ahp_done,
      pra_kalkulasi_done: period.pra_kalkulasi_done,
      praKalkulasiDone: period.pra_kalkulasi_done,
      moora_done: period.moora_done,
      mooraDone: period.moora_done,
      pra_kalkulasi_result: period.pra_kalkulasi_result || {},
      praKalkulasiResult: period.pra_kalkulasi_result || {},
      pagu_total_kab: paguTotalKab,
      paguKab: paguTotalKab,
      is_kebijakan_active: isKebijakanActive,
      isKebijakanActive: isKebijakanActive,
    },
    yearKey,
    systemParameters: normalizeSystemParameters(systemParameters ?? {}),
    bpkalConfig,
    hasSystemParameters: !!systemParameters,
    hasBpkalConfig: !!bpkalConfig,
    villages,
  };
}

export async function savePraKalkulasiSystemParameters(periodId, payload = {}) {
  if (!periodId) throw new Error("periodId wajib diisi");
  const normalized = normalizeSystemParameters(payload);
  
  const { error } = await supabase
    .from("sipakdesa_system_parameters")
    .upsert({
      period_id: String(periodId),
      umk_aktif: normalized.umk_aktif,
      rate_bpjs_kes: normalized.rate_bpjs_kes,
      rate_bpjs_naker: normalized.rate_bpjs_naker,
      siltap_lurah: normalized.siltap_lurah,
      siltap_carik: normalized.siltap_carik,
      siltap_kasi: normalized.siltap_kasi,
      siltap_dukuh: normalized.siltap_dukuh,
      default_lurah_count: normalized.default_lurah_count,
      default_carik_count: normalized.default_carik_count,
      default_kasi_kaur_count: normalized.default_kasi_kaur_count,
      bpjs_staff_count: normalized.bpjs_staff_count,
      updated_at: new Date().toISOString(),
    }, { onConflict: "period_id" });

  if (error) {
    throw new Error(`Gagal menyimpan parameter sistem: ${error.message}`);
  }

  return { id: String(periodId), ...normalized };
}

export async function executePraKalkulasi(periodId, ADD_kab_input, overrides = {}) {
  if (!periodId) throw new Error("periodId wajib diisi");

  const { period, yearKey, systemParameters, bpkalConfig, villages } = await getPraKalkulasiContext(periodId);
  const mergedSystemParameters = {
    ...systemParameters,
    ...normalizeSystemParameters({
      umk_aktif: overrides.umk_aktif ?? overrides.umk ?? systemParameters.umk_aktif,
      rate_bpjs_kes: overrides.rate_bpjs_kes ?? overrides.bpjsKes ?? systemParameters.rate_bpjs_kes,
      rate_bpjs_naker: overrides.rate_bpjs_naker ?? overrides.bpjsNaker ?? systemParameters.rate_bpjs_naker,
      siltap_lurah: overrides.siltap_lurah ?? overrides.tarif_lurah ?? systemParameters.siltap_lurah,
      siltap_carik: overrides.siltap_carik ?? overrides.tarif_carik ?? systemParameters.siltap_carik,
      siltap_kasi: overrides.siltap_kasi ?? overrides.tarif_kasi ?? systemParameters.siltap_kasi,
      siltap_dukuh: overrides.siltap_dukuh ?? overrides.tarif_dukuh ?? systemParameters.siltap_dukuh,
      default_lurah_count: overrides.default_lurah_count ?? systemParameters.default_lurah_count,
      default_carik_count: overrides.default_carik_count ?? systemParameters.default_carik_count,
      default_kasi_kaur_count: overrides.default_kasi_kaur_count ?? systemParameters.default_kasi_kaur_count,
      bpjs_staff_count: overrides.bpjs_staff_count ?? systemParameters.bpjs_staff_count,
    }),
  };

  const isKebijakan = overrides.is_kebijakan_active ?? period.is_kebijakan_active ?? false;
  const paguKab = Number(ADD_kab_input ?? period.pagu_total_kab ?? 0);

  const result = computePraKalkulasi({ villages, systemParameters: mergedSystemParameters, bpkalConfig, isKebijakan, paguKab });

  return { period, yearKey, systemParameters: mergedSystemParameters, bpkalConfig, result };
}

export async function savePraKalkulasiRun(periodId, runPayload = {}, currentUser = null) {
  if (!periodId) throw new Error("periodId wajib diisi");
  if (!runPayload || !runPayload.perVillage) throw new Error("runPayload tidak lengkap");

  const runId = String(Date.now());
  const totals = runPayload.totals ?? {};
  const addKew = Number(runPayload.addKew ?? 0);

  // 1. Insert metadata run
  const { error: runError } = await supabase
    .from("sipakdesa_pra_kalkulasi_runs")
    .insert([
      {
        id: runId,
        period_id: String(periodId),
        label: runPayload.label ?? `pra_kalkulasi_${runId}`,
        summary: {
          ...totals,
          addKew,
        },
        pagu_total_kab: totals.paguTotalKab ?? totals.pagu_total_kab ?? null,
        pagu_kab: totals.paguKab ?? totals.pagu_kab ?? null,
        is_kebijakan_active: totals.isKebijakan ?? totals.is_kebijakan_active ?? null,
      },
    ]);

  if (runError) {
    throw new Error(`Gagal menyimpan run pra-kalkulasi: ${runError.message}`);
  }

  // 2. Insert items in batch
  const itemsToInsert = runPayload.perVillage.map((row) => {
    const siltap_count = row.siltapCount ?? row.siltap_count ?? {
      lurah: row.lurahCount ?? 0,
      carik: row.carikCount ?? 0,
      kasi: row.kasiCount ?? 0,
      dukuh: row.jumlah_dukuh ?? 0,
    };
    const bpkal_count = row.bpkalCount ?? row.bpkal_count ?? row.jumlah_bpkal ?? null;

    return {
      run_id: runId,
      desa_id: row.id,
      desa_name: row.nama ?? row.name ?? "",
      kecamatan: row.kecamatan ?? "",
      siltap_count,
      bpkal_count,
      add_sil: row.addSil ?? row.add_sil ?? null,
      add_kes: row.addKes ?? row.add_kes ?? null,
      add_ker: row.addKer ?? row.add_ker ?? null,
      add_keb: row.addKeb ?? row.add_keb ?? null,
      add_bpkal: row.addBPKal ?? row.add_bpkal ?? null,
    };
  });

  const { error: itemsError } = await supabase
    .from("sipakdesa_pra_kalkulasi_run_items")
    .insert(itemsToInsert);

  if (itemsError) {
    throw new Error(`Gagal menyimpan detail items pra-kalkulasi: ${itemsError.message}`);
  }

  // 3. Update period document with result summary and lock
  await setPraKalkulasiResult(String(periodId), {
    runId,
    summary: totals,
    addKew,
    updatedBy: currentUser?.uid ?? currentUser?.id ?? null,
    locked: true,
  });

  return { runId };
}

export async function getPraKalkulasiRun(periodId, runId) {
  if (!periodId || !runId) return null;

  const { data: runData, error: runError } = await supabase
    .from("sipakdesa_pra_kalkulasi_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !runData) return null;

  const { data: items, error: itemsError } = await supabase
    .from("sipakdesa_pra_kalkulasi_run_items")
    .select("*")
    .eq("run_id", runId);

  if (itemsError) return null;

  const perVillage = items.map((row) => {
    const addSil = Number(row.add_sil || 0);
    const addKes = Number(row.add_kes || 0);
    const addKer = Number(row.add_ker || 0);
    const addBPKal = Number(row.add_bpkal || 0);
    const addKeb = Number(row.add_keb || 0);
    const totalPotonganWajib = addSil + addKes + addKer + addBPKal + addKeb;

    return {
      id: row.desa_id,
      nama: row.desa_name,
      kecamatan: row.kecamatan,
      siltapCount: row.siltap_count,
      bpkalCount: row.bpkal_count,
      jumlah_dukuh: Number(row.siltap_count?.dukuh ?? 0),
      jumlah_bpkal: Number(row.bpkal_count ?? 0),
      addSil,
      addKes,
      addKer,
      addKeb,
      addBPKal,
      totalPotonganWajib,
      addKewenanganKegiatan: 0,
    };
  });

  return {
    perVillage,
    totals: runData.summary ?? {},
    addKew: runData.summary?.addKew ?? 0,
    label: runData.label,
  };
}
