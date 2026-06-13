import { supabase } from "../supabase/supabaseConfig";

export async function getDashboardStats() {
  const { count: alternativesCount } = await supabase
    .from("sipakdesa_alternatives")
    .select("*", { count: "exact", head: true });

  const { data: criteriaData } = await supabase
    .from("sipakdesa_criteria")
    .select("code, active, nature");

  const activeQualitativeCodes = new Set(
    (criteriaData || [])
      .filter(c => c.active !== false && String(c.nature).toLowerCase() === "kualitatif")
      .map(c => String(c.code).toUpperCase().trim())
  );

  const { data: parametersData } = await supabase
    .from("sipakdesa_parameters")
    .select("criteria_code");

  const totalParameters = (parametersData || [])
    .filter(p => {
      const code = String(p.criteria_code).toUpperCase().trim();
      return activeQualitativeCodes.has(code);
    }).length;

  const { count: periodsCount } = await supabase
    .from("sipakdesa_periods")
    .select("*", { count: "exact", head: true });

  return {
    totalAlternatives: alternativesCount || 0,
    totalCriteria: criteriaData?.length || 0,
    totalParameters,
    totalPeriods: periodsCount || 0
  };
}

export async function getLatestRanking() {
  try {
    const { data: dbPeriods } = await supabase
      .from("sipakdesa_periods")
      .select("*");

    if (!dbPeriods || dbPeriods.length === 0) return [];

    const periods = dbPeriods.map((p) => ({
      id: p.id,
      year: p.year,
      isActive: p.is_active,
      active: p.is_active,
      mooraDone: p.moora_done,
      ahpDone: p.ahp_done,
    }));

    let activePeriods = periods.filter((p) => p.isActive || p.active);
    let active = null;
    const activePeriodWithMoora = activePeriods.filter(p => p.mooraDone);

    if (activePeriodWithMoora.length > 0) {
      active = activePeriodWithMoora.sort((a, b) => Number(b.year) - Number(a.year))[0];
    } else if (activePeriods.length > 0) {
      const periodsWithMoora = periods.filter(p => p.mooraDone);
      if (periodsWithMoora.length > 0) {
        active = periodsWithMoora.sort((a, b) => Number(b.year) - Number(a.year))[0];
      } else {
        active = activePeriods.sort((a, b) => Number(b.year) - Number(a.year))[0];
      }
    } else if (periods.length > 0) {
      const periodsWithMoora = periods.filter(p => p.mooraDone);
      if (periodsWithMoora.length > 0) {
        active = periodsWithMoora.sort((a, b) => Number(b.year) - Number(a.year))[0];
      } else {
        active = periods.sort((a, b) => Number(b.year) - Number(a.year))[0];
      }
    }

    if (!active) return [];

    const { data: runs } = await supabase
      .from("sipakdesa_moora_runs")
      .select("*")
      .eq("period_id", active.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!runs || runs.length === 0) return [];
    const latestRun = runs[0];

    const { data: results } = await supabase
      .from("sipakdesa_moora_run_items")
      .select("*")
      .eq("run_id", latestRun.id)
      .order("rank", { ascending: true })
      .limit(5);

    if (!results) return [];

    return results.map((row) => ({
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
  } catch (err) {
    console.error("Dashboard getLatestRanking error:", err);
    return [];
  }
}

export async function getDashboardData() {
  try {
    // 1. Fetch Stats & Villages
    const { data: alternativesData } = await supabase
      .from("sipakdesa_alternatives")
      .select("*");

    const totalAlternatives = alternativesData?.length || 0;
    const villages = (alternativesData || []).map((d) => ({
      id: d.id,
      name: d.name ?? "",
      kecamatan: d.kecamatan ?? "",
    }));

    const { data: criteriaData } = await supabase
      .from("sipakdesa_criteria")
      .select("code, active, nature");

    const activeQualitativeCodes = new Set(
      (criteriaData || [])
        .filter(c => c.active !== false && String(c.nature).toLowerCase() === "kualitatif")
        .map(c => String(c.code).toUpperCase().trim())
    );

    const { data: parametersData } = await supabase
      .from("sipakdesa_parameters")
      .select("criteria_code");

    const totalParameters = (parametersData || [])
      .filter(p => {
        const code = String(p.criteria_code).toUpperCase().trim();
        return activeQualitativeCodes.has(code);
      }).length;

    const { data: dbPeriods } = await supabase
      .from("sipakdesa_periods")
      .select("*");

    const stats = {
      totalAlternatives,
      totalCriteria: criteriaData?.length || 0,
      totalParameters,
      totalPeriods: dbPeriods?.length || 0
    };

    // 2. Fetch Periods
    const periods = (dbPeriods || []).map((p) => ({
      id: p.id,
      year: p.year,
      isActive: p.is_active,
      active: p.is_active,
      mooraDone: p.moora_done,
      ahpDone: p.ahp_done,
      praKalkulasiDone: p.pra_kalkulasi_done,
      praKalkulasiResult: p.pra_kalkulasi_result,
      locked: p.locked,
    }));

    // Find active period
    let activePeriods = periods.filter((p) => p.isActive || p.active);
    let activePeriod = null;
    const activePeriodWithMoora = activePeriods.filter(p => p.mooraDone);

    if (activePeriodWithMoora.length > 0) {
      activePeriod = activePeriodWithMoora.sort((a, b) => Number(b.year) - Number(a.year))[0];
    } else if (activePeriods.length > 0) {
      const periodsWithMoora = periods.filter(p => p.mooraDone);
      if (periodsWithMoora.length > 0) {
        activePeriod = periodsWithMoora.sort((a, b) => Number(b.year) - Number(a.year))[0];
      } else {
        activePeriod = activePeriods.sort((a, b) => Number(b.year) - Number(a.year))[0];
      }
    } else if (periods.length > 0) {
      const periodsWithMoora = periods.filter(p => p.mooraDone);
      if (periodsWithMoora.length > 0) {
        activePeriod = periodsWithMoora.sort((a, b) => Number(b.year) - Number(a.year))[0];
      } else {
        activePeriod = periods.sort((a, b) => Number(b.year) - Number(a.year))[0];
      }
    }

    // 3. Load latest MOORA rankings
    let latestRanking = [];
    let ahpMeta = null;

    if (activePeriod) {
      const { data: runs } = await supabase
        .from("sipakdesa_moora_runs")
        .select("*")
        .eq("period_id", activePeriod.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (runs && runs.length > 0) {
        const latestRun = runs[0];

        const { data: results } = await supabase
          .from("sipakdesa_moora_run_items")
          .select("*")
          .eq("run_id", latestRun.id)
          .order("rank", { ascending: true });

        if (results) {
          latestRanking = results.map((row) => ({
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
        }

        if (latestRun.ahp_results_id) {
          const { data: ahpRun } = await supabase
            .from("sipakdesa_ahp_runs")
            .select("*")
            .eq("id", latestRun.ahp_results_id)
            .maybeSingle();

          if (ahpRun) {
            ahpMeta = {
              id: ahpRun.id,
              period: ahpRun.period_id,
              CR: typeof ahpRun.cr === "number" ? ahpRun.cr : null,
              createdAt: ahpRun.created_at,
            };
          }
        }
      }
    }

    return {
      stats,
      periods,
      activePeriod,
      latestRanking,
      villages,
      ahpMeta
    };
  } catch (err) {
    console.error("getDashboardData error:", err);
    throw err;
  }
}
