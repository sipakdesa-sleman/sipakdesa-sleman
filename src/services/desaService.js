import { supabase } from "../supabase/supabaseConfig";
import { getAllCriteria } from "./criteriaService";

export async function getAllDesa() {
  const { data, error } = await supabase
    .from("sipakdesa_alternatives")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(`Gagal mengambil data kalurahan: ${error.message}`);
  }

  return data.map((d) => ({
    id: d.id,
    code: d.code ?? null,
    nama: d.name ?? "",
    kecamatan: d.kecamatan ?? "",
    jumlah_dukuh: d.jumlah_dukuh ?? null,
    jumlah_padukuhan: d.jumlah_padukuhan ?? null,
    jumlah_bpkal: d.jumlah_bpkal ?? null,
    jumlah_penduduk_miskin: null,
    luas_wilayah: null,
    jumlah_penduduk: null,
    indeks_kesulitan_geografis: null,
    createdAt: d.created_at ?? null,
  }));
}

export async function createDesa(payload) {
  // 1. Fetch existing alternatives to find the highest A<number> index
  const { data: list, error: listError } = await supabase
    .from("sipakdesa_alternatives")
    .select("code");

  let nextNum = 1;
  if (!listError && list && list.length > 0) {
    const numbers = list
      .map((item) => {
        const match = String(item.code || "").match(/^A(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => !isNaN(num));
    if (numbers.length > 0) {
      nextNum = Math.max(...numbers) + 1;
    }
  }

  const nextId = `A${nextNum}`;

  const { data, error } = await supabase
    .from("sipakdesa_alternatives")
    .insert([
      {
        id: nextId,
        code: nextId,
        name: payload.name ?? payload.nama ?? "",
        kecamatan: payload.kecamatan ?? "",
        jumlah_padukuhan: payload.jumlah_padukuhan ?? null,
        jumlah_dukuh: payload.jumlah_dukuh ?? null,
        jumlah_bpkal: payload.jumlah_bpkal ?? null,
      },
    ])
    .select("id")
    .single();

  if (error) {
    throw new Error(`Gagal membuat data kalurahan: ${error.message}`);
  }
  return { id: data.id };
}

export async function updateDesa(id, payload) {
  const { error } = await supabase
    .from("sipakdesa_alternatives")
    .update({
      name: payload.name ?? payload.nama,
      kecamatan: payload.kecamatan,
      jumlah_padukuhan: payload.jumlah_padukuhan ?? null,
      jumlah_dukuh: payload.jumlah_dukuh ?? null,
      jumlah_bpkal: payload.jumlah_bpkal ?? null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Gagal memperbarui data kalurahan: ${error.message}`);
  }
}

export async function deleteDesa(id) {
  const { error } = await supabase
    .from("sipakdesa_alternatives")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Gagal menghapus data kalurahan: ${error.message}`);
  }
}

// Raw criteria values per desa-periode
export async function getRawValuesForDesaPeriod(desaId, periodId) {
  const { data, error } = await supabase
    .from("sipakdesa_desa_raw_values")
    .select("*")
    .eq("desa_id", desaId)
    .eq("period_id", String(periodId))
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal mengambil nilai kriteria: ${error.message}`);
  }

  if (!data) return null;

  return {
    periodId: data.period_id,
    values: data.values ?? {},
    jumlah_bpkal: data.jumlah_bpkal,
    updatedAt: data.updated_at,
  };
}

export async function setRawValuesForDesaPeriod(desaId, periodId, values, _meta = {}) {
  const bpkal = values?.jumlah_bpkal ?? null;

  const payload = {
    desa_id: desaId,
    period_id: String(periodId),
    values: values || {},
    jumlah_bpkal: bpkal === "" || bpkal === null ? null : Number(bpkal),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("sipakdesa_desa_raw_values")
    .upsert(payload, { onConflict: "desa_id,period_id" });

  if (error) {
    throw new Error(`Gagal menyimpan nilai kriteria kalurahan: ${error.message}`);
  }
}

export async function listRawValuesForPeriod(periodId) {
  const { data, error } = await supabase
    .from("sipakdesa_desa_raw_values")
    .select("*")
    .eq("period_id", String(periodId));

  if (error) {
    throw new Error(`Gagal mengambil daftar nilai kriteria: ${error.message}`);
  }

  return data.map((d) => ({
    id: d.desa_id,
    desaRefPath: `sipakdesa_alternatives/${d.desa_id}/rawCriteriaValues/${d.period_id}`,
    values: {
      ...d.values,
      jumlah_bpkal: d.jumlah_bpkal,
    },
    jumlah_bpkal: d.jumlah_bpkal,
    periodId: d.period_id,
  }));
}

export async function getVillagesWithPeriodData(periodId) {
  if (!periodId) throw new Error("periodId wajib diisi");
  const villages = await getAllDesa();

  // Ambil kriteria master untuk deteksi dinamis
  const criteria = await getAllCriteria().catch(() => []);

  const padukuhanCriteria = criteria.find(
    (c) =>
      c.code === "C1" ||
      c.name.toLowerCase().includes("padukuhan") ||
      c.name.toLowerCase().includes("dukuh")
  );
  const padukuhanCode = padukuhanCriteria ? padukuhanCriteria.code : "C1";

  const miskinCriteria = criteria.find(
    (c) => c.code === "C2" || c.name.toLowerCase().includes("miskin")
  );
  const miskinCode = miskinCriteria ? miskinCriteria.code : "C2";

  const luasCriteria = criteria.find(
    (c) =>
      c.code === "C3" ||
      (c.name.toLowerCase().includes("luas") &&
        c.name.toLowerCase().includes("wilayah"))
  );
  const luasCode = luasCriteria ? luasCriteria.code : "C3";

  const pendudukCriteria = criteria.find(
    (c) =>
      c.code === "C4" ||
      (c.name.toLowerCase().includes("penduduk") &&
        !c.name.toLowerCase().includes("miskin"))
  );
  const pendudukCode = pendudukCriteria ? pendudukCriteria.code : "C4";

  const geografisCriteria = criteria.find(
    (c) =>
      c.code === "C5" ||
      c.name.toLowerCase().includes("geografis") ||
      c.name.toLowerCase().includes("kesulitan")
  );
  const geografisCode = geografisCriteria ? geografisCriteria.code : "C5";

  let rawValues = [];
  try {
    rawValues = await listRawValuesForPeriod(periodId);
  } catch (e) {
    console.warn("listRawValuesForPeriod failed, using fallback:", e);
  }

  const rawMap = new Map();
  rawValues.forEach((row) => {
    const pathParts = String(row.desaRefPath ?? "").split("/");
    const desaId = pathParts.length >= 2 ? pathParts[1] : null;
    if (desaId) {
      rawMap.set(desaId, row.values ?? {});
    }
  });

  // Jika rawMap masih kosong, lakukan fetch data secara individu untuk tiap desa
  if (rawMap.size === 0 && villages.length > 0) {
    const individualResults = await Promise.all(
      villages.map(async (v) => {
        const docVal = await getRawValuesForDesaPeriod(v.id, periodId).catch(() => null);
        return [v.id, docVal?.values ?? null];
      })
    );
    individualResults.forEach(([desaId, values]) => {
      if (values) {
        rawMap.set(desaId, values);
      }
    });
  }

  return villages.map((item) => {
    const periodData = rawMap.get(item.id);
    if (!periodData) {
      return item;
    }

    const dynamicCriteriaValues = {};
    Object.entries(periodData).forEach(([key, val]) => {
      dynamicCriteriaValues[key] = val;
      dynamicCriteriaValues[key.toLowerCase()] = val;
    });

    return {
      ...item,
      ...dynamicCriteriaValues,
      jumlah_padukuhan:
        periodData[padukuhanCode] !== undefined && periodData[padukuhanCode] !== null
          ? Number(periodData[padukuhanCode])
          : item.jumlah_padukuhan,
      jumlah_dukuh:
        periodData[padukuhanCode] !== undefined && periodData[padukuhanCode] !== null
          ? Number(periodData[padukuhanCode])
          : item.jumlah_dukuh,
      jumlah_penduduk_miskin:
        periodData[miskinCode] !== undefined && periodData[miskinCode] !== null
          ? Number(periodData[miskinCode])
          : item.jumlah_penduduk_miskin,
      luas_wilayah:
        periodData[luasCode] !== undefined && periodData[luasCode] !== null
          ? Number(periodData[luasCode])
          : item.luas_wilayah,
      jumlah_penduduk:
        periodData[pendudukCode] !== undefined && periodData[pendudukCode] !== null
          ? Number(periodData[pendudukCode])
          : item.jumlah_penduduk,
      indeks_kesulitan_geografis:
        periodData[geografisCode] !== undefined &&
        periodData[geografisCode] !== null
          ? Number(periodData[geografisCode])
          : item.indeks_kesulitan_geografis,
      jumlah_bpkal:
        periodData.jumlah_bpkal !== undefined && periodData.jumlah_bpkal !== null
          ? Number(periodData.jumlah_bpkal)
          : item.jumlah_bpkal,
    };
  });
}

export async function copyDesaRawValues(fromPeriod, toPeriod) {
  if (!fromPeriod || !toPeriod) throw new Error("Periode sumber dan target wajib diisi");

  const { data: sourceValues, error: fetchError } = await supabase
    .from("sipakdesa_desa_raw_values")
    .select("*")
    .eq("period_id", String(fromPeriod));

  if (fetchError) {
    throw new Error(`Gagal mengambil data dari periode ${fromPeriod}: ${fetchError.message}`);
  }

  if (!sourceValues || sourceValues.length === 0) {
    throw new Error(`Tidak ada data kriteria kalurahan yang dapat disalin dari periode ${fromPeriod}`);
  }

  const payloads = sourceValues.map((row) => ({
    desa_id: row.desa_id,
    period_id: String(toPeriod),
    values: row.values || {},
    jumlah_bpkal: row.jumlah_bpkal,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("sipakdesa_desa_raw_values")
    .upsert(payloads, { onConflict: "desa_id,period_id" });

  if (upsertError) {
    throw new Error(`Gagal menyalin data ke periode ${toPeriod}: ${upsertError.message}`);
  }

  return { success: true, count: payloads.length };
}

export async function saveBulkRawValues(payloads) {
  if (!payloads || payloads.length === 0) return;
  const { error } = await supabase
    .from("sipakdesa_desa_raw_values")
    .upsert(payloads, { onConflict: "desa_id,period_id" });

  if (error) {
    throw new Error(`Gagal menyimpan data kriteria massal: ${error.message}`);
  }
}
