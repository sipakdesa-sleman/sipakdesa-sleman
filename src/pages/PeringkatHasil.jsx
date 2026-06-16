import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import { useLocation } from "react-router-dom";
import { getAhpById } from "../services/ahpService";
import { getCriteria } from "../services/mooraService";
import { getMooraRuns, getResultsByRun } from "../services/resultService";
import { usePeriod } from "../context/PeriodContext";
import { getAllDesa } from "../services/desaService";
import { getPraKalkulasiRun } from "../services/praKalkulasiService";
import { useDialog } from "../context/DialogProvider";
import PeriodSelector from "../components/PeriodSelector";
import { Download, FileDown } from "lucide-react";


const fmtRpFullNoSymbol = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

function getRomanNumeral(num) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
  return roman[num - 1] ?? String(num);
}

function compareByCode(a, b) {
  const aCode = String(a.code ?? "").trim();
  const bCode = String(b.code ?? "").trim();
  if (aCode && bCode) {
    const aNum = parseInt(aCode, 10);
    const bNum = parseInt(bCode, 10);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return aCode.localeCompare(bCode, undefined, { numeric: true });
  }
  if (aCode) return -1;
  if (bCode) return 1;
  return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true });
}

export default function PeringkatHasil() {
  const { selectedPeriod, setSelectedPeriod, periods } = usePeriod();
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState("");
  const location = useLocation();
  const [queryRun] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('run');
  });
  const [results, setResults] = useState([]);
  const [ahpMeta, setAhpMeta] = useState(null);
  const [weights, setWeights] = useState([]);
  const reportRef = useRef(null);
  const [showDetail, setShowDetail] = useState(false);
  const [criteriaMap, setCriteriaMap] = useState({});
  const { alert } = useDialog();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("rank");
  const [sortDirection, setSortDirection] = useState("asc");

  const periodYear = useMemo(() => {
    return periods.find(p => p.id === selectedPeriod)?.year ?? new Date().getFullYear();
  }, [periods, selectedPeriod]);

  // New states for Bupati Decison Document parameters
  const [viewMode, setViewMode] = useState("analisis"); // "analisis" or "lampiran"
  const [docNumber, setDocNumber] = useState(`2 /Kep.KDH/A/${periodYear}`);
  const [docDate, setDocDate] = useState(`5 Januari ${periodYear}`);
  const [bupatiName, setBupatiName] = useState("HARDA KISWAYA");

  useEffect(() => {
    if (periodYear) {
      setDocNumber(`2 /Kep.KDH/A/${periodYear}`);
      setDocDate(`5 Januari ${periodYear}`);
    }
  }, [periodYear]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" || field === "rank" ? "asc" : "desc");
    }
  };

  const renderSortArrow = (field) => {
    if (sortField !== field) {
      return (
        <svg className="w-3.5 h-3.5 text-slate-300 shrink-0 select-none ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="w-3.5 h-3.5 text-teal-600 shrink-0 select-none ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5 text-teal-600 shrink-0 select-none ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    );
  };



  useEffect(() => {
    // If URL contains ?period=..., prefer that if it exists
    const params = new URLSearchParams(location.search);
    const qp = params.get('period');
    if (qp && periods.length) {
      const found = periods.find(p => String(p.id) === String(qp) || String(p.year) === String(qp));
      if (found && found.id !== selectedPeriod) {
        setSelectedPeriod(found.id);
      }
    }

    // Load criteria names map (code -> name)
    getCriteria()
      .then((list) => {
        const map = {};
        (list || []).forEach((c) => {
          const code = String(c.code).toUpperCase();
          map[code] = c.name || code;
        });
        setCriteriaMap(map);
      })
      .catch(() => setCriteriaMap({}));
  }, [location.search, periods, selectedPeriod, setSelectedPeriod]);

  useEffect(() => {
    if (!selectedPeriod) return;

    let active = true;

    const loadRuns = async () => {
      const runsData = await getMooraRuns(selectedPeriod);
      if (!active) return;
      
      if (!runsData || runsData.length === 0) {
        setRuns([]);
        setSelectedRun("");
        setResults([]);
        setAhpMeta(null);
        setWeights([]);
        return;
      }
      
      setRuns(runsData);
      
      // Auto-select latest run or use queryRun if provided
      if (queryRun && runsData.find(r => r.runId === queryRun || r.id === queryRun)) {
        setSelectedRun(queryRun);
      } else if (runsData.length) {
        setSelectedRun(runsData[0].id);
      } else {
        setSelectedRun("");
      }
    };

    loadRuns();

    return () => {
      active = false;
    };
  }, [selectedPeriod, queryRun]);

  useEffect(() => {
    if (!selectedPeriod || !selectedRun) return;

    let active = true;

    const loadResults = async () => {
      // Verify that the selectedRun belongs to the current runs of the selectedPeriod
      const runMeta = runs.find(r => String(r.id || r.runId) === String(selectedRun));
      if (!runMeta || String(runMeta.period) !== String(selectedPeriod)) {
        return;
      }

      // 1. Fetch criteria first to get names and types
      let nameMap = {};
      let typeMap = {};
      try {
        const list = await getCriteria();
        if (!active) return;
        (list || []).forEach((c) => {
          const code = String(c.code).toUpperCase();
          nameMap[code] = c.name || code;
          typeMap[code] = c.type ? String(c.type).toLowerCase() : null;
        });
        setCriteriaMap(nameMap);
      } catch (err) {
        console.error("Failed to load criteria:", err);
      }

      // 2. Get results from selected run
      const mooraResults = await getResultsByRun(selectedRun);
      if (!active) return;

      // 3. Load all village master data to get kecamatan and code
      let villageMap = {};
      try {
        const villages = await getAllDesa();
        if (!active) return;
        villages.forEach(v => {
          villageMap[v.id] = v;
        });
      } catch (err) {
        console.error("Failed to load village master data:", err);
      }

      // 4. Load pre-calculation run if available
      const periodRecord = periods.find(p => p.id === selectedPeriod);
      const praRunId = periodRecord?.praKalkulasiResult?.runId;
      let praVillageMap = {};
      if (praRunId) {
        try {
          const praRun = await getPraKalkulasiRun(selectedPeriod, praRunId);
          if (!active) return;
          if (praRun && praRun.perVillage) {
            praRun.perVillage.forEach(item => {
              praVillageMap[item.id] = item;
            });
          }
        } catch (err) {
          console.error("Failed to load pre-calculation run:", err);
        }
      }

      // 5. Merge data and calculate benefit / cost values on-the-fly for matrix detail view
      const mergedResults = mooraResults.map(r => {
        const villageId = r.alternativeId || r.id;
        const vMaster = villageMap[villageId] || {};
        const praData = praVillageMap[villageId] || {};
        const kecamatan = vMaster.kecamatan || praData.kecamatan || "";
        const code = vMaster.code || r.code || "";
        
        // Kewenangan = BPKal + nominal (ADD Kewenangan Kegiatan from MOORA)
        const addBPKal = Number(praData.addBPKal || 0);
        const nominal = Number(r.nominal || 0);
        const kewenangan = addBPKal + nominal;
        
        // Jumlah = addSil + addKes + addKer + addKeb + kewenangan
        const addSil = Number(praData.addSil || 0);
        const addKes = Number(praData.addKes || 0);
        const addKer = Number(praData.addKer || 0);
        const addKeb = Number(praData.addKeb || 0);
        const jumlah = addSil + addKes + addKer + addKeb + kewenangan;

        // Calculate benefit and cost sum for Yi calculation detail
        let benefit = 0;
        let cost = 0;
        if (r.weighted) {
          Object.entries(r.weighted).forEach(([cCode, val]) => {
            const criteriaCode = String(cCode).toUpperCase();
            const type = typeMap[criteriaCode];
            if (type === "benefit") {
              benefit += Number(val || 0);
            } else if (type === "cost") {
              cost += Number(val || 0);
            }
          });
        }

        return {
          ...r,
          code,
          kecamatan,
          addSil,
          addKes,
          addKer,
          addKeb,
          addBPKal,
          kewenangan,
          jumlah,
          benefit,
          cost,
        };
      });

      setResults(mergedResults);

      const ahpResultsId = runMeta?.ahpResultsId;

      if (ahpResultsId) {
        const detail = await getAhpById(ahpResultsId);
        if (!active) return;
        setAhpMeta({ CR: detail?.CR ?? null, period: detail?.period ?? null });
        
        // Sort weights by criteria code (C1, C2, C3, ...)
        const weightsArray = detail?.weights ?? [];
        const sortedWeights = Array.isArray(weightsArray) 
          ? [...weightsArray].sort((a, b) => {
              const codeA = String(a.code ?? a.key ?? a.name ?? "").toUpperCase();
              const codeB = String(b.code ?? b.key ?? b.name ?? "").toUpperCase();
              return codeA.localeCompare(codeB, undefined, { numeric: true });
            })
          : Object.entries(weightsArray).sort((a, b) => 
              a[0].localeCompare(b[0], undefined, { numeric: true })
            ).map(([code, weight]) => ({ code, weight }));
        
        setWeights(sortedWeights);
      } else {
        if (!active) return;
        setAhpMeta(null);
        setWeights([]);
      }
    };

    loadResults();

    return () => {
      active = false;
    };
  }, [selectedPeriod, selectedRun, periods, runs]);



  const groupedData = useMemo(() => {
    if (!results.length) return [];

    // Group by kecamatan
    const groupsMap = {};
    results.forEach((item) => {
      const kec = String(item.kecamatan || "LAINNYA").trim().toUpperCase();
      if (!groupsMap[kec]) {
        groupsMap[kec] = {
          name: kec,
          items: [],
        };
      }
      groupsMap[kec].items.push(item);
    });

    const groupsArray = Object.values(groupsMap);

    // Sort items inside each group by their code (numerical) using compareByCode
    groupsArray.forEach((group) => {
      group.items.sort(compareByCode);
    });

    // Sort groups by the minimum item code to maintain geographical order
    groupsArray.sort((a, b) => {
      const minA = [...a.items].sort(compareByCode)[0];
      const minB = [...b.items].sort(compareByCode)[0];
      if (!minA) return 1;
      if (!minB) return -1;
      return compareByCode(minA, minB);
    });

    return groupsArray;
  }, [results]);

  const totals = useMemo(() => {
    let addSil = 0;
    let addKes = 0;
    let addKer = 0;
    let addKeb = 0;
    let kewenangan = 0;
    let jumlah = 0;

    results.forEach((item) => {
      addSil += Number(item.addSil || 0);
      addKes += Number(item.addKes || 0);
      addKer += Number(item.addKer || 0);
      addKeb += Number(item.addKeb || 0);
      kewenangan += Number(item.kewenangan || 0);
      jumlah += Number(item.jumlah || 0);
    });

    return { addSil, addKes, addKer, addKeb, kewenangan, jumlah };
  }, [results]);

  const maxNominal = useMemo(() => {
    if (!results.length) return 0;
    return Math.max(...results.map(r => Number(r.nominal || 0)));
  }, [results]);

  const processedAllocations = useMemo(() => {
    let items = [...results];
    if (searchTerm.trim()) {
      items = items.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    items.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === "name") {
        return sortDirection === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      } else {
        return sortDirection === "asc"
          ? Number(valA || 0) - Number(valB || 0)
          : Number(valB || 0) - Number(valA || 0);
      }
    });
    return items;
  }, [results, searchTerm, sortField, sortDirection]);


  const detailCodes = useMemo(() => {
    // Prioritaskan urutan dari bobot AHP jika tersedia, mengikuti urutan dokumen AHP
    if (weights && weights.length) {
      return weights
        .map((w) => w.code ?? w.key ?? w.name)
        .filter(Boolean);
    }
    const first = results[0];
    if (first?.normalized) return Object.keys(first.normalized);
    if (first?.weighted) return Object.keys(first.weighted);
    if (first?.scores) return Object.keys(first.scores);
    return [];
  }, [weights, results]);

  const fmt = (v, d = 4) => {
    if (v === null || v === undefined || Number.isNaN(v)) return "-";
    const num = Number(v);
    if (Number.isInteger(num)) {
      return new Intl.NumberFormat("id-ID").format(num);
    }
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: d
    }).format(num);
  };

  const fmtRp = (value) => {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };




  const handleExportPDFLampiran = () => {
    if (!results.length) {
      alert({ message: "Tidak ada hasil untuk diexport.", type: "error" });
      return;
    }
    
    // Grouped data HTML generation
    let tableRowsHtml = "";
    groupedData.forEach((group, groupIdx) => {
      const roman = getRomanNumeral(groupIdx + 1);
      tableRowsHtml += `
        <tr style="font-weight: bold; font-size: 9.5pt; page-break-inside: avoid;">
          <td style="border: 1px solid black; text-align: center; padding: 6px;">${roman}.</td>
          <td style="border: 1px solid black; padding: 6px; text-transform: uppercase;">${group.name}</td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
          <td style="border: 1px solid black;"></td>
        </tr>
      `;

      group.items.forEach((item, itemIdx) => {
        const seqNum = groupedData
          .slice(0, groupIdx)
          .reduce((acc, g) => acc + g.items.length, 0) + itemIdx + 1;
        tableRowsHtml += `
          <tr style="page-break-inside: avoid;">
            <td style="border: 1px solid black; text-align: center; padding: 5px;">${seqNum}</td>
            <td style="border: 1px solid black; padding: 5px;">${item.name}</td>
            <td style="border: 1px solid black; padding: 5px 4px; text-align: right; font-family: monospace; font-size: 8.5pt;">${fmtRpFullNoSymbol(item.addSil)}</td>
            <td style="border: 1px solid black; padding: 5px 4px; text-align: right; font-family: monospace; font-size: 8.5pt;">${fmtRpFullNoSymbol(item.addKes)}</td>
            <td style="border: 1px solid black; padding: 5px 4px; text-align: right; font-family: monospace; font-size: 8.5pt;">${fmtRpFullNoSymbol(item.addKer)}</td>
            <td style="border: 1px solid black; padding: 5px 4px; text-align: right; font-family: monospace; font-size: 8.5pt;">${fmtRpFullNoSymbol(item.addKeb)}</td>
            <td style="border: 1px solid black; padding: 5px 4px; text-align: right; font-family: monospace; font-size: 8.5pt;">${fmtRpFullNoSymbol(item.kewenangan)}</td>
            <td style="border: 1px solid black; padding: 5px 4px; text-align: right; font-family: monospace; font-size: 8.5pt; font-weight: bold;">${fmtRpFullNoSymbol(item.jumlah)}</td>
          </tr>
        `;
      });
    });

    const printContent = `
      <html>
        <head>
          <title>Lampiran Keputusan Bupati Sleman - Periode ${periodYear}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 15mm 15mm 15mm 15mm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: black;
              background-color: white;
              line-height: 1.3;
              margin: 0;
              padding: 0;
            }
            .header-kop {
              text-align: right;
              font-size: 11pt;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 25px;
            }
            .title {
              text-align: center;
              font-size: 12pt;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 25px;
              letter-spacing: 0.5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5pt;
            }
            th {
              border: 1px solid black;
              padding: 5px;
              font-weight: bold;
              text-align: center;
              vertical-align: middle;
            }
            td {
              border: 1px solid black;
              vertical-align: middle;
            }
            .totals-row {
              font-weight: bold;
              background-color: #f2f2f2 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .signature-container {
              margin-top: 35px;
              display: flex;
              justify-content: flex-end;
              page-break-inside: avoid;
            }
            .signature-box {
              text-align: center;
              width: 250px;
              font-size: 10.5pt;
            }
          </style>
        </head>
        <body>
          <div class="header-kop">
            <p style="margin: 0;">LAMPIRAN KEPUTUSAN BUPATI SLEMAN</p>
            <p style="margin: 2px 0 0 0;">NOMOR : ${docNumber}</p>
            <p style="margin: 2px 0 0 0;">TANGGAL: ${docDate}</p>
          </div>

          <div class="title">
            <p style="margin: 0;">BESARAN ALOKASI DANA DESA KABUPATEN SLEMAN</p>
            <p style="margin: 2px 0 0 0;">TAHUN ANGGARAN ${periodYear}</p>
          </div>

          <table style="table-layout: fixed; width: 100%; border-collapse: collapse; margin-bottom: 0;">
            <colgroup>
              <col style="width: 35px;" />
              <col style="width: 200px;" />
              <col style="width: 130px;" />
              <col style="width: 115px;" />
              <col style="width: 130px;" />
              <col style="width: 125px;" />
              <col style="width: 135px;" />
              <col style="width: 145px;" />
            </colgroup>
            <thead>
              <tr>
                <th rowspan="3" style="width: 35px; border: 1px solid black;">NO.</th>
                <th rowspan="3" style="width: 200px; border: 1px solid black;">KAPANEWON/<br/>KALURAHAN</th>
                <th colspan="6" style="border: 1px solid black;">ALOKASI DANA DESA</th>
              </tr>
              <tr>
                <th colspan="6" style="font-weight: normal; font-size: 8pt; padding: 2px; border: 1px solid black;">(Rp)</th>
              </tr>
              <tr>
                <th style="width: 130px; font-size: 8.5pt; border: 1px solid black;">PENGHASILAN TETAP</th>
                <th style="width: 115px; font-size: 8.5pt; border: 1px solid black;">BPJS KESEHATAN</th>
                <th style="width: 130px; font-size: 8.5pt; border: 1px solid black;">BPJS KETENAGAKERJAAN</th>
                <th style="width: 125px; font-size: 8.5pt; border: 1px solid black;">KEBIJAKAN</th>
                <th style="width: 135px; font-size: 8.5pt; border: 1px solid black;">KEWENANGAN</th>
                <th style="width: 145px; font-size: 9pt; border: 1px solid black;">JUMLAH</th>
              </tr>
            </thead>
          </table>

          <table style="table-layout: fixed; width: 100%; border-collapse: collapse; margin-top: -1px;">
            <colgroup>
              <col style="width: 35px;" />
              <col style="width: 200px;" />
              <col style="width: 130px;" />
              <col style="width: 115px;" />
              <col style="width: 130px;" />
              <col style="width: 125px;" />
              <col style="width: 135px;" />
              <col style="width: 145px;" />
            </colgroup>
            <thead>
              <tr style="background-color: #f9f9f9; page-break-inside: avoid;">
                <th style="width: 35px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">1</th>
                <th style="width: 200px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">2</th>
                <th style="width: 130px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">3</th>
                <th style="width: 115px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">4</th>
                <th style="width: 130px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">5</th>
                <th style="width: 125px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">6</th>
                <th style="width: 135px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">7</th>
                <th style="width: 145px; font-size: 8pt; padding: 2px; font-weight: normal; border: 1px solid black; text-align: center;">8</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
              <tr class="totals-row">
                <td colspan="2" style="border: 1px solid black; text-align: center; padding: 6px;">Jumlah</td>
                <td style="border: 1px solid black; padding: 6px 4px; text-align: right; font-family: monospace; font-size: 8.5pt; font-weight: bold;">${fmtRpFullNoSymbol(totals.addSil)}</td>
                <td style="border: 1px solid black; padding: 6px 4px; text-align: right; font-family: monospace; font-size: 8.5pt; font-weight: bold;">${fmtRpFullNoSymbol(totals.addKes)}</td>
                <td style="border: 1px solid black; padding: 6px 4px; text-align: right; font-family: monospace; font-size: 8.5pt; font-weight: bold;">${fmtRpFullNoSymbol(totals.addKer)}</td>
                <td style="border: 1px solid black; padding: 6px 4px; text-align: right; font-family: monospace; font-size: 8.5pt; font-weight: bold;">${fmtRpFullNoSymbol(totals.addKeb)}</td>
                <td style="border: 1px solid black; padding: 6px 4px; text-align: right; font-family: monospace; font-size: 8.5pt; font-weight: bold;">${fmtRpFullNoSymbol(totals.kewenangan)}</td>
                <td style="border: 1px solid black; padding: 6px 4px; text-align: right; font-family: monospace; font-size: 8.5pt; font-weight: bold;">${fmtRpFullNoSymbol(totals.jumlah)}</td>
              </tr>
            </tbody>
          </table>

          <div class="signature-container">
            <div class="signature-box">
              <p style="font-weight: bold; margin: 0;">BUPATI SLEMAN,</p>
              <div style="height: 80px;"></div>
              <p style="font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${bupatiName}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "", "height=700,width=1000");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportPDFAnalisis = () => {
    if (!results.length) {
      alert({ message: "Tidak ada hasil untuk diexport.", type: "error" });
      return;
    }

    const periodYear = periods.find(p => p.id === selectedPeriod)?.year ?? "periode";
    
    let tableRowsHtml = "";
    processedAllocations.forEach((item) => {
      tableRowsHtml += `
        <tr>
          <td style="border: 1px solid #cbd5e1; text-align: center; padding: 8px;">${item.rank}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.name}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; padding: 8px; font-family: monospace; color: #2563eb;">${typeof item.yi === 'number' ? item.yi.toFixed(4) : '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-family: monospace; font-weight: bold;">${fmtRp(item.nominal)}</td>
        </tr>
      `;
    });

    const printContent = `
      <html>
        <head>
          <title>Hasil Peringkat & Analisis ADD Kewenangan Kegiatan - Periode ${periodYear}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 20mm 15mm 20mm 15mm;
            }
            body {
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              background-color: white;
              line-height: 1.5;
              margin: 0;
              padding: 0;
            }
            .header {
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .title {
              font-size: 16pt;
              font-weight: bold;
              color: #1e3a8a;
              margin: 0;
            }
            .subtitle {
              font-size: 10.5pt;
              color: #64748b;
              margin: 4px 0 0 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10pt;
              margin-top: 15px;
            }
            th {
              border: 1px solid #cbd5e1;
              background-color: #f8fafc;
              color: #0f172a;
              font-weight: bold;
              padding: 10px 8px;
              text-align: left;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 8px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Hasil Peringkat & Analisis ADD Kewenangan Kegiatan</h1>
            <p class="subtitle">Kabupaten Sleman - Periode ${periodYear}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 100px; text-align: center;">Peringkat</th>
                <th>Kalurahan</th>
                <th style="width: 150px; text-align: center;">Nilai Yi</th>
                <th style="width: 300px; text-align: right;">Nominal ADD Kewenangan Kegiatan</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "", "height=700,width=900");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportPDF = () => {
    if (viewMode === "lampiran") {
      handleExportPDFLampiran();
    } else {
      handleExportPDFAnalisis();
    }
  };

  const handleExportExcel = () => {
    if (!results.length) {
      alert({ message: "Tidak ada hasil untuk diexport.", type: "error" });
      return;
    }

    const periodYear = periods.find(p => p.id === selectedPeriod)?.year ?? "periode";
    const filename = `lampiran-bupati-add-${periodYear}.xls`;

    // Construct HTML content for Excel
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Lampiran Bupati</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Times New Roman', serif; }
          .header-kop { text-align: right; font-size: 11pt; font-weight: bold; }
          .title { text-align: center; font-size: 12pt; font-weight: bold; margin-top: 20px; margin-bottom: 20px; text-transform: uppercase; }
          table { border-collapse: collapse; width: 100%; }
          th { border: 1px solid black; background-color: #f2f2f2; font-weight: bold; text-align: center; vertical-align: middle; font-size: 10pt; }
          td { border: 1px solid black; font-size: 10pt; vertical-align: middle; }
          .number-cell { mso-number-format:"\\#\\,\\#\\#0\\.00"; text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <!-- Kop Header -->
        <table style="border:none; border-collapse:collapse; width:100%;">
          <tr style="border:none;"><td colspan="8" style="border:none;" class="header-kop">LAMPIRAN KEPUTUSAN BUPATI SLEMAN</td></tr>
          <tr style="border:none;"><td colspan="8" style="border:none;" class="header-kop">NOMOR : ${docNumber}</td></tr>
          <tr style="border:none;"><td colspan="8" style="border:none;" class="header-kop">TANGGAL: ${docDate}</td></tr>
          <tr style="border:none;"><td colspan="8" style="border:none;">&nbsp;</td></tr>
          <tr style="border:none;"><td colspan="8" style="border:none;" class="title">BESARAN ALOKASI DANA DESA KABUPATEN SLEMAN</td></tr>
          <tr style="border:none;"><td colspan="8" style="border:none;" class="title">TAHUN ANGGARAN ${periodYear}</td></tr>
          <tr style="border:none;"><td colspan="8" style="border:none;">&nbsp;</td></tr>
        </table>

        <!-- Table -->
        <table>
          <thead>
            <tr>
              <th rowspan="3" style="width: 50px;">NO.</th>
              <th rowspan="3" style="width: 250px;">KAPANEWON/<br/>KALURAHAN</th>
              <th colspan="6">ALOKASI DANA DESA<br/>(Rp)</th>
            </tr>
            <tr>
              <!-- Empty cells for row/colspan visual compliance in Excel -->
            </tr>
            <tr>
              <th style="width: 150px;">PENGHASILAN TETAP</th>
              <th style="width: 120px;">BPJS KESEHATAN</th>
              <th style="width: 150px;">BPJS KETENAGAKERJAAN</th>
              <th style="width: 120px;">KEBIJAKAN</th>
              <th style="width: 150px;">KEWENANGAN</th>
              <th style="width: 150px;">JUMLAH</th>
            </tr>
            <tr>
              <th>1</th>
              <th>2</th>
              <th>3</th>
              <th>4</th>
              <th>5</th>
              <th>6</th>
              <th>7</th>
              <th>8</th>
            </tr>
          </thead>
          <tbody>
    `;

    let villageCount = 0;
    groupedData.forEach((group, groupIdx) => {
      const roman = getRomanNumeral(groupIdx + 1);
      html += `
        <tr>
          <td class="text-center font-bold">${roman}.</td>
          <td class="font-bold" style="text-transform: uppercase;">${group.name}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;

      group.items.forEach((item) => {
        villageCount++;
        html += `
          <tr>
            <td class="text-center">${villageCount}</td>
            <td>${item.name}</td>
            <td class="number-cell">${item.addSil || 0}</td>
            <td class="number-cell">${item.addKes || 0}</td>
            <td class="number-cell">${item.addKer || 0}</td>
            <td class="number-cell">${item.addKeb || 0}</td>
            <td class="number-cell">${item.kewenangan || 0}</td>
            <td class="number-cell">${item.jumlah || 0}</td>
          </tr>
        `;
      });
    });

    // Totals row
    html += `
      <tr class="font-bold" style="background-color: #e6e6e6;">
        <td colspan="2" class="text-center">Jumlah</td>
        <td class="number-cell">${totals.addSil}</td>
        <td class="number-cell">${totals.addKes}</td>
        <td class="number-cell">${totals.addKer}</td>
        <td class="number-cell">${totals.addKeb}</td>
        <td class="number-cell">${totals.kewenangan}</td>
        <td class="number-cell">${totals.jumlah}</td>
      </tr>
    `;

    html += `
          </tbody>
        </table>

        <!-- Signature Section -->
        <br/><br/>
        <table style="border:none; border-collapse:collapse; width:100%;">
          <tr style="border:none;">
            <td colspan="5" style="border:none;"></td>
            <td colspan="3" style="border:none; text-align:center; font-weight:bold;">BUPATI SLEMAN,</td>
          </tr>
          <tr style="border:none; height: 60px;">
            <td colspan="8" style="border:none;"></td>
          </tr>
          <tr style="border:none;">
            <td colspan="5" style="border:none;"></td>
            <td colspan="3" style="border:none; text-align:center; font-weight:bold; text-transform: uppercase;">${bupatiName}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Download Blob
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert({ message: "Excel berhasil diunduh!", type: "info" });
  };

  return (
    <div className="page-shell">
      <div className="page-header-container">
        <div className="page-header">
          <h1 className="page-title">Hasil & Peringkat</h1>
          <p className="page-subtitle">
            Lihat laporan akhir hasil perhitungan integrasi AHP-MOORA, urutan peringkat prioritas kalurahan, serta cetak/unduh laporan resmi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
          <PeriodSelector
            value={selectedPeriod}
            onChange={v => setSelectedPeriod(v)}
            runs={runs}
            selectedRun={selectedRun}
            onRunChange={setSelectedRun}
            showRunSelector={runs.length > 1}
          />
          {results.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-semibold transition hover:bg-emerald-100 hover:border-emerald-300 shadow-sm cursor-pointer"
              >
                <Download size={16} /> Export Excel
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="btn-action flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown size={16} /> Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-halaman Menu / Tab Bar */}
      <div className="flex gap-2 mt-4 mb-2">
        <button
          onClick={() => setViewMode("analisis")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            viewMode === "analisis"
              ? "bg-[#1a2847] text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Tabel Analisis
        </button>
        <button
          onClick={() => setViewMode("lampiran")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            viewMode === "lampiran"
              ? "bg-[#1a2847] text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Pratinjau Lampiran Bupati
        </button>
      </div>

      {ahpMeta && (
        <div className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-gradient-to-r from-sky-100 to-indigo-100 px-3 py-2 text-sm text-blue-900">
          <span className="font-semibold">Bobot AHP dipakai:</span>
          <span>Periode {ahpMeta.period ?? "-"}</span>
          <span>CR: {ahpMeta.CR != null ? ahpMeta.CR.toFixed(3) : "-"}</span>
        </div>
      )}

      <div ref={reportRef} className="space-y-6">
        {viewMode === "lampiran" ? (
          <div className="panel bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs text-black">
            {/* Controls pane inside the preview */}
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 space-y-4 no-print">
              <h4 className="font-bold text-sm text-slate-900">Pengaturan Lampiran Resmi</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor Keputusan</label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Keputusan</label>
                  <input
                    type="text"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Bupati</label>
                  <input
                    type="text"
                    value={bupatiName}
                    onChange={(e) => setBupatiName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Actual Annex Preview Container (Times New Roman style) */}
            <div id="official-bupati-document" className="bg-white p-6 md:p-12 text-black leading-normal" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
              {/* Kop Header */}
              <div className="flex flex-col items-end text-right text-[11pt] font-bold mb-8 uppercase tracking-wide">
                <p>LAMPIRAN KEPUTUSAN BUPATI SLEMAN</p>
                <p>NOMOR : {docNumber}</p>
                <p>TANGGAL: {docDate}</p>
              </div>

              {/* Center Title */}
              <div className="text-center font-bold text-[12pt] mb-8 uppercase tracking-wider">
                <p>BESARAN ALOKASI DANA DESA KABUPATEN SLEMAN</p>
                <p>TAHUN ANGGARAN {periodYear}</p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10pt] border-collapse" style={{ border: "1.5px solid black" }}>
                  <thead>
                    <tr>
                      <th className="border border-black px-2 py-3 text-center align-middle font-bold text-[9pt]" rowSpan="3" style={{ width: "35px" }}>NO.</th>
                      <th className="border border-black px-4 py-3 text-center align-middle font-bold text-[9pt]" rowSpan="3" style={{ width: "200px" }}>KAPANEWON/<br/>KALURAHAN</th>
                      <th className="border border-black px-2 py-2 text-center align-middle font-bold text-[9pt]" colSpan="6">ALOKASI DANA DESA</th>
                    </tr>
                    <tr>
                      <th className="border border-black px-2 py-1 text-center align-middle font-normal text-[8pt]" colSpan="6">(Rp)</th>
                    </tr>
                    <tr>
                      <th className="border border-black px-2 py-2 text-center align-middle font-bold text-[8.5pt]" style={{ width: "130px" }}>PENGHASILAN TETAP</th>
                      <th className="border border-black px-2 py-2 text-center align-middle font-bold text-[8.5pt]" style={{ width: "115px" }}>BPJS KESEHATAN</th>
                      <th className="border border-black px-2 py-2 text-center align-middle font-bold text-[8.5pt]" style={{ width: "130px" }}>BPJS KETENAGAKERJAAN</th>
                      <th className="border border-black px-2 py-2 text-center align-middle font-bold text-[8.5pt]" style={{ width: "125px" }}>KEBIJAKAN</th>
                      <th className="border border-black px-2 py-2 text-center align-middle font-bold text-[8.5pt]" style={{ width: "135px" }}>KEWENANGAN</th>
                      <th className="border border-black px-2 py-2 text-center align-middle font-bold text-[9pt]" style={{ width: "145px" }}>JUMLAH</th>
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "35px" }}>1</th>
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "200px" }}>2</th>
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "130px" }}>3</th>
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "115px" }}>4</th>
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "130px" }}>5</th>
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "125px" }}>6</th>
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "135px" }}>7</th>
                      <th className="border border-black text-center font-normal text-[8pt] py-1" style={{ width: "145px" }}>8</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.map((group, groupIdx) => {
                      const roman = getRomanNumeral(groupIdx + 1);
                      return (
                        <React.Fragment key={group.name}>
                          {/* Kapanewon Row */}
                          <tr className="font-bold text-[9.5pt]">
                            <td className="border border-black text-center py-2">{roman}.</td>
                            <td className="border border-black px-4 py-2 uppercase">{group.name}</td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                          </tr>
                          {/* Kalurahan Rows */}
                          {group.items.map((item, itemIdx) => {
                            const seqNum = groupedData
                              .slice(0, groupIdx)
                              .reduce((acc, g) => acc + g.items.length, 0) + itemIdx + 1;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="border border-black text-center py-1.5">{seqNum}</td>
                                <td className="border border-black px-4 py-1.5">{item.name}</td>
                                <td className="border border-black px-2 py-1.5 text-right font-mono text-[8.5pt]">{fmtRpFullNoSymbol(item.addSil)}</td>
                                <td className="border border-black px-2 py-1.5 text-right font-mono text-[8.5pt]">{fmtRpFullNoSymbol(item.addKes)}</td>
                                <td className="border border-black px-2 py-1.5 text-right font-mono text-[8.5pt]">{fmtRpFullNoSymbol(item.addKer)}</td>
                                <td className="border border-black px-2 py-1.5 text-right font-mono text-[8.5pt]">{fmtRpFullNoSymbol(item.addKeb)}</td>
                                <td className="border border-black px-2 py-1.5 text-right font-mono text-[8.5pt]">{fmtRpFullNoSymbol(item.kewenangan)}</td>
                                <td className="border border-black px-2 py-1.5 text-right font-mono text-[8.5pt] font-bold">{fmtRpFullNoSymbol(item.jumlah)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {/* Totals Row */}
                    <tr className="font-bold text-[9.5pt] bg-slate-100">
                      <td className="border border-black text-center py-2" colSpan="2">Jumlah</td>
                      <td className="border border-black px-2 py-2 text-right font-mono text-[9pt]">{fmtRpFullNoSymbol(totals.addSil)}</td>
                      <td className="border border-black px-2 py-2 text-right font-mono text-[9pt]">{fmtRpFullNoSymbol(totals.addKes)}</td>
                      <td className="border border-black px-2 py-2 text-right font-mono text-[9pt]">{fmtRpFullNoSymbol(totals.addKer)}</td>
                      <td className="border border-black px-2 py-2 text-right font-mono text-[9pt]">{fmtRpFullNoSymbol(totals.addKeb)}</td>
                      <td className="border border-black px-2 py-2 text-right font-mono text-[9pt]">{fmtRpFullNoSymbol(totals.kewenangan)}</td>
                      <td className="border border-black px-2 py-2 text-right font-mono text-[9pt]">{fmtRpFullNoSymbol(totals.jumlah)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signature Area */}
              <div className="flex justify-end mt-12 mr-12 text-[10.5pt] leading-relaxed page-break-inside-avoid">
                <div className="text-center" style={{ width: "280px" }}>
                  <p className="font-bold mb-4 text-center">BUPATI SLEMAN,</p>
                  <div style={{ height: "80px" }}></div>
                  <p className="font-bold uppercase tracking-wider text-center">{bupatiName}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Rekomendasi 3 Teratas */}
            {results.length > 0 && (
              <div className="bg-gradient-to-br from-[#1a2847] to-[#234166] text-white rounded-2xl shadow-lg p-5">
                <h3 className="text-lg font-semibold mb-1">Rekomendasi Prioritas Utama</h3>
                <p className="text-sm text-white/70 mb-4">Berdasarkan hasil perhitungan AHP-MOORA</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {results.slice(0, 3).map((r) => (
                    <div key={r.id} className="rounded-xl bg-white/10 px-4 py-3">
                      <div className="text-xs uppercase text-blue-100 font-semibold">Prioritas #{r.rank}</div>
                      <div className="font-semibold text-base mt-0.5">{r.name}</div>
                      <div className="text-[11px] text-blue-100">Nilai Yi: {typeof r.yi === 'number' ? r.yi.toFixed(4) : '-'}</div>
                      {r.nominal != null && <div className="text-[11px] text-emerald-300 font-medium">Nominal ADD Kewenangan Kegiatan: {fmtRp(r.nominal)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ringkasan Laporan */}
            <div className="panel-indigo p-5 space-y-2">
              <h3 className="text-lg font-semibold text-indigo-900">Ringkasan Laporan</h3>
              <p className="text-sm text-indigo-800">
                Sistem menggunakan kombinasi metode AHP dan MOORA untuk menentukan prioritas alokasi dana desa. Bobot kriteria diperoleh dari AHP (CR {ahpMeta?.CR != null ? ahpMeta.CR.toFixed(3) : '-'}), kemudian digunakan pada optimasi MOORA.
              </p>
              {results.length > 0 && (
                <p className="text-sm text-indigo-800 font-medium">
                  Hasil tertinggi pada periode {periods.find(p=>p.id===selectedPeriod)?.year ?? '-'} adalah {results[0].name} dengan nilai Yi {typeof results[0].yi === 'number' ? results[0].yi.toFixed(4) : '-'}.
                </p>
              )}
            </div>

            {/* Visualisasi Nominal Alokasi Dana (Tabel Interaktif) */}
            <div className="panel-info p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-teal-900">Analisis ADD Kewenangan Kegiatan</h3>
                  <p className="text-xs text-teal-700">Tabel interaktif distribusi nominal ADD Kewenangan Kegiatan hasil perhitungan AHP-MOORA. (Klik judul kolom untuk mengurutkan)</p>
                </div>
                
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Cari Kalurahan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 placeholder-teal-600/50 shadow-xs"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-teal-500 hover:text-teal-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {!processedAllocations.length ? (
                <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-sky-100/50">
                  <p className="text-sm text-gray-500">Tidak ada kalurahan yang cocok dengan pencarian "{searchTerm}"</p>
                </div>
              ) : (
                <div className="border border-sky-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    <table className="min-w-full table-auto border-collapse text-left">
                      <thead className="bg-gradient-to-r from-sky-50 to-teal-50 text-xs font-bold text-teal-900 uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                        <tr>
                          <th
                            onClick={() => handleSort("rank")}
                            className="px-4 py-3 cursor-pointer select-none hover:bg-teal-100/50 transition-colors w-28 text-center"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Peringkat</span>
                              {renderSortArrow("rank")}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort("name")}
                            className="px-6 py-3 cursor-pointer select-none hover:bg-teal-100/50 transition-colors"
                          >
                            <div className="flex items-center justify-start gap-1">
                              <span>Kalurahan</span>
                              {renderSortArrow("name")}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort("yi")}
                            className="px-4 py-3 cursor-pointer select-none hover:bg-teal-100/50 transition-colors w-28 text-center"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Nilai Yi</span>
                              {renderSortArrow("yi")}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort("nominal")}
                            className="px-6 py-3 cursor-pointer select-none hover:bg-teal-100/50 transition-colors w-72"
                          >
                            <div className="flex items-center justify-start gap-1">
                              <span>Nominal ADD Kewenangan Kegiatan</span>
                              {renderSortArrow("nominal")}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {processedAllocations.map((item) => {
                          const percent = maxNominal ? (Number(item.nominal || 0) / maxNominal) * 100 : 0;
                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/80 transition-colors duration-150"
                            >
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-flex items-center justify-center w-6.5 h-6.5 rounded-full text-xs font-bold ${
                                  item.rank === 1 ? "bg-amber-400 text-white shadow-xs" :
                                  item.rank === 2 ? "bg-slate-400 text-white shadow-xs" :
                                  item.rank === 3 ? "bg-amber-600 text-white shadow-xs" :
                                  "bg-slate-100 text-slate-600"
                                }`}>
                                  {item.rank}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 font-semibold text-slate-900">
                                {item.name}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold text-blue-600">
                                {typeof item.yi === 'number' ? item.yi.toFixed(4) : '-'}
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">{fmtRp(item.nominal)}</span>
                                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5" title={`${percent.toFixed(1)}% dari pagu maksimum`}>
                                    <div
                                      className={`h-full rounded-full bg-gradient-to-r ${
                                        item.rank === 1 ? "from-amber-400 to-amber-500" :
                                        item.rank === 2 ? "from-slate-400 to-slate-500" :
                                        item.rank === 3 ? "from-amber-600 to-amber-700" :
                                        "from-emerald-500 to-teal-400"
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Bobot Kriteria AHP */}
            <div className="panel-indigo p-5 space-y-3">
              <h3 className="text-lg font-semibold text-indigo-900">Bobot Kriteria AHP</h3>
              {!weights.length && <p className="text-sm text-gray-600">Bobot tidak tersedia.</p>}
              <div className="space-y-3">
                {weights.map((w) => {
                  const code = String(w.code ?? w.key ?? w.name ?? "C").toUpperCase();
                  const name = criteriaMap[code] || w.name || code;
                  const val = Number(w.weight ?? w.bobot ?? 0);
                  return (
                    <div key={code} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-gray-800">
                        <span>{code}: {name}</span>
                        <span className="font-semibold">{(val * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, val * 100)}%` }} />
                      </div>
                      <div className="text-xs text-gray-500">Bobot: {val.toFixed(3)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail Perhitungan MOORA (berdasarkan run terpilih) */}
            <div className="panel-info p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-cyan-900">Detail Perhitungan MOORA</h3>
                  <p className="text-sm text-cyan-700">Menampilkan matriks hasil run terpilih</p>
                </div>
                <button
                  onClick={() => setShowDetail((s) => !s)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  {showDetail ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>

              {showDetail && results.length > 0 && (
                <div className="mt-4 space-y-6 text-sm text-gray-700">
                  {/* Matriks Normalisasi */}
                  <div className="space-y-2">
                    <p className="font-semibold">1. Matriks Normalisasi</p>
                    <p className="text-xs text-gray-500">Rumus: xij = xij / √(Σ xij²)</p>
                    <div className="overflow-x-auto border-2 border-sky-200 rounded-xl shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gradient-to-r from-sky-100 to-blue-100">
                          <tr>
                            <th className="p-3 text-left border-b-2 border-sky-200 font-bold text-sky-900">Kalurahan</th>
                            {detailCodes.map((code) => (
                              <th key={code} className="p-3 text-center border-b-2 border-sky-200 font-bold text-sky-900">
                                {criteriaMap[String(code).toUpperCase()] ?? code}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((row, idx) => (
                            <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-sky-50/30"}>
                              <td className="p-3 border-b border-gray-100 text-left font-bold text-sky-900">{row.name}</td>
                              {detailCodes.map((code) => (
                                <td key={code} className="p-3 border-b border-gray-100 text-center text-gray-700">
                                  {fmt(row.normalized?.[code])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Matriks Terormalisasi Terbobot */}
                  <div className="space-y-2">
                    <p className="font-semibold">2. Matriks Terormalisasi Terbobot</p>
                    <p className="text-xs text-gray-500">Rumus: Vij = Wij × Rij</p>
                    <div className="overflow-x-auto border-2 border-violet-200 rounded-xl shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gradient-to-r from-violet-100 to-purple-100">
                          <tr>
                            <th className="p-3 text-left border-b-2 border-violet-200 font-bold text-violet-900">Kalurahan</th>
                            {detailCodes.map((code) => (
                              <th key={code} className="p-3 text-center border-b-2 border-violet-200 font-bold text-violet-900">
                                {criteriaMap[String(code).toUpperCase()] ?? code}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((row, idx) => (
                            <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-violet-50/30"}>
                              <td className="p-3 border-b border-gray-100 text-left font-bold text-violet-900">{row.name}</td>
                              {detailCodes.map((code) => (
                                <td key={code} className="p-3 border-b border-gray-100 text-center text-gray-700">
                                  {fmt(row.weighted?.[code])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Perhitungan Nilai Yi */}
                  <div className="space-y-2">
                    <p className="font-semibold">3. Perhitungan Nilai Yi</p>
                    <p className="text-xs text-gray-500">Rumus: Yi = Σ(Y benefit) - Σ(Y cost)</p>
                    <div className="overflow-x-auto border-2 border-amber-200 rounded-xl shadow-sm">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gradient-to-r from-amber-100 to-orange-100">
                          <tr>
                            <th className="p-3 text-left border-b-2 border-amber-200 font-bold text-amber-900">Kalurahan</th>
                            <th className="p-3 text-center border-b-2 border-amber-200 font-bold text-amber-900">Σ Benefit</th>
                            <th className="p-3 text-center border-b-2 border-amber-200 font-bold text-amber-900">Σ Cost</th>
                            <th className="p-3 text-center border-b-2 border-amber-200 font-bold text-amber-900">Yi = Benefit - Cost</th>
                            <th className="p-3 text-center border-b-2 border-amber-200 font-bold text-amber-900">Nominal ADD Kewenangan Kegiatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((row, idx) => (
                            <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-amber-50/30"}>
                              <td className="p-3 border-b border-gray-100 text-left font-bold text-amber-900">{row.name}</td>
                              <td className="p-3 border-b border-gray-100 text-center text-emerald-700 font-semibold">{fmt(row.benefit)}</td>
                              <td className="p-3 border-b border-gray-100 text-center text-rose-700 font-semibold">{fmt(row.cost)}</td>
                              <td className="p-3 border-b border-gray-100 text-center text-blue-700 font-bold">{fmt(row.yi)}</td>
                              <td className="p-3 border-b border-gray-100 text-center text-emerald-700 font-semibold">{row.nominal != null ? fmtRp(row.nominal) : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Konversi Nilai Kriteria (opsional) */}
                  <div className="space-y-2">
                    <p className="font-semibold">4. Konversi Nilai Kriteria</p>
                    <p className="text-xs text-gray-500">Nilai yang telah dipetakan ke skor per kriteria</p>
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-3 text-left border-b border-gray-200">Kalurahan</th>
                            {detailCodes.map((code) => (
                              <th key={code} className="p-3 text-center border-b border-gray-200">
                                {criteriaMap[String(code).toUpperCase()] ?? code}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((row, idx) => (
                            <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-3 border-b border-gray-100 text-left font-semibold text-gray-800">{row.name}</td>
                              {detailCodes.map((code) => (
                                <td key={code} className="p-3 border-b border-gray-100 text-center text-gray-700">
                                  {fmt(row.scores?.[code], 3)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
