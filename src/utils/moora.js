/**
 * mooraUtils.js
 * Modul logika untuk perhitungan Multi-Objective Optimization on the basis of Ratio Analysis (MOORA).
 * Digunakan untuk SIPAKDESA Sleman.
 */

// Cache untuk parameter yang sudah di-fetch
let parameterCache = null;
let parameterCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit cache

export const clearParameterCache = () => {
  parameterCache = null;
  parameterCacheTime = 0;
};

/**
 * Fetch parameter ranges dari Firestore (dengan caching)
 * @returns {Object} - Map dengan structure { C1: [...], C2: [...], ... }
 *                     Setiap kriteria memiliki array list dengan { min/max, score, label }
 */
export const fetchParameterRanges = async () => {
  // Return dari cache jika masih fresh
  const now = Date.now();
  if (parameterCache && (now - parameterCacheTime) < CACHE_DURATION) {
    return parameterCache;
  }

  try {
    const { getParameterMap } = await import("../services/criteriaService");
    const map = await getParameterMap();
    
    const grouped = {};
    Object.entries(map).forEach(([code, p]) => {
      if (p.list) {
        grouped[code] = {
          flatRows: p.list.map((item) => ({
            score: item.score,
            min: item.min,
            max: item.max,
            label: item.label || ""
          })),
          rows: []
        };
      }
    });

    const rangesByCode = {};
    Object.entries(grouped).forEach(([code, bucket]) => {
      const rows = bucket.flatRows.length > 0 ? bucket.flatRows : bucket.rows;
      if (rows.length > 0) {
        rangesByCode[code] = rows;
      }
    });

    // Untuk struktur lama, sort by min ascending
    Object.keys(rangesByCode).forEach(code => {
      rangesByCode[code].sort((a, b) => a.min - b.min);
    });

    parameterCache = rangesByCode;
    parameterCacheTime = now;
    return rangesByCode;
  } catch (err) {
    console.error("Error fetching parameter ranges:", err);
    // Return empty cache on error
    return {};
  }
};

/**
 * Fungsi Helper untuk Konversi Skor (Berdasarkan Parameter dari Firestore)
 * 
 * PENTING: Score di parameter SUDAH "clean" (benefit: besar=tinggi, cost: kecil=tinggi)
 * Fungsi ini HANYA lookup, TIDAK transform berdasarkan tipe benefit/cost
 * 
 * @param {number} value - Nilai mentah dari input.
 * @param {string} criteriaCode - Kode kriteria (C1, C2, ...).
 * @param {Object} parameterRanges - Map dari fetchParameterRanges()
 * @returns {number} - Skor 1-5 sesuai parameter
 */
export const getScore = (value, criteriaCode, parameterRanges = {}) => {
  const code = String(criteriaCode).toUpperCase();
  const ranges = parameterRanges[code];

  if (!ranges || ranges.length === 0) {
    console.warn(`Parameter ranges not found for ${code}, returning score 1`);
    return 1;
  }

  // Cari range atau opsi kualitatif yang sesuai dengan nilai
  const matchedRange = ranges.find(range => {
    // 1. Cocokan label kualitatif secara case-insensitive
    if (range.label && String(value).trim().toLowerCase() === String(range.label).trim().toLowerCase()) {
      return true;
    }
    // 2. Cocokan jika value sudah berupa score secara langsung
    if (String(value).trim() === String(range.score)) {
      return true;
    }
    // 3. Cocokan range numerik untuk kriteria kuantitatif (jika value adalah angka)
    const valueNum = Number(value);
    if (!isNaN(valueNum) && value !== null && value !== undefined && value !== "") {
      const withinMin = range.min === null || range.min === undefined || valueNum >= Number(range.min);
      const withinMax = range.max === null || range.max === undefined || valueNum <= Number(range.max);
      return withinMin && withinMax;
    }
    return false;
  });

  if (matchedRange) {
    return matchedRange.score;
  }

  // Fallback: return score terendah jika tidak ada range yang match
  console.warn(`Value ${value} tidak match range ${code}, returning lowest score`);
  const sortedByScore = [...ranges].sort((a, b) => a.score - b.score);
  return sortedByScore[0]?.score || 1;
};

/**
 * 2. Fungsi Utama Perhitungan MOORA (sekarang async)
 * @param {Array} alternatives - Array objek desa [{ name, c1, c2, ... }]
 * @param {Object} weights - Objek bobot dari AHP { C1: 0.319, C2: 0.051, ... }
 * @param {Object} criteriaTypes - Map tipe kriteria { C1: 'benefit', C2: 'cost', ... }
 * @returns {Promise<Array>} - Array hasil perankingan yang sudah diurutkan.
 */
export const calculateMOORA = async (alternatives, weights, criteriaTypes = {}) => {
  // Fetch parameter ranges dari Firestore untuk konversi nilai mentah kualitatif menjadi skor
  const parameterRanges = await fetchParameterRanges();
  
  // Ambil data lengkap kriteria untuk mendapatkan properti nature masing-masing
  let criteriaNatures = {};
  let resolvedTypes = { ...criteriaTypes };
  try {
    const { getAllCriteria } = await import("../services/criteriaService");
    const criteriaList = await getAllCriteria();
    criteriaList.forEach(c => {
      const code = c.code;
      
      criteriaNatures[code] = c.nature;
      if (c.type) {
        resolvedTypes[code] = c.type;
      }
    });
  } catch (err) {
    console.error("Gagal mengambil kriteria master untuk MOORA:", err);
  }
  
  // Ambil kriteria codes dari weights jika ada, fallback ke default
  const criteriaCodes = Object.keys(weights).length > 0 
    ? Object.keys(weights).sort()
    : ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  
  const missingTypes = criteriaCodes.filter((code) => {
    const type = resolvedTypes?.[code];
    return type !== 'benefit' && type !== 'cost';
  });
  if (missingTypes.length > 0) {
    throw new Error(`Tipe kriteria belum lengkap untuk: ${missingTypes.join(", ")}. Lengkapi field type di master kriteria Firestore.`);
  }

  const types = {};
  criteriaCodes.forEach((code) => {
    types[code] = String(resolvedTypes[code]).toLowerCase() === 'cost' ? 'cost' : 'benefit';
  });

  // Tahap A: Persiapan Matriks Awal (Konversi Kualitatif ke Skor, Kuantitatif tetap Nilai Mentah)
  const scoredData = alternatives.map(alt => {
    let scores = {};
    criteriaCodes.forEach(code => {
      const value = alt[code.toLowerCase()];
      const isQualitative = criteriaNatures[code] === "kualitatif";
      
      if (isQualitative) {
        scores[code] = getScore(value, code, parameterRanges);
      } else {
        const parsedValue = parseFloat(value);
        scores[code] = isNaN(parsedValue) ? 0 : parsedValue;
      }
    });
    return { ...alt, scores };
  });

  // Tahap B: Menghitung Denominator (Pembagi) per Kriteria
  // Rumus: Sqrt( Sum( Skor^2 atau NilaiMentah^2 ) )
  const denominators = {};
  criteriaCodes.forEach(code => {
    const sumSquares = scoredData.reduce((sum, alt) => sum + Math.pow(alt.scores[code], 2), 0);
    denominators[code] = Math.sqrt(sumSquares);
  });

  // Tahap C: Normalisasi Terbobot dan Optimasi (Yi)
  const results = scoredData.map(alt => {
    let sumBenefit = 0;
    let sumCost = 0;

    criteriaCodes.forEach(code => {
      // Normalisasi (R_ij)
      const normalized = denominators[code] !== 0 ? alt.scores[code] / denominators[code] : 0;
      
      // Terbobot (V_ij)
      const weighted = normalized * (weights[code] || 0);

      // Pisahkan Benefit dan Cost
      if ((types[code] || 'benefit').toLowerCase() === 'benefit') {
        sumBenefit += weighted;
      } else {
        sumCost += weighted;
      }
    });

    // Nilai Optimasi Yi = Sum(Benefit) - Sum(Cost)
    const yi = sumBenefit - sumCost;

    return {
      ...alt,
      yi: yi,
      rankStatus: '' // Akan diisi setelah sorting
    };
  });

  // Tahap D: Perankingan (Sorting dari Nilai Yi Tertinggi)
  return results.sort((a, b) => b.yi - a.yi);
};

export const attachNominalAllocation = (rankings = [], allocationPool = 0) => {
  const pool = Number(allocationPool ?? 0);
  const list = Array.isArray(rankings) ? rankings : [];
  const totalYi = list.reduce((sum, item) => sum + Math.max(Number(item?.yi ?? 0), 0), 0);
  const fallbackShare = list.length > 0 ? 1 / list.length : 0;

  return list.map((item) => {
    const yi = Number(item?.yi ?? 0);
    const share = totalYi > 0 ? Math.max(yi, 0) / totalYi : fallbackShare;
    const nominal = pool > 0 ? Math.ceil(pool * share) : 0;

    return {
      ...item,
      allocationPool: pool,
      nominalShare: share,
      nominal,
    };
  });
};