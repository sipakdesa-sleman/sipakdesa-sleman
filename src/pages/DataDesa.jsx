import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, Plus, Save, Pen, Trash2, X, Copy, Upload, AlertTriangle } from "lucide-react";
import Table from "../components/Table";
import StatCard from "../components/StatCard";
import { getAllDesa, createDesa, updateDesa, deleteDesa, getRawValuesForDesaPeriod, setRawValuesForDesaPeriod, listRawValuesForPeriod, copyDesaRawValues, saveBulkRawValues } from "../services/desaService";
import { getAllCriteria } from "../services/criteriaService";
import { getAllParameters } from "../services/parametersService";
import PeriodSelector from "../components/PeriodSelector";
import * as XLSX from "xlsx";

import { useDialog } from "../context/DialogProvider";
import { usePeriod } from "../context/PeriodContext";
import { IntegerInput, DecimalInput } from "../components/NumericInput";
import { formatDecimalDisplay, formatInteger } from "../utils/numberFormat";
import { PageSkeleton } from "../components/SkeletonLoader";
import { sanitizeInputText } from "../utils/sanitize";

function compareByCodeThenName(a, b) {
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
  return String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { numeric: true });
}

const normalizeName = (name) => {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/^(kalurahan|kelurahan|desa|kapanewon|kecamatan)\s+/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
};

const parseCSV = (text) => {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push("");
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
};

export default function DataDesa() {
  const { selectedPeriod, setSelectedPeriod, periods } = usePeriod();
  
  const selectedPeriodData = periods.find((p) => String(p.id) === String(selectedPeriod));
  const isLocked = !!(selectedPeriodData?.locked || selectedPeriodData?.praKalkulasiResult?.locked);
  const [desa, setDesa] = useState([]);
  const [criteriaList, setCriteriaList] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [mappedColumns, setMappedColumns] = useState({
    name: -1,
    C1: -1,
    C2: -1,
    C3: -1,
    C4: -1,
    C5: -1,
    bpkal: -1,
  });
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [unmatchedRows, setUnmatchedRows] = useState([]);
  const [isImportPreviewGenerated, setIsImportPreviewGenerated] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourcePeriod, setCopySourcePeriod] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formNama, setFormNama] = useState("");
  const [formKecamatan, setFormKecamatan] = useState("");
  const [formCriteriaValues, setFormCriteriaValues] = useState({});
  const [formJumlahBpkal, setFormJumlahBpkal] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [rawMap, setRawMap] = useState(new Map()); // desaId -> values
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const defaultPeriodId = useMemo(() => {
    if (!periods.length) return "";
    const active = periods.find((p) => p.isActive === true || p.active === true);
    if (active) return String(active.id);
    const sorted = [...periods].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    return String(sorted[0]?.id ?? "");
  }, [periods]);

  const fetchDesa = async () => {
    const data = await getAllDesa();
    setDesa(data);
    return data;
  };

  const fetchCriteria = async () => {
    const data = await getAllCriteria().catch(() => []);
    setCriteriaList(data);
    return data;
  };

  const fetchParameters = async () => {
    const data = await getAllParameters().catch(() => []);
    setParameters(data);
    return data;
  };

  // Resolusi Kriteria Demografi Dinamis untuk Fallback
  const padukuhanCriteria = useMemo(() => criteriaList.find(c => c.code === 'C1' || c.name.toLowerCase().includes('padukuhan') || c.name.toLowerCase().includes('dukuh')), [criteriaList]);
  const padukuhanCode = useMemo(() => padukuhanCriteria ? padukuhanCriteria.code : 'C1', [padukuhanCriteria]);

  const miskinCriteria = useMemo(() => criteriaList.find(c => c.code === 'C2' || c.name.toLowerCase().includes('miskin')), [criteriaList]);
  const miskinCode = useMemo(() => miskinCriteria ? miskinCriteria.code : 'C2', [miskinCriteria]);

  const luasCriteria = useMemo(() => criteriaList.find(c => c.code === 'C3' || (c.name.toLowerCase().includes('luas') && c.name.toLowerCase().includes('wilayah'))), [criteriaList]);
  const luasCode = useMemo(() => luasCriteria ? luasCriteria.code : 'C3', [luasCriteria]);

  const pendudukCriteria = useMemo(() => criteriaList.find(c => c.code === 'C4' || (c.name.toLowerCase().includes('penduduk') && !c.name.toLowerCase().includes('miskin'))), [criteriaList]);
  const pendudukCode = useMemo(() => pendudukCriteria ? pendudukCriteria.code : 'C4', [pendudukCriteria]);

  const geografisCriteria = useMemo(() => criteriaList.find(c => c.code === 'C5' || c.name.toLowerCase().includes('geografis') || c.name.toLowerCase().includes('kesulitan')), [criteriaList]);
  const geografisCode = useMemo(() => geografisCriteria ? geografisCriteria.code : 'C5', [geografisCriteria]);

  const loadRawValuesForPeriod = useCallback(async (periodId, desaRows = []) => {
    if (!periodId) {
      setRawMap(new Map());
      return;
    }

    const nextMap = new Map();

    const rows = await listRawValuesForPeriod(periodId).catch(() => []);
    rows.forEach((row) => {
      const pathParts = String(row.desaRefPath ?? "").split("/");
      const desaId = pathParts.length >= 2 ? pathParts[1] : null;
      if (!desaId) return;
      nextMap.set(desaId, row.values ?? {});
    });

    const fallbackRows = desaRows.length > 0
      ? desaRows.filter((item) => !nextMap.has(item.id))
      : desa;

    if (fallbackRows.length > 0) {
      const fallbackResults = await Promise.all(
        fallbackRows.map(async (item) => {
          const doc = await getRawValuesForDesaPeriod(item.id, periodId).catch(() => null);
          return [item.id, doc?.values ?? null];
        })
      );

      fallbackResults.forEach(([desaId, values]) => {
        if (values) {
          nextMap.set(desaId, values);
        }
      });
    }

    desaRows.forEach((item) => {
      if (!nextMap.has(item.id)) {
        const fallback = {};
        if (item.jumlah_padukuhan != null) fallback[padukuhanCode] = item.jumlah_padukuhan;
        if (item.jumlah_penduduk_miskin != null) fallback[miskinCode] = item.jumlah_penduduk_miskin;
        if (item.luas_wilayah != null) fallback[luasCode] = item.luas_wilayah;
        if (item.jumlah_penduduk != null) fallback[pendudukCode] = item.jumlah_penduduk;
        if (item.indeks_kesulitan_geografis != null) fallback[geografisCode] = item.indeks_kesulitan_geografis;
        if (item.jumlah_bpkal != null) fallback.jumlah_bpkal = item.jumlah_bpkal;
        nextMap.set(item.id, fallback);
      }
    });

    setRawMap(nextMap);
  }, [desa, padukuhanCode, miskinCode, luasCode, pendudukCode, geografisCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCriteria().then(() => {
        fetchParameters();
        fetchDesa().finally(() => setLoading(false));
      });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const periodToUse = selectedPeriod || defaultPeriodId;
    if (!periodToUse) return;

    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;
        await loadRawValuesForPeriod(periodToUse, desa);
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedPeriod, defaultPeriodId, desa, loadRawValuesForPeriod]);

  const effectiveRawMap = useMemo(
    () => (selectedPeriod || defaultPeriodId ? rawMap : new Map()),
    [selectedPeriod, defaultPeriodId, rawMap]
  );

  const filteredDesa = desa
    .filter(d =>
      d.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(d.code ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort(compareByCodeThenName);

  const totalPages = Math.max(1, Math.ceil(filteredDesa.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedDesa = filteredDesa.slice(startIndex, startIndex + pageSize);

  // Calculate unique kecamatan count
  const uniqueKecamatan = [...new Set(desa.map(d => d.kecamatan).filter(k => k))];
  const totalKecamatan = uniqueKecamatan.length;

  const tableData = paginatedDesa.map((d, i) => {
    const values = effectiveRawMap.get(d.id) || {};
    const row = {
      no: startIndex + i + 1,
      id: d.id,
      code: d.code ?? "-",
      nama: d.nama,
      kecamatan: d.kecamatan,
      jumlah_bpkal: (values.jumlah_bpkal ?? d.jumlah_bpkal) ?? "",
    };

    criteriaList.forEach(c => {
      let val = values[c.code];
      if (val === undefined || val === null) {
        if (c.code === padukuhanCode) val = d.jumlah_padukuhan;
        else if (c.code === miskinCode) val = d.jumlah_penduduk_miskin;
        else if (c.code === luasCode) val = d.luas_wilayah;
        else if (c.code === pendudukCode) val = d.jumlah_penduduk;
        else if (c.code === geografisCode) val = d.indeks_kesulitan_geografis;
      }
      row[c.code] = val ?? "";
    });

    return row;
  });

  const handleExportPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Data Kalurahan - Kabupaten Sleman</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1e40af; margin-bottom: 10px; }
            .header { margin-bottom: 30px; }
            .info { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f3f4f6; font-weight: 600; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Data Kalurahan Kabupaten Sleman</h1>
            <p class="info">Periode ${selectedPeriod || defaultPeriodId} | Total Kalurahan: ${desa.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Kode</th>
                <th>Nama Kalurahan</th>
                <th>Kecamatan</th>
                ${criteriaList.map(c => `<th>${c.name}</th>`).join('')}
                <th>Jumlah BPKal</th>
              </tr>
            </thead>
            <tbody>
              ${desa.map((d, i) => {
                const values = effectiveRawMap.get(d.id) || {};
                const criteriaCells = criteriaList.map(c => {
                  let val = values[c.code];
                  if (val === undefined || val === null) {
                    if (c.code === padukuhanCode) val = d.jumlah_padukuhan;
                    else if (c.code === miskinCode) val = d.jumlah_penduduk_miskin;
                    else if (c.code === luasCode) val = d.luas_wilayah;
                    else if (c.code === pendudukCode) val = d.jumlah_penduduk;
                    else if (c.code === geografisCode) val = d.indeks_kesulitan_geografis;
                  }
                  let displayVal = "-";
                  if (val !== undefined && val !== null && val !== "") {
                    if (c.nature === "kualitatif") {
                      displayVal = val;
                    } else {
                      displayVal = formatDecimalDisplay(val);
                    }
                  }
                  return `<td>${displayVal}</td>`;
                }).join('');
                const rawBpkal = values.jumlah_bpkal ?? d.jumlah_bpkal;
                const bpkalCell = rawBpkal !== undefined && rawBpkal !== null && rawBpkal !== "" ? formatInteger(rawBpkal) : '-';
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${d.code || '-'}</td>
                    <td>${d.nama}</td>
                    <td>${d.kecamatan || '-'}</td>
                    ${criteriaCells}
                    <td>${bpkalCell}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormNama("");
    setFormKecamatan("");
    setFormJumlahBpkal("");
    const nextCriteriaVals = {};
    criteriaList.forEach(c => {
      nextCriteriaVals[c.code] = "";
    });
    setFormCriteriaValues(nextCriteriaVals);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    if (!item) return;
    setEditingId(item.id);
    setFormNama(item.nama ?? item.name ?? "");
    setFormKecamatan(item.kecamatan ?? "");
    setFormJumlahBpkal(item.jumlah_bpkal ?? "");
    
    const periodToUse = selectedPeriod || null;
    (async () => {
      let vals = {};
      if (periodToUse) {
        const doc = await getRawValuesForDesaPeriod(item.id, periodToUse).catch(() => null);
        if (doc && doc.values) {
          vals = doc.values || {};
        }
      }
      
      const nextCriteriaVals = {};
      criteriaList.forEach(c => {
        let val = vals[c.code];
        if (val === undefined || val === null) {
          if (c.code === padukuhanCode) val = item.jumlah_padukuhan;
          else if (c.code === miskinCode) val = item.jumlah_penduduk_miskin;
          else if (c.code === luasCode) val = item.luas_wilayah;
          else if (c.code === pendudukCode) val = item.jumlah_penduduk;
          else if (c.code === geografisCode) val = item.indeks_kesulitan_geografis;
        }
        nextCriteriaVals[c.code] = val !== undefined && val !== null ? String(val) : "";
      });
      
      setFormCriteriaValues(nextCriteriaVals);
      
      const bpkalVal = vals.jumlah_bpkal ?? item.jumlah_bpkal ?? "";
      setFormJumlahBpkal(bpkalVal);
    })();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const { confirm, alert } = useDialog();

  const handleSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (isLocked) {
      return alert({
        message: selectedPeriodData?.locked 
          ? "❌ Periode dikunci secara global. Buka kunci di menu Periode terlebih dahulu." 
          : "❌ Alokasi Earmark periode ini telah difinalisasi. Buka kunci earmark terlebih dahulu.",
        type: "error",
      });
    }
    try {
      const payload = {
        name: sanitizeInputText(formNama),
        kecamatan: sanitizeInputText(formKecamatan),
        jumlah_bpkal: formJumlahBpkal === "" ? null : Number(formJumlahBpkal),
      };

      const valPadukuhan = formCriteriaValues[padukuhanCode];
      payload.jumlah_padukuhan = valPadukuhan === undefined || valPadukuhan === "" ? null : Number(valPadukuhan);
      payload.jumlah_dukuh = valPadukuhan === undefined || valPadukuhan === "" ? null : Number(valPadukuhan);

      const valLuas = formCriteriaValues[luasCode];
      payload.luas_wilayah = valLuas === undefined || valLuas === "" ? null : Number(valLuas);

      const valPenduduk = formCriteriaValues[pendudukCode];
      payload.jumlah_penduduk = valPenduduk === undefined || valPenduduk === "" ? null : Number(valPenduduk);

      const valMiskin = formCriteriaValues[miskinCode];
      payload.jumlah_penduduk_miskin = valMiskin === undefined || valMiskin === "" ? null : Number(valMiskin);

      const valGeografis = formCriteriaValues[geografisCode];
      payload.indeks_kesulitan_geografis = valGeografis === undefined || valGeografis === "" ? null : Number(valGeografis);

      const periodToUse = selectedPeriod || defaultPeriodId;
      const periodExists = periodToUse
        ? periods.some(p => String(p.id) === String(periodToUse))
        : false;

      if (!periodExists) {
        alert({ message: 'Periode aktif belum tersedia. Buat atau aktifkan periode dulu sebelum menyimpan data kalurahan.', type: 'error' });
        return;
      }

      const values = {
        jumlah_bpkal: payload.jumlah_bpkal,
      };
      criteriaList.forEach(c => {
        const val = formCriteriaValues[c.code];
        values[c.code] = val === undefined || val === "" ? null : Number(val);
      });

      if (editingId) {
        if (periodToUse) {
          await setRawValuesForDesaPeriod(editingId, periodToUse, values, { updatedBy: null });
          setRawMap((prev) => {
            const next = new Map(prev);
            next.set(editingId, values);
            return next;
          });
        }
        await updateDesa(editingId, payload);
      } else {
        const created = await createDesa(payload);
        if (periodToUse && periodExists && created?.id) {
          await setRawValuesForDesaPeriod(created.id, periodToUse, values, { updatedBy: null });
          setRawMap((prev) => {
            const next = new Map(prev);
            next.set(created.id, values);
            return next;
          });
        }
      }

      const nextDesa = await fetchDesa();
      await loadRawValuesForPeriod(periodToUse, nextDesa ?? []);
      closeModal();
    } catch (err) {
      console.error("Gagal menyimpan kalurahan:", err);
      alert({ message: "Gagal menyimpan. Cek console untuk detail.", type: "error" });
    }
  };

  const handleDelete = async (item) => {
    if (!item || !item.id) return;
    if (isLocked) {
      return alert({
        message: selectedPeriodData?.locked 
          ? "❌ Periode dikunci secara global. Buka kunci di menu Periode terlebih dahulu." 
          : "❌ Alokasi Earmark periode ini telah difinalisasi. Buka kunci earmark terlebih dahulu.",
        type: "error",
      });
    }
    try {
      const ok = await confirm({ title: "Konfirmasi", message: `Hapus kalurahan ${item.nama || item.name}?` });
      if (!ok) return;
      await deleteDesa(item.id);
      await fetchDesa();
    } catch (err) {
      console.error("Gagal menghapus kalurahan:", err);
      alert({ message: "Gagal menghapus. Cek console untuk detail.", type: "error" });
    }
  };

  // --- IMPORT EXCEL/CSV FUNCTIONS ---
  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setIsImportPreviewGenerated(false);
    setImportPreviewData([]);
    setUnmatchedRows([]);

    const reader = new FileReader();
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    reader.onload = (evt) => {
      try {
        let grid = [];
        if (isExcel) {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        } else {
          const text = evt.target.result;
          grid = parseCSV(text);
        }

        if (!grid || grid.length === 0) {
          alert({ message: "Berkas kosong atau tidak dapat dibaca.", type: "error" });
          return;
        }

        // Clean empty rows from end
        while (grid.length > 0 && grid[grid.length - 1].every(cell => cell === "" || cell == null)) {
          grid.pop();
        }

        setCsvRows(grid);

        // Find header row automatically by looking for common keywords
        let detectedHeaderIdx = 0;
        for (let i = 0; i < Math.min(15, grid.length); i++) {
          const row = grid[i];
          if (row.some(cell => {
            const val = String(cell || "").toLowerCase();
            return val.includes("wilayah") || val.includes("kalurahan") || val.includes("nama") || val.includes("kapanewon") || val.includes("jumlah");
          })) {
            detectedHeaderIdx = i;
            break;
          }
        }
        setHeaderRowIdx(detectedHeaderIdx);
        updateHeadersAndAutoDetect(grid, detectedHeaderIdx);
      } catch (err) {
        console.error("Gagal membaca file:", err);
        alert({ message: "Gagal membaca file: " + err.message, type: "error" });
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const updateHeadersAndAutoDetect = (grid, headerIdx) => {
    const headerRow = grid[headerIdx] || [];
    const headersList = headerRow.map((cell, idx) => {
      const colLetter = XLSX.utils.encode_col(idx);
      return {
        index: idx,
        letter: colLetter,
        text: String(cell || "").trim() || `(Kolom ${colLetter})`
      };
    });

    setCsvHeaders(headersList);

    // Auto-detect columns
    const detect = { name: -1, C1: -1, C2: -1, C3: -1, C4: -1, C5: -1, bpkal: -1 };
    headersList.forEach((h) => {
      const txt = h.text.toLowerCase();
      // Match Nama Kalurahan
      if ((txt.includes("wilayah") || txt.includes("kalurahan") || txt.includes("nama") || txt.includes("desa") || txt.includes("kapanewon")) && !txt.includes("jumlah")) {
        if (detect.name === -1) detect.name = h.index;
      }
      // Match C1
      if (txt.includes("padukuhan") || txt.includes("dukuh") || txt.includes("c1")) {
        detect.C1 = h.index;
      }
      // Match C2
      if (txt.includes("miskin") || txt.includes("c2")) {
        detect.C2 = h.index;
      }
      // Match C3
      if ((txt.includes("luas") && txt.includes("wilayah")) || txt.includes("luas") || txt.includes("c3")) {
        detect.C3 = h.index;
      }
      // Match C4
      if ((txt.includes("penduduk") && !txt.includes("miskin")) || (txt.includes("jumlah") && !txt.includes("padukuhan") && !txt.includes("miskin") && !txt.includes("bpkal") && !txt.includes("wilayah")) || txt.includes("c4")) {
        if (detect.C4 === -1) detect.C4 = h.index;
      }
      // Match C5
      if (txt.includes("geografis") || txt.includes("kesulitan") || txt.includes("c5")) {
        detect.C5 = h.index;
      }
      // Match BPKal
      if (txt.includes("bpkal") || txt.includes("anggota bpkal")) {
        detect.bpkal = h.index;
      }
    });

    setMappedColumns(detect);
  };

  const handleHeaderRowChange = (idx) => {
    setHeaderRowIdx(Number(idx));
    updateHeadersAndAutoDetect(csvRows, Number(idx));
    setIsImportPreviewGenerated(false);
  };

  const handleGenerateImportPreview = () => {
    if (mappedColumns.name === -1) {
      alert({ message: "Silakan pilih kolom acuan Nama Kalurahan terlebih dahulu.", type: "error" });
      return;
    }

    const masterNameMap = new Map();
    desa.forEach((d) => {
      masterNameMap.set(normalizeName(d.nama), d.id);
    });

    const previewMap = new Map();
    desa.forEach((d) => {
      previewMap.set(d.id, {
        id: d.id,
        code: d.code,
        nama: d.nama,
        kecamatan: d.kecamatan,
        matched: false,
        rowNum: null,
        values: {},
        jumlah_bpkal: null,
      });
    });

    const unmatchedList = [];

    // Parse data rows starting after header row
    for (let i = headerRowIdx + 1; i < csvRows.length; i++) {
      const row = csvRows[i];
      if (!row || row.length === 0) continue;

      const rawName = String(row[mappedColumns.name] || "").trim();
      if (!rawName) continue;

      const normName = normalizeName(rawName);

      // Check if it's a known village
      if (masterNameMap.has(normName)) {
        const desaId = masterNameMap.get(normName);
        const record = previewMap.get(desaId);

        record.matched = true;
        record.rowNum = i + 1;

        // Parse mapped criteria values
        const vals = {};
        if (mappedColumns.C1 !== -1) {
          const val = String(row[mappedColumns.C1] || "").replace(/[^0-9.-]/g, "");
          vals[padukuhanCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C2 !== -1) {
          const val = String(row[mappedColumns.C2] || "").replace(/[^0-9.-]/g, "");
          vals[miskinCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C3 !== -1) {
          const val = String(row[mappedColumns.C3] || "").replace(/[^0-9.-]/g, "");
          vals[luasCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C4 !== -1) {
          const val = String(row[mappedColumns.C4] || "").replace(/[^0-9.-]/g, "");
          vals[pendudukCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C5 !== -1) {
          const val = String(row[mappedColumns.C5] || "").replace(/[^0-9.-]/g, "");
          vals[geografisCode] = val === "" ? null : Number(val);
        }
        record.values = vals;

        if (mappedColumns.bpkal !== -1) {
          const val = String(row[mappedColumns.bpkal] || "").replace(/[^0-9.-]/g, "");
          record.jumlah_bpkal = val === "" ? null : Number(val);
        }
      } else {
        // Skip common headers/totals that are clearly not village names
        if (normName === "jumlah" || normName === "total" || normName === "sleman" || normName === "kepanjen") {
          continue;
        }
        // Save to unmatched list for manual correction
        unmatchedList.push({
          rowIndex: i,
          rawName: rawName,
          rowData: row,
          selectedDesaId: ""
        });
      }
    }

    setImportPreviewData(Array.from(previewMap.values()));
    setUnmatchedRows(unmatchedList);
    setIsImportPreviewGenerated(true);
  };

  const handleManualMatch = (rowIndex, selectedDesaId) => {
    // Update unmatched list
    setUnmatchedRows((prev) => {
      const next = prev.map((u) => {
        if (u.rowIndex === rowIndex) {
          return { ...u, selectedDesaId };
        }
        return u;
      });

      // Recalculate preview list with manual matches
      setTimeout(() => {
        recalculatePreviewWithManualMatches(next);
      }, 0);

      return next;
    });
  };

  const recalculatePreviewWithManualMatches = (currentUnmatched) => {
    const masterNameMap = new Map();
    desa.forEach((d) => {
      masterNameMap.set(normalizeName(d.nama), d.id);
    });

    const previewMap = new Map();
    desa.forEach((d) => {
      previewMap.set(d.id, {
        id: d.id,
        code: d.code,
        nama: d.nama,
        kecamatan: d.kecamatan,
        matched: false,
        rowNum: null,
        values: {},
        jumlah_bpkal: null,
      });
    });

    // 1. Run automatic matches first
    for (let i = headerRowIdx + 1; i < csvRows.length; i++) {
      const row = csvRows[i];
      if (!row || row.length === 0) continue;

      const rawName = String(row[mappedColumns.name] || "").trim();
      if (!rawName) continue;

      const normName = normalizeName(rawName);

      if (masterNameMap.has(normName)) {
        const desaId = masterNameMap.get(normName);
        const record = previewMap.get(desaId);

        record.matched = true;
        record.rowNum = i + 1;

        const vals = {};
        if (mappedColumns.C1 !== -1) {
          const val = String(row[mappedColumns.C1] || "").replace(/[^0-9.-]/g, "");
          vals[padukuhanCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C2 !== -1) {
          const val = String(row[mappedColumns.C2] || "").replace(/[^0-9.-]/g, "");
          vals[miskinCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C3 !== -1) {
          const val = String(row[mappedColumns.C3] || "").replace(/[^0-9.-]/g, "");
          vals[luasCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C4 !== -1) {
          const val = String(row[mappedColumns.C4] || "").replace(/[^0-9.-]/g, "");
          vals[pendudukCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C5 !== -1) {
          const val = String(row[mappedColumns.C5] || "").replace(/[^0-9.-]/g, "");
          vals[geografisCode] = val === "" ? null : Number(val);
        }
        record.values = vals;

        if (mappedColumns.bpkal !== -1) {
          const val = String(row[mappedColumns.bpkal] || "").replace(/[^0-9.-]/g, "");
          record.jumlah_bpkal = val === "" ? null : Number(val);
        }
      }
    }

    // 2. Add manual matches from currentUnmatched list
    currentUnmatched.forEach((u) => {
      if (u.selectedDesaId) {
        const record = previewMap.get(u.selectedDesaId);
        const row = u.rowData;

        record.matched = true;
        record.rowNum = u.rowIndex + 1;

        const vals = {};
        if (mappedColumns.C1 !== -1) {
          const val = String(row[mappedColumns.C1] || "").replace(/[^0-9.-]/g, "");
          vals[padukuhanCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C2 !== -1) {
          const val = String(row[mappedColumns.C2] || "").replace(/[^0-9.-]/g, "");
          vals[miskinCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C3 !== -1) {
          const val = String(row[mappedColumns.C3] || "").replace(/[^0-9.-]/g, "");
          vals[luasCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C4 !== -1) {
          const val = String(row[mappedColumns.C4] || "").replace(/[^0-9.-]/g, "");
          vals[pendudukCode] = val === "" ? null : Number(val);
        }
        if (mappedColumns.C5 !== -1) {
          const val = String(row[mappedColumns.C5] || "").replace(/[^0-9.-]/g, "");
          vals[geografisCode] = val === "" ? null : Number(val);
        }
        record.values = vals;

        if (mappedColumns.bpkal !== -1) {
          const val = String(row[mappedColumns.bpkal] || "").replace(/[^0-9.-]/g, "");
          record.jumlah_bpkal = val === "" ? null : Number(val);
        }
      }
    });

    setImportPreviewData(Array.from(previewMap.values()));
  };

  const handleSaveImport = async () => {
    const periodToUse = selectedPeriod || defaultPeriodId;
    if (!periodToUse) return;

    const matchedCount = importPreviewData.filter((d) => d.matched).length;
    if (matchedCount === 0) {
      alert({ message: "Tidak ada kalurahan yang cocok untuk diimpor. Silakan periksa kembali pemetaan kolom atau nama kalurahan Anda.", type: "error" });
      return;
    }

    const ok = await confirm({
      title: "Konfirmasi Simpan Massal",
      message: `Apakah Anda yakin ingin menyimpan kriteria hasil impor untuk ${matchedCount} kalurahan ke periode target ${selectedPeriod}?`
    });
    if (!ok) return;

    setLoading(true);
    try {
      // 1. Fetch current database values to merge
      const existingRows = await listRawValuesForPeriod(periodToUse).catch(() => []);
      const existingMap = new Map();
      existingRows.forEach((r) => {
        existingMap.set(r.id, r);
      });

      const payloads = [];

      // 2. Build merge payloads
      importPreviewData.forEach((record) => {
        if (!record.matched) return; // Skip unmatched ones

        const dbRecord = existingMap.get(record.id);
        const dbValues = dbRecord?.values || {};
        const dbBpkal = dbRecord?.jumlah_bpkal ?? null;

        const mergedValues = { ...dbValues };
        if (mappedColumns.C1 !== -1) mergedValues[padukuhanCode] = record.values[padukuhanCode];
        if (mappedColumns.C2 !== -1) mergedValues[miskinCode] = record.values[miskinCode];
        if (mappedColumns.C3 !== -1) mergedValues[luasCode] = record.values[luasCode];
        if (mappedColumns.C4 !== -1) mergedValues[pendudukCode] = record.values[pendudukCode];
        if (mappedColumns.C5 !== -1) mergedValues[geografisCode] = record.values[geografisCode];

        let mergedBpkal = dbBpkal;
        if (mappedColumns.bpkal !== -1) mergedBpkal = record.jumlah_bpkal;

        payloads.push({
          desa_id: record.id,
          period_id: String(periodToUse),
          values: mergedValues,
          jumlah_bpkal: mergedBpkal,
          updated_at: new Date().toISOString(),
        });
      });

      // 3. Save bulk
      await saveBulkRawValues(payloads);

      alert({ message: `Berhasil mengimpor data kriteria untuk ${payloads.length} kalurahan ke periode ${selectedPeriod}.`, type: "info" });
      
      // Close & refresh
      setIsImportModalOpen(false);
      setImportFile(null);
      setCsvRows([]);
      setImportPreviewData([]);
      setUnmatchedRows([]);
      setIsImportPreviewGenerated(false);
      
      const nextDesa = await fetchDesa();
      await loadRawValuesForPeriod(periodToUse, nextDesa);
    } catch (err) {
      console.error("Gagal menyimpan hasil impor:", err);
      alert({ message: "Gagal menyimpan hasil impor: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyData = async () => {
    if (!selectedPeriod) return alert({ message: "Pilih periode tujuan terlebih dahulu.", type: "error" });
    if (!copySourcePeriod) return alert({ message: "Pilih periode sumber terlebih dahulu.", type: "error" });
    if (String(selectedPeriod) === String(copySourcePeriod)) {
      return alert({ message: "Periode sumber dan tujuan tidak boleh sama.", type: "error" });
    }
    if (isLocked) {
      return alert({
        message: selectedPeriodData?.locked
          ? "❌ Periode tujuan dikunci secara global. Buka kunci di menu Periode terlebih dahulu."
          : "❌ Alokasi Earmark periode tujuan telah difinalisasi. Buka kunci earmark terlebih dahulu.",
        type: "error",
      });
    }

    const ok = await confirm({
      title: "Salin Data Kriteria Kalurahan",
      message: `Apakah Anda yakin ingin menyalin semua data kriteria kalurahan dari periode ${copySourcePeriod} ke periode ${selectedPeriod}? Tindakan ini akan menimpa data yang sudah ada di periode ${selectedPeriod}.`,
      confirmLabel: "Salin Sekarang",
      cancelLabel: "Batal",
    });
    if (!ok) return;

    setLoading(true);
    try {
      const res = await copyDesaRawValues(copySourcePeriod, selectedPeriod);
      alert({
        message: `Berhasil menyalin data kriteria kalurahan dari periode ${copySourcePeriod} ke ${selectedPeriod} (${res.count} kalurahan disalin).`,
        type: "info",
      });
      const nextDesa = await fetchDesa();
      await loadRawValuesForPeriod(selectedPeriod, nextDesa);
      setIsCopyModalOpen(false);
      setCopySourcePeriod("");
    } catch (err) {
      console.error("Gagal menyalin data kalurahan:", err);
      alert({ message: err?.message ?? "Gagal menyalin data kriteria kalurahan.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header-container">
        <div className="page-header">
          <h1 className="page-title">Data Kalurahan</h1>
          <p className="page-subtitle">
            Kelola daftar profil wilayah kalurahan beserta input nilai kriteria mentah (dinamis) untuk setiap periode penilaian.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
          <PeriodSelector
            value={selectedPeriod}
            onChange={(v) => setSelectedPeriod(v || defaultPeriodId)}
            filter={null}
            allowOnlyActive={false}
          />
          <button
            onClick={() => setIsCopyModalOpen(true)}
            disabled={isLocked}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy size={16} />
            Salin Data
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            disabled={isLocked}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={16} />
            Import CSV / Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="btn-action"
          >
            <FileDown size={18} />
            Export
          </button>
        </div>
      </div>

      {isLocked && (
        <div className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm mb-4 ${
          selectedPeriodData?.locked 
            ? "border-red-200 bg-red-50 text-red-950" 
            : "border-amber-200 bg-amber-50 text-amber-950"
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 shrink-0 ${selectedPeriodData?.locked ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            {selectedPeriodData?.locked ? (
              <>
                <p className="text-sm font-semibold">Periode Terkunci (Global)</p>
                <p className="text-xs text-red-700">Periode ini telah dikunci secara global oleh admin. Pengeditan data kalurahan dan nilai kriteria dinonaktifkan kecuali kunci dibuka di menu <span className="font-semibold">Periode</span>.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Alokasi Earmark Terkunci (Final)</p>
                <p className="text-xs text-amber-700">Hasil alokasi earmark periode ini sudah difinalisasi. Data kalurahan dan nilai kriteria dinonaktifkan dari perubahan agar hasil perhitungan tetap konsisten. Buka kunci di menu <span className="font-semibold">Alokasi Earmark</span> untuk melakukan perubahan.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="Total Kalurahan"
          value={desa.length}
          subtitle="Jumlah kalurahan yang terdata"
        />
        <StatCard
          title="Total Kecamatan"
          value={totalKecamatan}
          subtitle="Jumlah kecamatan di Sleman"
        />
      </div>

      {/* Search & Table */}
      <div className="panel-info rounded-xl">
        <div className="p-4 border-b border-green-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              placeholder="Cari nama kalurahan..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full md:max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 justify-between md:justify-end w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span>Tampilkan</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[10, 20, 30, 40, 50].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span>per halaman</span>
              </div>
              <button
                onClick={() => openCreateModal()}
                disabled={isLocked}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 shrink-0"
              >
                <Plus size={16} /> Tambah Kalurahan
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Menampilkan {paginatedDesa.length} dari {filteredDesa.length} data (total {desa.length})
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="table-core">
            <thead className="table-head">
              <tr>
                <th className="px-6 py-3 text-left font-medium">NO</th>
                <th className="px-6 py-3 text-left font-medium">CODE</th>
                <th className="px-6 py-3 text-left font-medium">NAMA KALURAHAN</th>
                <th className="px-6 py-3 text-left font-medium">KECAMATAN</th>
                {criteriaList.map((c) => (
                  <th key={c.code} className="px-6 py-3 text-left font-medium">
                    {c.name}
                  </th>
                ))}
                <th className="px-6 py-3 text-left font-medium">Jumlah BPKal</th>
                <th className="px-6 py-3 text-left font-medium">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr key={idx} className="table-row">
                  <td className="px-6 py-4">{row.no}</td>
                  <td className="px-6 py-4 text-gray-700">{row.code}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{row.nama}</td>
                  <td className="px-6 py-4 text-gray-600">{row.kecamatan}</td>
                  {criteriaList.map((c) => {
                    const val = row[c.code];
                    let displayVal = "-";
                    if (val !== undefined && val !== null && val !== "") {
                      if (c.nature === "kualitatif") {
                        displayVal = val;
                      } else {
                        displayVal = formatDecimalDisplay(val);
                      }
                    }
                    return (
                      <td key={c.code} className="px-6 py-4 text-gray-600">
                        {displayVal}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-gray-600">{row.jumlah_bpkal !== "" ? formatInteger(row.jumlah_bpkal) : "-"}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(filteredDesa[startIndex + idx])}
                        disabled={isLocked}
                        className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Pen size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(filteredDesa[startIndex + idx])}
                        disabled={isLocked}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDesa.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>Tidak ada data kalurahan ditemukan</p>
          </div>
        )}

        {/* Pagination Info */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Halaman {Math.min(page, totalPages)} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`btn-secondary-sm ${page <= 1 ? "cursor-not-allowed opacity-50" : ""}`}
            >
              Previous
            </button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
              {Math.min(page, totalPages)}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`btn-secondary-sm ${page >= totalPages ? "cursor-not-allowed opacity-50" : ""}`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create / Edit Kalurahan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:max-w-lg sm:p-6">
            <h3 className="text-lg font-semibold mb-4">{editingId ? "Edit Kalurahan" : "Tambah Kalurahan"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Kalurahan</label>
                <input
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Kecamatan</label>
                <input
                  value={formKecamatan}
                  onChange={(e) => setFormKecamatan(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {/* Kriteria Dinamis */}
              {criteriaList.map((c) => {
                const paramConfig = parameters.find((p) => String(p.criteriaCode).toUpperCase() === String(c.code).toUpperCase());
                const options = paramConfig?.list ?? [];
                return (
                  <div key={c.code}>
                    <label className="block text-sm font-medium text-gray-700">
                      {c.name} ({c.code})
                    </label>
                    {c.nature === "kualitatif" && options.length > 0 ? (
                      <select
                        value={formCriteriaValues[c.code] ?? ""}
                        onChange={(e) =>
                          setFormCriteriaValues((prev) => ({
                            ...prev,
                            [c.code]: e.target.value,
                          }))
                        }
                        className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                        required
                      >
                        <option value="">Pilih opsi</option>
                        {options.map((opt, i) => (
                          <option key={i} value={opt.label}>
                            {opt.label} (Skor: {opt.score})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <DecimalInput
                        value={formCriteriaValues[c.code] ?? ""}
                        onChange={(val) =>
                          setFormCriteriaValues((prev) => ({
                            ...prev,
                            [c.code]: val,
                          }))
                        }
                        className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                );
              })}

              <div>
                <label className="block text-sm font-medium text-gray-700">Jumlah BPKal</label>
                <IntegerInput
                  value={formJumlahBpkal}
                  onChange={(val) => setFormJumlahBpkal(val)}
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Isi bilangan bulat total orang BPKal di kalurahan.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-3 py-2 bg-gray-100 rounded flex items-center justify-center" aria-label="close">
                  <X size={16} />
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded inline-flex items-center gap-2"><Save size={16} /> Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Salin Data Periode */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Salin Data Kriteria Kalurahan</h3>
              <button
                onClick={() => {
                  setIsCopyModalOpen(false);
                  setCopySourcePeriod("");
                }}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Salin seluruh nilai inputan kriteria dinamis kalurahan (seperti Jumlah Penduduk Miskin, Luas Wilayah, dll.) dari tahun anggaran sebelumnya ke periode target saat ini.
              </p>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Periode Sumber (Salin Dari)</label>
                <select
                  value={copySourcePeriod}
                  onChange={(e) => setCopySourcePeriod(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">Pilih periode sumber</option>
                  {periods
                    .filter((p) => String(p.id) !== String(selectedPeriod))
                    .map((p) => (
                      <option key={`copy-src-${p.id}`} value={p.id}>
                        {p.year ?? p.id} {p.active ? "(Aktif)" : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Periode Target (Salin Ke)</label>
                <input
                  type="text"
                  value={selectedPeriodData?.year ?? selectedPeriod ?? ""}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 font-medium cursor-not-allowed"
                />
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-relaxed">
                ⚠️ <strong>Perhatian:</strong> Tindakan ini akan menimpa seluruh nilai kriteria kalurahan yang sudah terisi pada periode target <strong>{selectedPeriod}</strong>. Pastikan periode tujuan belum terkunci.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCopyModalOpen(false);
                  setCopySourcePeriod("");
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCopyData}
                disabled={!copySourcePeriod}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition inline-flex items-center gap-1.5"
              >
                <Copy size={14} />
                Salin Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Data CSV / Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-lg max-h-[90vh] overflow-y-auto sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Import Data Kalurahan (CSV / Excel)</h3>
                <p className="text-xs text-slate-500">Unggah berkas data mentah untuk periode {selectedPeriodData?.year ?? selectedPeriod}</p>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setCsvRows([]);
                  setImportPreviewData([]);
                  setUnmatchedRows([]);
                  setIsImportPreviewGenerated(false);
                }}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Step 1: Upload File */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <label className="block text-sm font-semibold text-slate-800 mb-2">1. Pilih Berkas CSV / Excel</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleImportFileChange}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 file:hover:bg-blue-100 cursor-pointer"
                  />
                </div>
                {importFile && (
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    📄 Terbaca: {importFile.name} ({csvRows.length} baris data ditemukan)
                  </p>
                )}
              </div>

              {/* Step 2: Mapping Columns */}
              {csvRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <label className="block text-sm font-semibold text-slate-800">2. Sesuaikan Baris Header & Pemetaan Kolom</label>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600 font-medium">Baris Header:</span>
                      <select
                        value={headerRowIdx}
                        onChange={(e) => handleHeaderRowChange(e.target.value)}
                        className="rounded border border-slate-200 px-2 py-1 bg-white text-slate-800 font-semibold"
                      >
                        {Array.from({ length: Math.min(10, csvRows.length) }, (_, i) => (
                          <option key={i} value={i}>Baris ke-{i + 1}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed bg-blue-50 text-blue-900 border border-blue-200 p-2.5 rounded-lg">
                    💡 <strong>Tips Legenda:</strong> Sesuaikan kolom file Anda dengan kriteria di aplikasi. Gunakan opsi <em>"-- Lewati --"</em> untuk kriteria yang tidak ingin diubah di database (impor parsial).
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Name column mapping */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">Acuan Nama/Wilayah Kalurahan (Wajib):</label>
                      <select
                        value={mappedColumns.name}
                        onChange={(e) => setMappedColumns(prev => ({ ...prev, name: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200 font-medium"
                      >
                        <option value={-1}>-- Pilih Kolom Nama --</option>
                        {csvHeaders.map(h => (
                          <option key={h.index} value={h.index}>Kolom {h.letter}: {h.text}</option>
                        ))}
                      </select>
                    </div>

                    {/* C1 Padukuhan */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">C1 - Jumlah Padukuhan / Dukuh:</label>
                      <select
                        value={mappedColumns.C1}
                        onChange={(e) => setMappedColumns(prev => ({ ...prev, C1: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value={-1}>-- Lewati (Jangan Impor) --</option>
                        {csvHeaders.map(h => (
                          <option key={h.index} value={h.index}>Kolom {h.letter}: {h.text}</option>
                        ))}
                      </select>
                    </div>

                    {/* C2 Miskin */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">C2 - Jumlah Penduduk Miskin:</label>
                      <select
                        value={mappedColumns.C2}
                        onChange={(e) => setMappedColumns(prev => ({ ...prev, C2: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value={-1}>-- Lewati (Jangan Impor) --</option>
                        {csvHeaders.map(h => (
                          <option key={h.index} value={h.index}>Kolom {h.letter}: {h.text}</option>
                        ))}
                      </select>
                    </div>

                    {/* C3 Luas */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">C3 - Luas Wilayah (Ha):</label>
                      <select
                        value={mappedColumns.C3}
                        onChange={(e) => setMappedColumns(prev => ({ ...prev, C3: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value={-1}>-- Lewati (Jangan Impor) --</option>
                        {csvHeaders.map(h => (
                          <option key={h.index} value={h.index}>Kolom {h.letter}: {h.text}</option>
                        ))}
                      </select>
                    </div>

                    {/* C4 Penduduk */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">C4 - Jumlah Penduduk:</label>
                      <select
                        value={mappedColumns.C4}
                        onChange={(e) => setMappedColumns(prev => ({ ...prev, C4: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value={-1}>-- Lewati (Jangan Impor) --</option>
                        {csvHeaders.map(h => (
                          <option key={h.index} value={h.index}>Kolom {h.letter}: {h.text}</option>
                        ))}
                      </select>
                    </div>

                    {/* C5 Geografis */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">C5 - Indeks Kesulitan Geografis:</label>
                      <select
                        value={mappedColumns.C5}
                        onChange={(e) => setMappedColumns(prev => ({ ...prev, C5: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value={-1}>-- Lewati (Jangan Impor) --</option>
                        {csvHeaders.map(h => (
                          <option key={h.index} value={h.index}>Kolom {h.letter}: {h.text}</option>
                        ))}
                      </select>
                    </div>

                    {/* BPKal */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 block">Jumlah Anggota BPKal:</label>
                      <select
                        value={mappedColumns.bpkal}
                        onChange={(e) => setMappedColumns(prev => ({ ...prev, bpkal: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value={-1}>-- Lewati (Jangan Impor) --</option>
                        {csvHeaders.map(h => (
                          <option key={h.index} value={h.index}>Kolom {h.letter}: {h.text}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleGenerateImportPreview}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition"
                    >
                      Proses & Tampilkan Pratinjau
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview Data */}
              {isImportPreviewGenerated && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800">3. Pratinjau Hasil Pencocokan (Tinjau Sebelum Simpan)</label>
                    <p className="text-xs text-slate-500 mt-1">Sistem berhasil memetakan {importPreviewData.filter(d => d.matched).length} kalurahan dari total 86 kalurahan resmi Sleman.</p>
                  </div>

                  {/* Unmatched Rows manual correction */}
                  {unmatchedRows.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2 text-xs">
                      <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle size={16} className="text-amber-600" />
                        <span>Terdapat {unmatchedRows.length} baris kalurahan di file yang tidak terdeteksi otomatis:</span>
                      </h4>
                      <p className="text-amber-700">Jika nama kalurahan di file dinas lain salah ketik, Anda bisa mengarahkan secara manual ke nama kalurahan Sleman yang benar melalui dropdown di bawah ini:</p>
                      
                      <div className="max-h-[150px] overflow-y-auto divide-y divide-amber-100 bg-white border border-amber-200 rounded-lg p-2 space-y-2.5">
                        {unmatchedRows.map((u) => (
                          <div key={u.rowIndex} className="flex items-center justify-between gap-3 pt-2 text-slate-800 font-medium">
                            <span>Baris {u.rowIndex + 1}: <strong>"{u.rawName}"</strong></span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 text-[10px]">Arahkan ke:</span>
                              <select
                                value={u.selectedDesaId}
                                onChange={(e) => handleManualMatch(u.rowIndex, e.target.value)}
                                className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                              >
                                <option value="">-- Lewati Baris Ini --</option>
                                {desa.map((d) => (
                                  <option key={d.id} value={d.id}>{d.nama}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="overflow-x-auto max-h-[280px] border border-slate-100 rounded-xl">
                    <table className="min-w-full text-xs text-left text-slate-700 border-collapse">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                        <tr>
                          <th className="px-4 py-2">Kalurahan</th>
                          <th className="px-4 py-2">Kecamatan</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          {mappedColumns.C1 !== -1 && <th className="px-4 py-2 text-right">C1 (Dukuh)</th>}
                          {mappedColumns.C2 !== -1 && <th className="px-4 py-2 text-right">C2 (Miskin)</th>}
                          {mappedColumns.C3 !== -1 && <th className="px-4 py-2 text-right">C3 (Luas)</th>}
                          {mappedColumns.C4 !== -1 && <th className="px-4 py-2 text-right">C4 (Penduduk)</th>}
                          {mappedColumns.C5 !== -1 && <th className="px-4 py-2 text-right">C5 (Kesulitan)</th>}
                          {mappedColumns.bpkal !== -1 && <th className="px-4 py-2 text-right">BPKal</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {importPreviewData.map((d) => (
                          <tr key={d.id} className={d.matched ? "bg-emerald-50/20" : "bg-red-50/10 text-slate-400"}>
                            <td className="px-4 py-2 font-semibold text-slate-900">{d.nama}</td>
                            <td className="px-4 py-2">{d.kecamatan}</td>
                            <td className="px-4 py-2 text-center">
                              {d.matched ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  ✅ Cocok (Baris {d.rowNum})
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  ⚠️ Tidak Ditemukan
                                </span>
                              )}
                            </td>
                            {mappedColumns.C1 !== -1 && <td className="px-4 py-2 text-right font-medium">{d.matched && d.values[padukuhanCode] != null ? formatInteger(d.values[padukuhanCode]) : "-"}</td>}
                            {mappedColumns.C2 !== -1 && <td className="px-4 py-2 text-right font-medium">{d.matched && d.values[miskinCode] != null ? formatInteger(d.values[miskinCode]) : "-"}</td>}
                            {mappedColumns.C3 !== -1 && <td className="px-4 py-2 text-right font-medium">{d.matched && d.values[luasCode] != null ? formatDecimalDisplay(d.values[luasCode]) : "-"}</td>}
                            {mappedColumns.C4 !== -1 && <td className="px-4 py-2 text-right font-medium">{d.matched && d.values[pendudukCode] != null ? formatInteger(d.values[pendudukCode]) : "-"}</td>}
                            {mappedColumns.C5 !== -1 && <td className="px-4 py-2 text-right font-medium">{d.matched && d.values[geografisCode] != null ? formatDecimalDisplay(d.values[geografisCode]) : "-"}</td>}
                            {mappedColumns.bpkal !== -1 && <td className="px-4 py-2 text-right font-medium">{d.matched && d.jumlah_bpkal != null ? formatInteger(d.jumlah_bpkal) : "-"}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportModalOpen(false);
                        setImportFile(null);
                        setCsvRows([]);
                        setImportPreviewData([]);
                        setUnmatchedRows([]);
                        setIsImportPreviewGenerated(false);
                      }}
                      className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-semibold transition"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveImport}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition inline-flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      Simpan Hasil Impor
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
