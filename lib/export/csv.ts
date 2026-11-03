/**
 * HYDRO MATRIX: Simulation Data Export
 *
 * Serialises the accumulated simulation record to CSV so an operator can take
 * the run out of the browser and into a spreadsheet or report. Two datasets are
 * supported:
 *
 * 1. Telemetry history - one row per 6-hour simulation interval, carrying the
 *    flood metrics plotted on the dashboard charts.
 * 2. Early warning event log - one row per sector escalation recorded during
 *    the run.
 *
 * Export is performed entirely client-side; no simulation data leaves the
 * browser.
 */

'use client';

import { TelemetryPoint, AlertEvent } from '@/types/simulation';

/**
 * Quote a single CSV field. A field is wrapped in double quotes whenever it
 * contains a comma, quote or newline, and embedded quotes are doubled, per
 * RFC 4180. Sector names such as "Anil Nagar, Zone 3" would otherwise split
 * across columns.
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Join a header row and body rows into a CSV document. */
function toCsvDocument(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(escapeCsvField).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','));
  }
  return lines.join('\r\n');
}

/**
 * Build the telemetry time-series CSV: one row per recorded simulation
 * interval.
 */
export function buildTelemetryCsv(points: TelemetryPoint[]): string {
  return toCsvDocument(
    [
      'time_label',
      'elapsed_hours',
      'flooded_area_sq_km',
      'affected_population',
      'critical_zones',
      'warning_zones',
      'max_water_depth_m',
      'drainage_efficiency_pct',
      'bharalu_flow_m3_per_s',
      'active_pumps',
    ],
    points.map(p => [
      p.timeLabel,
      Math.round(p.elapsedMinutes / 60),
      p.floodedAreaSqKm,
      p.affectedPopulation,
      p.criticalZones,
      p.warningZones,
      p.maxWaterDepth,
      p.avgDrainageEfficiency,
      p.bahiniBharaluFlowM3S ?? '',
      p.activePumpsCount ?? '',
    ]),
  );
}

/**
 * Build the early warning event log CSV: one row per recorded sector
 * escalation.
 */
export function buildAlertEventCsv(events: AlertEvent[]): string {
  return toCsvDocument(
    ['time_label', 'elapsed_hours', 'alert_level', 'sector_name', 'cell_id', 'water_depth_m'],
    events.map(e => [
      e.timeLabel,
      e.elapsedHours,
      e.level,
      e.sectorName,
      e.cellId,
      e.waterDepthMeters,
    ]),
  );
}

/**
 * Offer a CSV document to the user as a file download.
 *
 * A UTF-8 byte order mark is prepended so that Excel opens the file in UTF-8
 * rather than the system codepage, which would otherwise mangle the Assamese
 * and Bengali sector names. The object URL is revoked once the click has been
 * dispatched so the blob is not retained for the lifetime of the page.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Timestamp suffix (YYYYMMDD-HHMM) so repeated exports do not collide. */
export function exportTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}
