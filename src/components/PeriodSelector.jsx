import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatRunLabel, sortRunsByRecent } from "../utils/runLabels";
import { usePeriod } from "../context/PeriodContext";

export default function PeriodSelector({
  value,
  onChange,
  filter,
  allowOnlyActive = false,
  runs = [],
  selectedRun = "",
  onRunChange,
  showRunSelector = false,
  runLabel = "Perhitungan",
  runPlaceholder = "-- Pilih perhitungan --",
}) {
  const { selectedPeriod: globalPeriod, setSelectedPeriod: setGlobalPeriod, periods: globalPeriods } = usePeriod();

  const activeValue = value !== undefined ? value : globalPeriod;
  const activeOnChange = onChange || setGlobalPeriod;

  // Show all periods in dropdown so they can be viewed
  let list = globalPeriods;
  if (filter && typeof filter === 'function') {
    list = list.filter(filter);
  }

  const sortedRuns = useMemo(() => sortRunsByRecent(runs), [runs]);

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <select
        className="border border-gray-300 rounded-xl px-3 py-2 bg-white text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[calc(100vw-5rem)] sm:max-w-none"
        value={activeValue ?? ""}
        onChange={(e) => activeOnChange && activeOnChange(e.target.value)}
      >
        <option value="">-- Pilih periode --</option>
        {list.map(p => {
          const isAct = p.isActive === true || p.active === true;
          const label = `${p.year ?? p.id}${isAct ? ' (Aktif)' : ''}${p.locked ? ' (Terkunci 🔒)' : ''}${p.needs_recalc ? ' (butuh kalkulasi)' : ''}`;
          return (
            <option key={p.id} value={p.id}>{label}</option>
          );
        })}
      </select>

      {showRunSelector && (
        <select
          className="border border-gray-300 rounded-xl px-3 py-2 bg-white text-sm min-w-0 w-full sm:w-auto sm:min-w-[260px] max-w-[calc(100vw-5rem)] sm:max-w-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={selectedRun ?? ""}
          onChange={(e) => onRunChange && onRunChange(e.target.value)}
        >
          <option value="">{runPlaceholder}</option>
          {sortedRuns.length > 0 ? sortedRuns.map((run, index) => (
            <option key={run.runId ?? run.id ?? index} value={run.runId ?? run.id ?? ""}>
              {formatRunLabel(run, index, sortedRuns.length, runLabel)}
            </option>
          )) : (
            <option value="" disabled>Tidak ada {runLabel.toLowerCase()} tersimpan</option>
          )}
        </select>
      )}

      <Link to="/periods" className="text-sm text-blue-600 hover:underline shrink-0">Kelola Periode</Link>
      {allowOnlyActive && list.length === 0 && (
        <div className="text-sm text-gray-500">(Tidak ada periode aktif yang tersedia. Buka "Kelola Periode" untuk mengatur.)</div>
      )}
    </div>
  );
}
