function getRunTimeValue(run = {}) {
  const value = run.createdAt ?? run.created_at ?? run.timestamp ?? null;
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000 + (value.nanoseconds ?? 0) / 1e6;
  }
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

export function sortRunsByRecent(runs = []) {
  return [...runs].sort((a, b) => getRunTimeValue(b) - getRunTimeValue(a));
}

export function formatRunLabel(run = {}, index = 0, total = 0, prefix = "Perhitungan") {
  const number = total > 0 ? total - index : index + 1;
  const timeValue = getRunTimeValue(run);
  const timestamp = timeValue ? new Date(timeValue).toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  }) : "tanpa waktu";
  return `${prefix} #${number} • ${timestamp}`;
}
