import React from "react";

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="h-8 bg-slate-200 rounded-xl w-48"></div>
        <div className="h-4 bg-slate-200 rounded-lg w-96 max-w-full"></div>
      </div>
      
      {/* Info Panel / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="h-24 bg-slate-100 border border-slate-200/60 rounded-2xl"></div>
        <div className="h-24 bg-slate-100 border border-slate-200/60 rounded-2xl"></div>
        <div className="h-24 bg-slate-100 border border-slate-200/60 rounded-2xl"></div>
        <div className="h-24 bg-slate-100 border border-slate-200/60 rounded-2xl"></div>
      </div>

      {/* Main Content Pane */}
      <div className="space-y-4">
        <div className="h-10 bg-slate-200 rounded-xl w-32"></div>
        <div className="h-64 bg-slate-50 border border-slate-200/60 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded-lg w-full"></div>
            <div className="h-4 bg-slate-200 rounded-lg w-5/6"></div>
            <div className="h-4 bg-slate-200 rounded-lg w-4/6"></div>
          </div>
          <div className="h-8 bg-slate-200 rounded-lg w-24 align-self-end"></div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse space-y-4">
      {/* Controls Bar */}
      <div className="flex justify-between items-center gap-4">
        <div className="h-10 bg-slate-200 rounded-xl w-48"></div>
        <div className="h-10 bg-slate-200 rounded-xl w-32"></div>
      </div>
      
      {/* Table Frame */}
      <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white shadow-xs">
        {/* Table Head */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-200 rounded-md flex-1"></div>
          ))}
        </div>
        
        {/* Table Body */}
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="px-6 py-4.5 flex gap-4">
              {Array.from({ length: cols }).map((_, c) => (
                <div key={c} className="h-4 bg-slate-100 rounded-md flex-1"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse border border-slate-200/60 rounded-2xl p-6 bg-white space-y-4">
      <div className="h-6 bg-slate-200 rounded-md w-1/3"></div>
      <div className="space-y-3">
        <div className="h-4 bg-slate-100 rounded-md w-full"></div>
        <div className="h-4 bg-slate-100 rounded-md w-11/12"></div>
        <div className="h-4 bg-slate-100 rounded-md w-2/3"></div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 bg-slate-200 rounded-xl w-48"></div>
        <div className="h-4 bg-slate-200 rounded-lg w-96 max-w-full"></div>
      </div>
      
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-white border border-slate-200/60 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="h-4 bg-slate-200 rounded-md w-24"></div>
              <div className="w-8 h-8 rounded-lg bg-slate-200"></div>
            </div>
            <div className="h-8 bg-slate-200 rounded-lg w-12"></div>
          </div>
        ))}
      </div>

      {/* Main Chart Card */}
      <div className="h-80 bg-white border border-slate-200/60 rounded-2xl p-6 flex flex-col justify-between">
        <div className="h-6 bg-slate-200 rounded-md w-36"></div>
        <div className="h-48 bg-slate-100 rounded-xl w-full"></div>
      </div>

      {/* Bottom Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-80 bg-white border border-slate-200/60 rounded-2xl p-6 flex flex-col justify-between">
            <div className="h-6 bg-slate-200 rounded-md w-48"></div>
            <div className="h-48 bg-slate-100 rounded-xl w-full"></div>
          </div>
          <div className="h-32 bg-slate-50 border border-slate-200/60 rounded-2xl"></div>
        </div>
        <div className="h-80 bg-white border border-slate-200/60 rounded-2xl"></div>
      </div>
    </div>
  );
}
