'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('HYDRO MATRIX Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-8 max-w-lg shadow-2xl backdrop-blur-md">
        <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-5 text-cyan-400">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold tracking-wide text-slate-100 mb-2 font-mono">
          HYDRO MATRIX COMMAND RECOVERY
        </h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {error?.message || 'A client session anomaly occurred. Telemetry state has been preserved.'}
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-cyan-500/20"
        >
          <RotateCcw className="w-4 h-4" />
          Reconnect Command Center
        </button>
      </div>
    </div>
  );
}