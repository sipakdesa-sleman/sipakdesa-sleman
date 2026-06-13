import { useEffect, useState } from "react";
import { MapPin, ListChecks, Database, CalendarDays } from "lucide-react";
import StatCard from "../components/StatCard";
import UnifiedRankingWidget from "../components/UnifiedRankingWidget";
import { DashboardSkeleton } from "../components/SkeletonLoader";
import {
  PaguDistributionChart,
  AllocationTrendChart,
  KapanewonRankChart,
} from "../components/DashboardCharts";
import { getDashboardData } from "../services/dashboardService";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [villages, setVillages] = useState([]);
  const [ahpMeta, setAhpMeta] = useState(null);

  async function loadData() {
    try {
      const data = await getDashboardData();
      setStats(data.stats);
      setPeriods(data.periods);
      setActivePeriod(data.activePeriod);
      setRanking(data.latestRanking);
      setVillages(data.villages);
      setAhpMeta(data.ahpMeta);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  if (!stats) {
    return (
      <div className="page-shell">
        <DashboardSkeleton />
      </div>
    );
  }


  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Sistem Pendukung Keputusan Prioritas Alokasi Dana Desa Kabupaten Sleman.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Kalurahan Aktif"
          value={stats.totalAlternatives}
          subtitle="Jumlah kalurahan yang terdata dalam sistem"
          leadingIcon={<MapPin size={18} />}
        />
        <StatCard
          title="Total Kriteria"
          value={stats.totalCriteria}
          subtitle="Kriteria penilaian yang digunakan"
          leadingIcon={<ListChecks size={18} />}
        />
        <StatCard
          title="Total Parameter"
          value={stats.totalParameters}
          subtitle="Parameter penilaian tiap kriteria"
          leadingIcon={<Database size={18} />}
        />
        <StatCard
          title="Total Periode"
          value={stats.totalPeriods}
          subtitle="Periode penilaian yang tersimpan"
          leadingIcon={<CalendarDays size={18} />}
        />
      </div>

      {/* Stacked Bar Chart - Pagu Distribution (Full Width) */}
      <PaguDistributionChart activePeriod={activePeriod} />

      {/* Mobile only priority ranking & consistency (shown above charts on mobile) */}
      <div className="block lg:hidden space-y-6 mb-6">
        {ahpMeta && (
          <div className="flex items-center justify-between rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-4 text-sm text-blue-900 shadow-xs">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Konsistensi Bobot AHP</p>
              <p className="font-bold text-slate-800 mt-1">Periode {ahpMeta.period ?? "-"}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold px-2 py-1 bg-sky-200 text-sky-800 rounded-lg">
                CR: {ahpMeta.CR != null ? ahpMeta.CR.toFixed(3) : "-"}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                {ahpMeta.CR != null && ahpMeta.CR < 0.1 ? "✓ Konsisten" : "✗ Tidak Konsisten"}
              </p>
            </div>
          </div>
        )}
        <UnifiedRankingWidget data={ranking} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <KapanewonRankChart latestRanking={ranking} villages={villages} />

          <AllocationTrendChart periods={periods} />

          <div className="panel-indigo p-5">
            <h2 className="text-sm font-semibold text-purple-900 mb-2">Panduan Singkat</h2>
            <ol className="list-decimal list-inside text-xs text-purple-700 space-y-1">
              <li>Tentukan bobot kriteria dengan metode AHP di halaman <strong>Pembobotan Kriteria (AHP)</strong>.</li>
              <li>Jalankan otomasi alokasi earmark pagu di halaman <strong>Alokasi Earmark</strong>.</li>
              <li>Lakukan perhitungan MOORA untuk mendapatkan ranking prioritas kalurahan di halaman <strong>Alokasi Kegiatan (MOORA)</strong>.</li>
              <li>Lihat hasil analisis sebaran kewilayahan makro dan tren tahunan di halaman <strong>Dashboard</strong> ini.</li>
            </ol>
          </div>
        </div>

        {/* Desktop only priority ranking & consistency (hidden on mobile) */}
        <div className="hidden lg:block space-y-6">
          {ahpMeta && (
            <div className="flex items-center justify-between rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-4 text-sm text-blue-900 shadow-xs">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Konsistensi Bobot AHP</p>
                <p className="font-bold text-slate-800 mt-1">Periode {ahpMeta.period ?? "-"}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold px-2 py-1 bg-sky-200 text-sky-800 rounded-lg">
                  CR: {ahpMeta.CR != null ? ahpMeta.CR.toFixed(3) : "-"}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  {ahpMeta.CR != null && ahpMeta.CR < 0.1 ? "✓ Konsisten" : "✗ Tidak Konsisten"}
                </p>
              </div>
            </div>
          )}
          <UnifiedRankingWidget data={ranking} />
        </div>
      </div>
    </div>
  );
}

