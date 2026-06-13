const POSITION_KEYS = ["ketua", "wakil", "sekretaris", "bidang", "anggota"];

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createEmptyBpkalTemplate(index = 0) {
  return {
    id: `template_${index + 1}`,
    name: "",
    total_bpkal: null,
    ketua: 1,
    wakil: 1,
    sekretaris: 1,
    bidang: null,
    anggota: null,
    active: true,
  };
}

export function createEmptyBpkalConfig() {
  return {
    period: "",
    active: true,
    tariffs: {
      ketua: null,
      wakil: null,
      sekretaris: null,
      bidang: null,
      anggota: null,
    },
    templates: [],
  };
}

export function normalizeBpkalTemplate(template = {}, index = 0) {
  const total = toNumberOrNull(template.total_bpkal ?? template.totalPeople ?? template.total ?? template.jumlah);

  return {
    id: String(template.id ?? template.templateId ?? template.code ?? `template_${index + 1}`),
    name: String(template.name ?? template.label ?? template.templateName ?? "").trim(),
    total_bpkal: total,
    ketua: Number(template.ketua ?? 1),
    wakil: Number(template.wakil ?? 1),
    sekretaris: Number(template.sekretaris ?? 1),
    bidang: toNumberOrNull(template.bidang ?? template.kepala_bidang ?? template.jumlah_bidang),
    anggota: toNumberOrNull(template.anggota ?? template.jumlah_anggota),
    active: template.active !== false,
  };
}

export function normalizeBpkalTariffs(tariffs = {}) {
  return {
    ketua: toNumberOrNull(tariffs.ketua ?? tariffs.tarif_ketua ?? tariffs.tarifKetua),
    wakil: toNumberOrNull(tariffs.wakil ?? tariffs.tarif_wakil ?? tariffs.tarifWakil),
    sekretaris: toNumberOrNull(tariffs.sekretaris ?? tariffs.tarif_sekretaris ?? tariffs.tarifSekretaris),
    bidang: toNumberOrNull(tariffs.bidang ?? tariffs.tarif_bidang ?? tariffs.tarifBidang),
    anggota: toNumberOrNull(tariffs.anggota ?? tariffs.tarif_anggota ?? tariffs.tarifAnggota),
  };
}

export function normalizeBpkalConfig(data = {}) {
  const templates = Array.isArray(data.templates) ? data.templates.map((item, index) => normalizeBpkalTemplate(item, index)) : [];
  return {
    period: String(data.period ?? data.periodId ?? "").trim(),
    active: data.active !== false,
    tariffs: normalizeBpkalTariffs(data.tariffs ?? data.tariffsData ?? {}),
    templates,
    updatedAt: data.updatedAt ?? data.updated_at ?? null,
  };
}

export function isBpkalTemplateComplete(template = {}) {
  const requiredKeys = ["name", "total_bpkal", "ketua", "wakil", "sekretaris", "bidang", "anggota"];
  return requiredKeys.every((key) => template[key] !== "" && template[key] !== null && template[key] !== undefined);
}

export function isBpkalTariffComplete(tariffs = {}) {
  return POSITION_KEYS.every((key) => tariffs[key] !== "" && tariffs[key] !== null && tariffs[key] !== undefined);
}

export function resolveBpkalTemplateByJumlah(config = {}, jumlahBpkal = 0) {
  const target = Number(jumlahBpkal || 0);
  if (!target) return null;
  return (config.templates ?? []).find((item) => item.active !== false && Number(item.total_bpkal || 0) === target) ?? null;
}

export function computeBpkalForVillage(village = {}, config = {}) {
  const jumlahBpkal = Number(village.jumlah_bpkal ?? village.jumlah_bpkal_people ?? village.bpkal ?? village.total_bpkal ?? 0);
  const template = resolveBpkalTemplateByJumlah(config, jumlahBpkal);
  const tariffs = normalizeBpkalTariffs(config.tariffs ?? {});

  const ketua = Number(template?.ketua ?? 1);
  const wakil = Number(template?.wakil ?? 1);
  const sekretaris = Number(template?.sekretaris ?? 1);
  const bidang = Number(template?.bidang ?? 0);
  const anggota = Number(template?.anggota ?? 0);

  const monthly = template
    ? (ketua * Number(tariffs.ketua ?? 0)) +
      (wakil * Number(tariffs.wakil ?? 0)) +
      (sekretaris * Number(tariffs.sekretaris ?? 0)) +
      (bidang * Number(tariffs.bidang ?? 0)) +
      (anggota * Number(tariffs.anggota ?? 0))
    : 0;

  const annual = monthly * 12;

  return {
    jumlahBpkal,
    bpkalTemplateId: template?.id ?? null,
    bpkalTemplateName: template?.name ?? "",
    bpkalTemplateTotal: Number(template?.total_bpkal ?? 0) || null,
    bpkalKetua: ketua,
    bpkalWakil: wakil,
    bpkalSekretaris: sekretaris,
    bpkalBidang: bidang,
    bpkalAnggota: anggota,
    bpkalTarifKetua: Number(tariffs.ketua ?? 0),
    bpkalTarifWakil: Number(tariffs.wakil ?? 0),
    bpkalTarifSekretaris: Number(tariffs.sekretaris ?? 0),
    bpkalTarifBidang: Number(tariffs.bidang ?? 0),
    bpkalTarifAnggota: Number(tariffs.anggota ?? 0),
    bpkalMonthly: monthly,
    addBPKal: annual,
  };
}

export { POSITION_KEYS as BPKAL_POSITION_KEYS };