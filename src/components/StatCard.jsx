export default function StatCard({ title, value, subtitle, leadingIcon, isDanger }) {
  const palette = [
    "from-[#1a2847] to-[#234166]",
    "from-[#1e3559] to-[#2a4a7c]",
    "from-[#234166] to-[#2d5278]",
    "from-[#1a2847] to-[#1e3559]",
  ];
  const key = (title || "stat").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const gradient = isDanger
    ? "from-[#881337] to-[#9f1239] border-rose-500 shadow-rose-900/10"
    : palette[key % palette.length];

  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl shadow-lg p-4 flex flex-col gap-2 text-white border border-white/20`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide uppercase text-white/80">
            {title}
          </p>
        </div>
        {leadingIcon && (
          <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center text-lg">
            {leadingIcon}
          </div>
        )}
      </div>

      <div className="text-2xl font-semibold">
        {value ?? "-"}
      </div>

      {subtitle && (
        <p className="text-xs text-white/80 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
