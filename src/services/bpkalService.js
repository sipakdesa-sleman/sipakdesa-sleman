import { supabase } from "../supabase/supabaseConfig";
import { updatePeriodStatus } from "./periodService";
import { createEmptyBpkalConfig, normalizeBpkalConfig } from "../utils/bpkal";

async function getBpkalConfigDoc(periodId) {
  const { data, error } = await supabase
    .from("sipakdesa_bpkal_configs")
    .select("*")
    .eq("period_id", String(periodId))
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal mengambil data BPKal: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.period_id,
    period: data.period_id,
    active: data.active,
    tarif_ketua: data.tarif_ketua,
    tarif_wakil: data.tarif_wakil,
    tarif_sekretaris: data.tarif_sekretaris,
    tarif_bidang: data.tarif_bidang,
    tarif_anggota: data.tarif_anggota,
    templates: data.templates,
    updatedAt: data.updated_at,
  };
}

export async function getBpkalConfig(periodId) {
  if (!periodId) throw new Error("periodId wajib diisi");
  const docData = await getBpkalConfigDoc(periodId);
  if (!docData) {
    return {
      id: String(periodId),
      ...createEmptyBpkalConfig(),
      period: String(periodId),
    };
  }

  const normalized = normalizeBpkalConfig(docData);
  return {
    id: docData.id,
    ...normalized,
    period: String(docData.period ?? periodId),
  };
}

export async function saveBpkalConfig(periodId, payload = {}) {
  if (!periodId) throw new Error("periodId wajib diisi");

  const normalized = normalizeBpkalConfig({
    period: String(periodId),
    ...payload,
  });

  const dbPayload = {
    period_id: String(periodId),
    active: normalized.active !== false,
    tarif_ketua: normalized.tariffs?.ketua,
    tarif_wakil: normalized.tariffs?.wakil,
    tarif_sekretaris: normalized.tariffs?.sekretaris,
    tarif_bidang: normalized.tariffs?.bidang,
    tarif_anggota: normalized.tariffs?.anggota,
    templates: normalized.templates || {},
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("sipakdesa_bpkal_configs")
    .upsert(dbPayload, { onConflict: "period_id" });

  if (error) {
    throw new Error(`Gagal menyimpan konfigurasi BPKal: ${error.message}`);
  }

  await updatePeriodStatus(String(periodId), {
    praKalkulasiDone: false,
    mooraDone: false,
  });

  return { id: String(periodId), ...normalized };
}