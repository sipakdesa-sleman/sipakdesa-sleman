import React, { useState } from "react";
import { Info, HelpCircle } from "lucide-react";

// Format currency helpers
function formatRpFull(val) {
  if (val == null || isNaN(val)) return "Rp 0";
  return "Rp " + new Intl.NumberFormat("id-ID").format(val);
}

function formatRpCompact(val) {
  if (val == null || isNaN(val)) return "Rp 0";
  if (val >= 1e9) {
    return (val / 1e9).toFixed(2).replace(".", ",") + " Miliar";
  }
  if (val >= 1e6) {
    return (val / 1e6).toFixed(2).replace(".", ",") + " Juta";
  }
  return "Rp " + new Intl.NumberFormat("id-ID").format(val);
}

// 1. Stacked Bar Chart: Pagu Distribution
export function PaguDistributionChart({ activePeriod }) {
  if (!activePeriod || !activePeriod.praKalkulasiDone || !activePeriod.praKalkulasiResult) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
        <HelpCircle className="mx-auto text-slate-300 mb-2" size={32} />
        <p className="text-sm font-medium">Data Pagu Utama Belum Tersedia</p>
        <p className="text-xs text-slate-400 mt-1">Lakukan proses Pra-Kalkulasi terlebih dahulu pada periode aktif.</p>
      </div>
    );
  }

  const result = activePeriod.praKalkulasiResult;
  const summary = result.summary || {};
  const addKew = result.addKew || 0;

  // Breakdown values
  const siltap = Number(summary.addSil || 0);
  const kesehatan = Number(summary.addKes || 0);
  const ketenagakerjaan = Number(summary.addKer || 0);
  const kebijakan = Number(summary.addKeb || 0);
  const kewenangan = Number(summary.addBPKal || 0) + Number(addKew || 0);
  const total = siltap + kesehatan + ketenagakerjaan + kebijakan + kewenangan;

  if (total <= 0) return null;

  // Calculate percentages
  const pctSiltap = (siltap / total) * 100;
  const pctKesehatan = (kesehatan / total) * 100;
  const pctKetenagakerjaan = (ketenagakerjaan / total) * 100;
  const pctKebijakan = (kebijakan / total) * 100;
  const pctKewenangan = (kewenangan / total) * 100;

  const segments = [
    { label: "ADD Siltap (ADDSil)", val: siltap, pct: pctSiltap, color: "bg-[#10b981]", hoverColor: "hover:bg-[#059669]", hex: "#10b981" },
    { label: "ADD Kesehatan (ADDKes)", val: kesehatan, pct: pctKesehatan, color: "bg-[#06b6d4]", hoverColor: "hover:bg-[#0891b2]", hex: "#06b6d4" },
    { label: "ADD Ketenagakerjaan (ADDKer)", val: ketenagakerjaan, pct: pctKetenagakerjaan, color: "bg-[#f59e0b]", hoverColor: "hover:bg-[#d97706]", hex: "#f59e0b" },
    { label: "ADD Kebijakan (ADDKeb)", val: kebijakan, pct: pctKebijakan, color: "bg-[#6366f1]", hoverColor: "hover:bg-[#4f46e5]", hex: "#6366f1" },
    { label: "ADD Kewenangan (BPKal + Kegiatan)", val: kewenangan, pct: pctKewenangan, color: "bg-[#3b82f6]", hoverColor: "hover:bg-[#2563eb]", hex: "#3b82f6" },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            Distribusi ADD Kabupaten Sleman
            <span className="text-xs bg-[#1a2847]/10 text-[#1a2847] px-2 py-0.5 rounded font-semibold">
              Periode {activePeriod.year ?? activePeriod.id}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
            <span>Visualisasi instan pembagian dana earmark sebelum algoritma MOORA bekerja (Pagu Induk:</span>
            <span className="bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded-md text-[11px] inline-block shadow-xs border border-yellow-200">{formatRpCompact(total)}</span>
            <span>)</span>
          </p>
        </div>
      </div>

      {/* Horizontal Stacked Bar */}
      <div className="w-full bg-slate-100 rounded-2xl h-10 flex shadow-inner border border-slate-200/50 p-1">
        {segments.map((seg, idx) => {
          if (seg.val <= 0) return null;
          return (
            <div
              key={idx}
              className={`h-full first:rounded-l-xl last:rounded-r-xl ${seg.color} ${seg.hoverColor} transition-all duration-300 relative group flex items-center justify-center cursor-pointer`}
              style={{ width: `${seg.pct}%` }}
            >
              {seg.pct > 8 && (
                <span className="text-[10px] font-bold text-white tracking-wider">
                  {seg.pct.toFixed(1)}%
                </span>
              )}
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 bg-slate-950 text-white text-xs rounded-xl p-3 shadow-xl w-64 pointer-events-none transition-opacity">
                <p className="font-bold border-b border-white/20 pb-1 mb-1">{seg.label}</p>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-300">Nominal:</span>
                  <span className="font-semibold">{formatRpFull(seg.val)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Proporsi:</span>
                  <span className="font-semibold">{seg.pct.toFixed(2)}%</span>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-950"></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6 border-t border-slate-100 pt-5">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex gap-3 items-start bg-slate-50 rounded-2xl p-3 border border-slate-100">
            <span className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 ${seg.color}`} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 truncate" title={seg.label}>
                {seg.label}
              </p>
              <p className="text-sm font-bold text-slate-800 mt-1">
                {formatRpCompact(seg.val)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {seg.pct.toFixed(2)}% dari total pagu
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. Line Chart: Annual Allocation Trend
export function AllocationTrendChart({ periods = [] }) {
  const [activePoint, setActivePoint] = useState(null);

  // Filter and sort periods with kalkulasi results
  const chartData = periods
    .filter((p) => p.praKalkulasiDone && p.praKalkulasiResult)
    .map((p) => {
      const summary = p.praKalkulasiResult.summary || {};
      const addKew = p.praKalkulasiResult.addKew || 0;
      const totalPotonganWajib = summary.totalPotonganWajib || 0;

      // County total pagu
      const pagu = Number(p.pagu_total_kab ?? p.paguKab ?? (totalPotonganWajib + addKew));
      // Accumulation of Alokasi Dasar
      const alokasiDasar = Number(totalPotonganWajib);

      return {
        id: p.id,
        year: p.year ?? p.id,
        pagu,
        alokasiDasar,
      };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
        <HelpCircle className="mx-auto text-slate-300 mb-2" size={32} />
        <p className="text-sm font-medium">Data Tren Tahunan Belum Tersedia</p>
        <p className="text-xs text-slate-400 mt-1">Butuh minimal 1 periode dengan hasil Pra-Kalkulasi tersimpan.</p>
      </div>
    );
  }

  // Dimension settings
  const width = 600;
  const height = 300;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 45;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Max value of pagu or alokasi dasar to scale Y axis
  const maxVal = Math.max(...chartData.map((d) => Math.max(d.pagu, d.alokasiDasar))) * 1.1; // 10% padding

  // X mappings
  const getX = (index) => {
    if (chartData.length <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (chartData.length - 1)) * plotWidth;
  };

  // Y mappings
  const getY = (val) => {
    return height - paddingBottom - (val / maxVal) * plotHeight;
  };

  // Line paths
  let paguPath = "";
  let alokasiPath = "";

  chartData.forEach((d, idx) => {
    const x = getX(idx);
    const yPagu = getY(d.pagu);
    const yAlokasi = getY(d.alokasiDasar);

    if (idx === 0) {
      paguPath = `M ${x} ${yPagu}`;
      alokasiPath = `M ${x} ${yAlokasi}`;
    } else {
      paguPath += ` L ${x} ${yPagu}`;
      alokasiPath += ` L ${x} ${yAlokasi}`;
    }
  });

  // Calculate ticks
  const yTicksCount = 4;
  const yTicks = Array.from({ length: yTicksCount + 1 }).map((_, i) => (maxVal / yTicksCount) * i);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md relative">
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
          Tren Alokasi Anggaran Tahunan
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Perbandingan Pagu Total Kabupaten (ADD Kab) vs. Akumulasi Alokasi Dasar (∑ ADk) untuk melihat porsi anggaran belanja kaku pegawai kalurahan
        </p>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Y Axis Grid lines & Ticks */}
          {yTicks.map((tick, idx) => {
            const y = getY(tick);
            return (
              <g key={`ytick-${idx}`} className="opacity-60">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px] font-bold font-mono"
                >
                  {formatRpCompact(tick)}
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {chartData.map((d, idx) => {
            const x = getX(idx);
            return (
              <g key={`xtick-${idx}`}>
                <line
                  x1={x}
                  y1={height - paddingBottom}
                  x2={x}
                  y2={height - paddingBottom + 5}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={height - paddingBottom + 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-bold"
                >
                  {d.year}
                </text>
              </g>
            );
          })}

          {/* Sumbu X line */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />

          {/* Line: Pagu Total Kabupaten */}
          {chartData.length > 0 && (
            <path
              d={paguPath}
              fill="none"
              stroke="#1a2847"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Line: Akumulasi Alokasi Dasar */}
          {chartData.length > 0 && (
            <path
              d={alokasiPath}
              fill="none"
              stroke="#10b981"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points overlay & mouse targets */}
          {chartData.map((d, idx) => {
            const x = getX(idx);
            const yPagu = getY(d.pagu);
            const yAlokasi = getY(d.alokasiDasar);

            return (
              <g key={`points-${idx}`}>
                {/* Points for Pagu Total */}
                <circle
                  cx={x}
                  cy={yPagu}
                  r={5}
                  fill="#ffffff"
                  stroke="#1a2847"
                  strokeWidth={2.5}
                />
                {/* Points for Alokasi Dasar */}
                <circle
                  cx={x}
                  cy={yAlokasi}
                  r={5}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth={2.5}
                />

                {/* Hover hot zone */}
                <rect
                  x={x - 20}
                  y={paddingTop}
                  width={40}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActivePoint({ index: idx, x, y: yPagu, data: d })}
                  onMouseLeave={() => setActivePoint(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip overlay */}
        {activePoint && (
          <div
            className="absolute z-25 bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none w-56 border border-slate-800 transition-all duration-150 animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: activePoint.y < 100
                ? `${(activePoint.y / height) * 100 + 5}%`
                : `${(activePoint.y / height) * 100 - 35}%`,
              transform: activePoint.y < 100 ? "translate(-50%, 0%)" : "translate(-50%, -100%)",
            }}
          >
            <p className="font-bold text-[11px] uppercase tracking-wider text-slate-300 border-b border-slate-700/60 pb-1 mb-1.5">
              Periode {activePoint.data.year}
            </p>
            <div className="flex justify-between items-center py-0.5">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1a2847] border border-white/20 shrink-0" />
                Pagu Kab:
              </span>
              <span className="font-bold text-white">{formatRpCompact(activePoint.data.pagu)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" />
                Alokasi Dasar:
              </span>
              <span className="font-bold text-[#10b981]">{formatRpCompact(activePoint.data.alokasiDasar)}</span>
            </div>
            <div className="text-[10px] text-slate-400 text-center mt-2 pt-1 border-t border-slate-700/60 font-medium">
              Sisa formula: {formatRpCompact(activePoint.data.pagu - activePoint.data.alokasiDasar)}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="w-3.5 h-1.5 bg-[#1a2847] rounded-full shrink-0" />
          <span>Pagu Total Kabupaten (ADD Kab)</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="w-3.5 h-1.5 bg-[#10b981] rounded-full shrink-0" />
          <span>Akumulasi Alokasi Dasar (∑ ADk)</span>
        </div>
      </div>
    </div>
  );
}

// 3. Grouped Bar Chart: Rank Distribution per Kapanewon
export function KapanewonRankChart({ latestRanking = [], villages = [] }) {
  const [hoverBar, setHoverBar] = useState(null);

  // Group top 20 rankings by kecamatan
  const top20 = latestRanking.filter((item) => item.rank <= 20);

  // Map village id/name to its kecamatan
  const villageMap = new Map();
  villages.forEach((v) => {
    villageMap.set(String(v.id).trim().toLowerCase(), v.kecamatan);
    if (v.name) villageMap.set(String(v.name).trim().toLowerCase(), v.kecamatan);
  });

  const kecamatanCounts = {};

  top20.forEach((item) => {
    // try matching by alternativeId, name, or key
    const rawKey = item.alternativeId ?? item.id ?? item.name ?? "";
    const key = String(rawKey).trim().toLowerCase();
    
    let kec = villageMap.get(key) || item.kecamatan;

    // Fallback if still not resolved: search villages list for match
    if (!kec) {
      const match = villages.find(
        (v) =>
          v.id === item.alternativeId ||
          String(v.name).toLowerCase() === String(item.name).toLowerCase()
      );
      kec = match?.kecamatan || "Tidak Teridentifikasi";
    }

    if (kec) {
      const cleanKec = kec.trim();
      kecamatanCounts[cleanKec] = (kecamatanCounts[cleanKec] || 0) + 1;
    }
  });

  // Convert to chart data array and sort by count (descending) then alphabetically
  const chartData = Object.entries(kecamatanCounts)
    .map(([kecamatan, count]) => ({
      kecamatan,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.kecamatan.localeCompare(b.kecamatan));

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
        <HelpCircle className="mx-auto text-slate-300 mb-2" size={32} />
        <p className="text-sm font-medium">Sebaran Kapanewon Belum Tersedia</p>
        <p className="text-xs text-slate-400 mt-1">Lakukan proses perhitungan MOORA terlebih dahulu untuk mendapatkan data prioritas.</p>
      </div>
    );
  }

  // Dimension settings
  const width = 600;
  const height = 300;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 60; // Extra room for slanted text labels

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxCount = Math.max(...chartData.map((d) => d.count), 4); // default minimum Y grid height is 4

  // Helper for coordinates
  const getX = (index) => {
    const sectionWidth = plotWidth / chartData.length;
    return paddingLeft + index * sectionWidth + sectionWidth / 2;
  };

  const getY = (count) => {
    return height - paddingBottom - (count / maxCount) * plotHeight;
  };

  const getBarHeight = (count) => {
    return (count / maxCount) * plotHeight;
  };

  // Generate integer ticks for counts
  const yTicks = Array.from({ length: maxCount + 1 }).map((_, i) => i).filter((tick) => tick % Math.ceil(maxCount / 5) === 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md relative">
      <div className="mb-4">
        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
          Sebaran Prioritas per Kapanewon (Top 20 MOORA)
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Jumlah kalurahan di setiap Kecamatan/Kapanewon yang masuk dalam kategori "Prioritas Tinggi" (20 besar nilai Yi MOORA)
        </p>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Y Axis Grid lines */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={`ytick-${tick}`} className="opacity-60">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-bold font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Sumbu X line */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />

          {/* Bars */}
          {chartData.map((d, idx) => {
            const x = getX(idx);
            const sectionWidth = plotWidth / chartData.length;
            const barWidth = Math.min(32, sectionWidth * 0.55);
            const y = getY(d.count);
            const barHeight = getBarHeight(d.count);

            return (
              <g key={`bar-${idx}`}>
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill="url(#barGradient)"
                  className="transition-all duration-300 cursor-pointer hover:opacity-90"
                  onMouseEnter={() => setHoverBar({ index: idx, x, y, data: d })}
                  onMouseLeave={() => setHoverBar(null)}
                />
                
                {/* Slanted X Axis Label */}
                <text
                  x={x}
                  y={height - paddingBottom + 16}
                  transform={`rotate(-25, ${x}, ${height - paddingBottom + 16})`}
                  textAnchor="end"
                  className="fill-slate-600 text-[9px] font-bold"
                >
                  {d.kecamatan}
                </text>
              </g>
            );
          })}

          {/* SVG Gradients definitions */}
          <defs>
            <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
          </defs>
        </svg>

        {/* Hover Tooltip overlay */}
        {hoverBar && (
          <div
            className="absolute z-25 bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none w-48 border border-slate-800 transition-all duration-150 text-center animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${(hoverBar.x / width) * 100}%`,
              top: hoverBar.y < 100
                ? `${(hoverBar.y / height) * 100 + 5}%`
                : `${(hoverBar.y / height) * 100 - 5}%`,
              transform: hoverBar.y < 100 ? "translate(-50%, 0%)" : "translate(-50%, -100%)",
            }}
          >
            <p className="font-bold text-[11px] uppercase tracking-wider text-slate-300 border-b border-slate-700/60 pb-1 mb-1.5 truncate">
              Kapanewon {hoverBar.data.kecamatan}
            </p>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Kalurahan Prioritas:</span>
              <span className="font-bold text-blue-400 text-sm">{hoverBar.data.count} Kalurahan</span>
            </div>
            {hoverBar.y < 100 ? (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-slate-900"></div>
            ) : (
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900"></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
