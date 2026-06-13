import React from "react";
import { AlertTriangle, CircleCheckBig, Info, ShieldAlert, X } from "lucide-react";

const variantConfig = {
  danger: {
    panel: "border-rose-200 bg-white",
    accent: "bg-rose-600",
    iconWrap: "bg-rose-100 text-rose-700",
    title: "text-rose-950",
    message: "text-slate-700",
    confirm: "bg-rose-600 text-white hover:bg-rose-700",
  },
  warning: {
    panel: "border-amber-200 bg-white",
    accent: "bg-amber-500",
    iconWrap: "bg-amber-100 text-amber-700",
    title: "text-slate-900",
    message: "text-slate-600",
    confirm: "bg-amber-500 text-white hover:bg-amber-600",
  },
  primary: {
    panel: "border-sky-200 bg-white",
    accent: "bg-[#1a2847]",
    iconWrap: "bg-sky-100 text-[#1a2847]",
    title: "text-slate-900",
    message: "text-slate-600",
    confirm: "bg-[#1a2847] text-white hover:bg-[#14213a]",
  },
  info: {
    panel: "border-sky-200 bg-white",
    accent: "bg-sky-500",
    iconWrap: "bg-sky-100 text-sky-700",
    title: "text-slate-900",
    message: "text-slate-600",
    confirm: "bg-sky-500 text-white hover:bg-sky-600",
  },
};

function resolveVariant({ variant, title, message, confirmLabel }) {
  if (variant && variantConfig[variant]) return variant;

  const text = `${title ?? ""} ${message ?? ""} ${confirmLabel ?? ""}`.toLowerCase();
  if (/hapus|delete|remove|destroy|force/.test(text)) return "danger";
  if (/kunci|lock|final|recalc|clear/.test(text)) return "warning";
  if (/simpan|save|submit|confirm|set active|aktif/.test(text)) return "primary";
  return "info";
}

export default function ConfirmDialog({ open, title, message, onCancel, onConfirm, confirmLabel = "OK", cancelLabel = "Batal", variant }) {
  if (!open) return null;

  const activeVariant = resolveVariant({ variant, title, message, confirmLabel });
  const ui = variantConfig[activeVariant] ?? variantConfig.info;

  const Icon = activeVariant === "danger" ? AlertTriangle : activeVariant === "warning" ? ShieldAlert : activeVariant === "primary" ? CircleCheckBig : Info;
  const isDanger = activeVariant === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border shadow-2xl sm:max-w-lg ${ui.panel}`}>
        <div className={`h-1.5 w-full ${ui.accent}`} />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ui.iconWrap}`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1 pr-2">
              {title && <h3 className={`text-lg sm:text-xl font-semibold tracking-tight ${ui.title}`}>{title}</h3>}
              <p className={`mt-2 text-sm leading-6 ${ui.message}`}>{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="close"
            >
              <X size={18} />
            </button>
          </div>

          <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${isDanger ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            <span className="font-medium text-slate-900">Catatan:</span>{" "}
            {isDanger ? "Data akan dihapus permanen dan tidak bisa dipulihkan." : "Tindakan ini akan langsung dijalankan setelah Anda menekan tombol konfirmasi."}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={onCancel}
              className="btn-secondary w-full sm:w-auto"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition sm:w-auto ${ui.confirm}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
