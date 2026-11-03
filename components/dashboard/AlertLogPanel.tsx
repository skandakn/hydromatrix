/**
 * HYDRO MATRIX: Early Warning Log & Data Export
 *
 * Two operator-facing capabilities that the dashboard previously lacked:
 *
 * 1. A chronological record of every sector escalation during the run. The
 *    existing watchlist answers "what is at risk now"; this answers "what went
 *    wrong, and when" - the question an after-action review asks.
 * 2. Export of the run to CSV, so the telemetry series and the event log can be
 *    taken into a spreadsheet or report instead of being read off a chart.
 */

'use client';

import React from 'react';
import { useFloodSimulation } from '@/hooks/useFloodSimulation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Download, Trash2, AlertOctagon, AlertTriangle } from 'lucide-react';
import {
  buildTelemetryCsv,
  buildAlertEventCsv,
  downloadCsv,
  exportTimestamp,
} from '@/lib/export/csv';

export const AlertLogPanel: React.FC = () => {
  const alertEvents = useFloodSimulation(s => s.alertEvents);
  const telemetryHistory = useFloodSimulation(s => s.telemetryHistory);
  const clearAlertEvents = useFloodSimulation(s => s.clearAlertEvents);

  // Newest first: during a crisis the latest escalation is the one that matters.
  const orderedEvents = [...alertEvents].reverse();
  const criticalCount = alertEvents.filter(e => e.level === 'CRITICAL').length;

  const handleExportTelemetry = () => {
    downloadCsv(
      `hydromatrix_telemetry_${exportTimestamp()}.csv`,
      buildTelemetryCsv(telemetryHistory),
    );
  };

  const handleExportEvents = () => {
    downloadCsv(
      `hydromatrix_alert_log_${exportTimestamp()}.csv`,
      buildAlertEventCsv(alertEvents),
    );
  };

  return (
    <div className="space-y-2.5 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
          <History className="h-3.5 w-3.5 text-cyan-400" />
          Early Warning Log
        </h3>
        <Badge variant={criticalCount > 0 ? 'critical' : 'outline'} className="text-[9px]">
          {alertEvents.length} {alertEvents.length === 1 ? 'EVENT' : 'EVENTS'}
        </Badge>
      </div>

      {/* ── Event list ──────────────────────────────────────────────────────── */}
      {orderedEvents.length === 0 ? (
        <p className="py-3 text-center text-[11px] leading-relaxed text-slate-500">
          No escalations recorded yet.
          <br />
          Step the simulation forward to begin logging.
        </p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {orderedEvents.map(event => {
            const isCritical = event.level === 'CRITICAL';
            return (
              <div
                key={event.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
                  isCritical
                    ? 'border-rose-500/40 bg-rose-950/20'
                    : 'border-amber-500/40 bg-amber-950/20'
                }`}
              >
                {isCritical ? (
                  <AlertOctagon className="h-3 w-3 shrink-0 text-rose-400" />
                ) : (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
                )}

                <span className="shrink-0 font-mono text-[10px] text-slate-400">
                  {event.timeLabel}
                </span>

                <span className="min-w-0 flex-1 truncate font-semibold text-slate-200">
                  {event.sectorName}
                </span>

                <span
                  className={`shrink-0 font-mono text-[10px] font-bold ${
                    isCritical ? 'text-rose-300' : 'text-amber-300'
                  }`}
                >
                  {event.waterDepthMeters.toFixed(2)} m
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Export & maintenance ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-2.5">
        <Button
          size="sm"
          variant="cyan"
          onClick={handleExportTelemetry}
          disabled={telemetryHistory.length === 0}
          className="h-6 flex-1 px-2 text-[10px]"
          title="Download the simulation telemetry time-series as a CSV file"
        >
          <Download className="mr-1 h-3 w-3" />
          Telemetry CSV
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleExportEvents}
          disabled={alertEvents.length === 0}
          className="h-6 flex-1 px-2 text-[10px]"
          title="Download the early warning event log as a CSV file"
        >
          <Download className="mr-1 h-3 w-3" />
          Event Log CSV
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={clearAlertEvents}
          disabled={alertEvents.length === 0}
          className="h-6 px-2 text-[10px]"
          title="Clear the recorded early warning events"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
