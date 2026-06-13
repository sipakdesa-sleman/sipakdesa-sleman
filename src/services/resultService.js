import { supabase } from "../supabase/supabaseConfig";

async function getLatestMooraRun(periodId) {
  const { data, error } = await supabase
    .from("sipakdesa_moora_runs")
    .select("*")
    .eq("period_id", String(periodId))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export const getResultsByPeriod = async (periodId) => {
  if (!periodId) return [];
  const latestRun = await getLatestMooraRun(periodId);
  if (!latestRun) return [];

  const { data, error } = await supabase
    .from("sipakdesa_moora_run_items")
    .select("*")
    .eq("run_id", latestRun.id)
    .order("rank", { ascending: true });

  if (error) return [];

  return data.map((row) => ({
    id: row.desa_id,
    alternativeId: row.desa_id,
    name: row.name,
    rank: row.rank,
    yi: row.yi,
    nominal: row.nominal,
    normalized: row.normalized,
    weighted: row.weighted,
    scores: row.scores,
    ahpResultsId: latestRun.ahp_results_id,
  }));
};

export const getResultDetail = async (periodId, altId) => {
  if (!periodId || !altId) return null;
  const latestRun = await getLatestMooraRun(periodId);
  if (!latestRun) return null;

  const { data, error } = await supabase
    .from("sipakdesa_moora_run_items")
    .select("*")
    .eq("run_id", latestRun.id)
    .eq("desa_id", altId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.desa_id,
    alternativeId: data.desa_id,
    name: data.name,
    rank: data.rank,
    yi: data.yi,
    nominal: data.nominal,
    normalized: data.normalized,
    weighted: data.weighted,
    scores: data.scores,
    ahpResultsId: latestRun.ahp_results_id,
  };
};

export const saveMooraResults = async ({ periodId, rankings, ahpId, detail }) => {
  if (!periodId) throw new Error("periodId wajib diisi");
  console.log("saveMooraResults: saving for period", periodId, "with", rankings?.length, "rankings");

  const timestamp = Date.now();
  const runId = `run_${timestamp}`;

  // 1. Save run metadata into sipakdesa_moora_runs
  const { error: runError } = await supabase
    .from("sipakdesa_moora_runs")
    .insert([
      {
        id: runId,
        period_id: String(periodId),
        ahp_results_id: ahpId || null,
        label: detail?.label ?? null,
        created_at: new Date().toISOString(),
      },
    ]);

  if (runError) {
    throw new Error(`Gagal menyimpan run MOORA: ${runError.message}`);
  }

  // 2. Save items into sipakdesa_moora_run_items
  const normMap = buildMap(detail?.normalizedMatrix);
  const weightMap = buildMap(detail?.weightedMatrix);
  const scoreMap = buildMap(detail?.scoreMatrix);

  const itemsToInsert = rankings.map((r) => {
    const id = r.id ?? r.name;
    return {
      run_id: runId,
      desa_id: r.id || null,
      name: r.name,
      yi: Number(r.yi ?? 0),
      rank: Number(r.rank ?? 0),
      nominal: r.nominal ?? null,
      normalized: normMap[id]?.values ?? {},
      weighted: weightMap[id]?.values ?? {},
      scores: scoreMap[id]?.values ?? {},
      created_at: new Date().toISOString(),
    };
  });

  const { error: itemsError } = await supabase
    .from("sipakdesa_moora_run_items")
    .insert(itemsToInsert);

  if (itemsError) {
    throw new Error(`Gagal menyimpan detail items MOORA: ${itemsError.message}`);
  }

  console.log("saveMooraResults: committed successfully to Supabase for period", periodId, "run", runId);
  return { runId };
};

export const getMooraRuns = async (periodId) => {
  if (!periodId) return [];
  const { data, error } = await supabase
    .from("sipakdesa_moora_runs")
    .select("*")
    .eq("period_id", String(periodId))
    .order("created_at", { ascending: false });

  if (error) return [];
  return data.map((d) => ({
    id: d.id,
    runId: d.id,
    period: d.period_id,
    ahpResultsId: d.ahp_results_id,
    label: d.label,
    timestamp: d.created_at,
    createdAt: d.created_at,
  }));
};

function buildMap(arr) {
  const map = {};
  (arr ?? []).forEach((row) => {
    const key = row.id ?? row.name;
    map[key] = row;
  });
  return map;
}

export const getResultsByRun = async (runId) => {
  if (!runId) return [];
  const { data, error } = await supabase
    .from("sipakdesa_moora_run_items")
    .select("*")
    .eq("run_id", runId)
    .order("rank", { ascending: true });

  if (error) return [];
  
  return data.map((row) => ({
    id: row.desa_id,
    alternativeId: row.desa_id,
    name: row.name,
    rank: row.rank,
    yi: row.yi,
    nominal: row.nominal,
    normalized: row.normalized,
    weighted: row.weighted,
    scores: row.scores,
  }));
};
