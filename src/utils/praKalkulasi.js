import { computeBpkalForVillage } from "./bpkal";

export function roundRp(value) {
  return Number(Number(value) || 0);
}

export function computeVillageSums({ village, systemParameters = {}, bpkalConfig = {} }) {
  const tariffs = {
    lurah: Number(systemParameters.siltap_lurah ?? systemParameters.tarif_lurah ?? 0),
    carik: Number(systemParameters.siltap_carik ?? systemParameters.tarif_carik ?? 0),
    kasi: Number(systemParameters.siltap_kasi ?? systemParameters.tarif_kasi ?? 0),
    dukuh: Number(systemParameters.siltap_dukuh ?? systemParameters.tarif_dukuh ?? 0),
  };
  const umk = Number(systemParameters.umk_aktif ?? systemParameters.umk ?? 0);
  const rates = {
    bpjsKes: Number(systemParameters.rate_bpjs_kes ?? systemParameters.bpjsKes ?? 0),
    bpjsNaker: Number(systemParameters.rate_bpjs_naker ?? systemParameters.bpjsNaker ?? 0),
  };

  const lurahCount = Number(systemParameters.default_lurah_count ?? systemParameters.lurah_count ?? 1);
  const carikCount = Number(systemParameters.default_carik_count ?? systemParameters.carik_count ?? 1);
  const kasiCount = Number(systemParameters.default_kasi_kaur_count ?? systemParameters.kasi_kaur_count ?? 6);
  const dukuhCount = Number(village.jumlah_dukuh ?? village.jumlah_padukuhan ?? 0);
  const bpjsStaffCount = Number(systemParameters.bpjs_staff_count ?? 8);

  const monthly = (lurahCount * tariffs.lurah) + (carikCount * tariffs.carik) + (kasiCount * tariffs.kasi) + (dukuhCount * tariffs.dukuh);
  const siltapPokok12 = monthly * 12;
  const siltapPokok1 = monthly;
  const addSil = siltapPokok12;

  const addKes = Math.round(umk * rates.bpjsKes * bpjsStaffCount * 12);

  const addKerSiltapPart = siltapPokok12 * rates.bpjsNaker;
  const addKerUmkPart = umk * rates.bpjsNaker * bpjsStaffCount * 12;
  const addKer = Math.round(addKerSiltapPart + addKerUmkPart);
  const bpkal = computeBpkalForVillage(village, bpkalConfig);

  return {
    id: village.id,
    nama: village.nama ?? village.name ?? "",
    code: village.code ?? null,
    lurahCount,
    carikCount,
    kasiCount,
    jumlah_dukuh: dukuhCount,
    jumlah_bpkal: bpkal.jumlahBpkal,
    bpkalTemplateId: bpkal.bpkalTemplateId,
    bpkalTemplateName: bpkal.bpkalTemplateName,
    bpkalTemplateTotal: bpkal.bpkalTemplateTotal,
    bpkalKetua: bpkal.bpkalKetua,
    bpkalWakil: bpkal.bpkalWakil,
    bpkalSekretaris: bpkal.bpkalSekretaris,
    bpkalBidang: bpkal.bpkalBidang,
    bpkalAnggota: bpkal.bpkalAnggota,
    bpkalTarifKetua: bpkal.bpkalTarifKetua,
    bpkalTarifWakil: bpkal.bpkalTarifWakil,
    bpkalTarifSekretaris: bpkal.bpkalTarifSekretaris,
    bpkalTarifBidang: bpkal.bpkalTarifBidang,
    bpkalTarifAnggota: bpkal.bpkalTarifAnggota,
    bpkalMonthly: roundRp(bpkal.bpkalMonthly),
    addBPKal: roundRp(bpkal.addBPKal),
    bpjsStaffCount,
    monthly: roundRp(monthly),
    siltapPokok12: roundRp(siltapPokok12),
    siltapPokok1: roundRp(siltapPokok1),
    addSil: roundRp(addSil),
    addKes: roundRp(addKes),
    addKerSiltapPart,
    addKerUmkPart,
    addKer,
    tariffLurah: roundRp(tariffs.lurah),
    tariffCarik: roundRp(tariffs.carik),
    tariffKasi: roundRp(tariffs.kasi),
    tariffDukuh: roundRp(tariffs.dukuh),
    umk: roundRp(umk),
    rateBpjsKes: rates.bpjsKes,
    rateBpjsNaker: rates.bpjsNaker,
  };
}

export function computePraKalkulasi({ villages = [], systemParameters = {}, bpkalConfig = {}, isKebijakan = false, paguKab = 0 }) {
  const perVillage = villages.map(v => computeVillageSums({ village: v, systemParameters, bpkalConfig }));

  const perVillageWithKeb = perVillage.map(v => {
    const addKeb = isKebijakan ? roundRp(v.siltapPokok1 * 2) : 0;
    const totalPotonganWajib = Number(v.addSil || 0) + Number(v.addKes || 0) + Number(v.addKer || 0) + Number(v.addBPKal || 0) + Number(addKeb || 0);
    return {
      ...v,
      addKeb,
      totalPotonganWajib,
      addKewenanganKegiatan: 0,
    };
  });

  const totals = perVillageWithKeb.reduce((acc, r) => {
    acc.addSil += Number(r.addSil || 0);
    acc.addKes += Number(r.addKes || 0);
    acc.addKer += Number(r.addKer || 0);
    acc.addBPKal += Number(r.addBPKal || 0);
    acc.addKeb += Number(r.addKeb || 0);
    acc.totalPotonganWajib += Number(r.totalPotonganWajib || 0);
    return acc;
  }, { addSil: 0, addKes: 0, addKer: 0, addBPKal: 0, addKeb: 0, totalPotonganWajib: 0 });

  const addKew = Number(paguKab || 0) - Number(totals.totalPotonganWajib || 0);

  return { perVillage: perVillageWithKeb, totals: { ...totals }, addKew };
}
