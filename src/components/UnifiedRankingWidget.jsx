import React from "react";
import { Trophy, Award, TrendingUp } from "lucide-react";

export default function UnifiedRankingWidget({ data = [] }) {
  console.log("UnifiedRankingWidget received data:", data);

  const top5 = data.slice(0, 5);
  const maxYi = top5.length ? Math.max(...top5.map((d) => d.yi ?? 0)) : 1;

  function formatRp(val) {
    if (val == null || isNaN(val)) return "-";
    return "Rp " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  }

  // Helper for rank badges
  const getRankStyle = (rank) => {
    switch (rank) {
      case 1:
        return {
          bg: "bg-amber-500",
          text: "text-white",
          border: "border-amber-600",
          glow: "shadow-amber-500/20",
          icon: <Trophy size={14} className="text-amber-100" />
        };
      case 2:
        return {
          bg: "bg-slate-400",
          text: "text-white",
          border: "border-slate-500",
          glow: "shadow-slate-400/20",
          icon: <Award size={14} className="text-slate-100" />
        };
      case 3:
        return {
          bg: "bg-amber-700",
          text: "text-white",
          border: "border-amber-800",
          glow: "shadow-amber-700/20",
          icon: <Award size={14} className="text-amber-200" />
        };
      default:
        return {
          bg: "bg-slate-100",
          text: "text-slate-600",
          border: "border-slate-200",
          glow: "shadow-transparent",
          icon: null
        };
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <TrendingUp size={20} className="text-[#1a2847]" />
            Peringkat Prioritas Kalurahan (Top 5)
          </h3>
          <p className="text-xs text-slate-400 mt-1">Hasil kalkulasi bobot AHP & ranking MOORA akhir</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-full border border-slate-200">
          MOORA
        </span>
      </div>

      {top5.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-slate-300 text-sm font-medium">Belum ada hasil perhitungan MOORA.</p>
          <p className="text-xs text-slate-400 mt-1">Selesaikan kalkulasi MOORA di menu Perhitungan MOORA.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {top5.map((item, index) => {
            const rank = item.rank ?? (index + 1);
            const name = item.name ?? item.desa ?? "";
            const yi = typeof item.yi === "number" ? item.yi : 0;
            const barWidth = maxYi > 0 ? (yi / maxYi) * 100 : 0;
            const rankStyle = getRankStyle(rank);

            return (
              <div
                key={item.id ?? index}
                className="group relative flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-white hover:border-slate-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold shadow-sm ${rankStyle.bg} ${rankStyle.text} ${rankStyle.glow}`}
                    >
                      {rank}
                    </span>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-900 transition-colors">
                        {name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-slate-500">
                          Nilai Yi: <span className="font-semibold text-slate-700">{yi.toFixed(4)}</span>
                        </span>
                        {item.nominal && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-medium text-emerald-600">
                              Pagu: {formatRp(item.nominal)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {rankStyle.icon && (
                    <div className={`hidden sm:flex h-6 w-6 items-center justify-center rounded-full ${rankStyle.bg} text-white`}>
                      {rankStyle.icon}
                    </div>
                  )}
                </div>

                {/* Unified Progress Bar */}
                <div className="mt-2 w-full bg-slate-100 rounded-full h-3.5 relative overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ease-out group-hover:from-blue-700 group-hover:to-indigo-700"
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end pr-2.5">
                    <span className="text-[9px] font-bold text-slate-700 select-none bg-white/70 px-1.5 py-0.5 rounded-full shadow-xs">
                      {barWidth.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
