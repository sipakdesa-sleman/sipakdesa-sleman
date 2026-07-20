import React from "react";
import { X, CheckCircle2, AlertTriangle } from "lucide-react";

export default function AlertToast({ toasts, onClose }) {
  const cleanMessage = (msg) => {
    if (typeof msg !== "string") return msg;
    const emojis = ["❌", "✅", "⚠️", "⚡", "💡"];
    let clean = msg;
    for (const e of emojis) {
      if (clean.startsWith(e)) {
        clean = clean.slice(e.length).trim();
        break;
      }
    }
    return clean;
  };

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`max-w-sm px-4 py-3 rounded shadow-lg flex items-start gap-3 ${t.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          <div className="flex-shrink-0 mt-0.5">
            {t.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div className="flex-1">
            <div className="text-sm whitespace-pre-line">{cleanMessage(t.message)}</div>
          </div>
          <button aria-label="close" onClick={() => onClose(t.id)} className="ml-2 text-xs opacity-90 p-1 rounded hover:bg-white/10">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
