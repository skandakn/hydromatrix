/**
 * HYDRO MATRIX: Flood Response Drill Mode
 *
 * A training surface separate from the live command centre. The operator picks a
 * historical storm and decides which sectors to shield with a limited number of
 * flood barriers. The placement is then scored against an identical run of the
 * same storm with no barriers placed.
 *
 * All simulation here runs on a private grid copy through the same physics
 * engine as the dashboard, so a drill never disturbs the live run.
 */

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DRILL_SCENARIOS,
  DrillScenario,
  DrillRunResult,
  DrillScore,
  runDrillSimulation,
  runDrillBaseline,
  scoreDrill,
} from '@/lib/drill/drills';
import { generateCityGrid2D, GRID_WIDTH, GRID_HEIGHT } from '@/lib/simulation-engine/cityGrid';
import {
  ArrowLeft,
  Shield,
  Play,
  RotateCcw,
  Trophy,
  AlertTriangle,
  Droplets,
  Users,
  Target,
  Ban,
} from 'lucide-react';

/** Static grid used for the placement board; never simulated directly. */
const BOARD = generateCityGrid2D();

export default function DrillPage() {
  const [scenario, setScenario] = useState<DrillScenario>(DRILL_SCENARIOS[0]);
  const [barriers, setBarriers] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState<DrillRunResult | null>(null);
  const [score, setScore] = useState<DrillScore | null>(null);

  const barriersLeft = scenario.barrierBudget - barriers.size;
  const hasRun = attempt !== null;

  /** Water depth per cell after the run, for post-drill shading. */
  const depthByCell = useMemo(() => {
    if (!attempt) return null;
    const map = new Map<string, number>();
    for (const cell of attempt.finalGrid) map.set(cell.id, cell.waterDepth);
    return map;
  }, [attempt]);

  const resetAttempt = (next: DrillScenario = scenario) => {
    setScenario(next);
    setBarriers(new Set());
    setAttempt(null);
    setScore(null);
  };

  const toggleBarrier = (cellId: string) => {
    if (hasRun) return;
    setBarriers(prev => {
      const next = new Set(prev);
      if (next.has(cellId)) {
        next.delete(cellId);
      } else if (next.size < scenario.barrierBudget) {
        next.add(cellId);
      }
      return next;
    });
  };

  const runDrill = () => {
    const baseline = runDrillBaseline(scenario);
    const result = runDrillSimulation(scenario, barriers);
    setAttempt(result);
    setScore(scoreDrill(scenario, baseline, result, barriers));
  };

  return (
    // The root layout sets overflow-hidden on <body> for the fixed-viewport
    // dashboard, so this page needs to own its scrolling rather than relying on
    // the document scrollbar.
    <main className="h-screen w-full overflow-y-auto overflow-x-hidden bg-slate-950 font-sans text-slate-100">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 backdrop-blur-xl">
        <Link href="/">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />
            Command Centre
          </Button>
        </Link>

        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
            <Shield className="h-4 w-4 text-cyan-400" />
            Flood Response Drill
          </h1>
          <p className="text-[11px] text-slate-400">
            Training mode &middot; placement scored against the same storm with no barriers
          </p>
        </div>

        <Badge variant="cyan" className="ml-auto text-[10px]">
          Training &mdash; live simulation unaffected
        </Badge>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Placement board ───────────────────────────────────────────────── */}
        <section className="min-w-0 space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              {hasRun ? 'Outcome — Water Depth' : 'Barrier Placement Board'}
            </h2>
            <span className="text-[11px] text-slate-400">
              {hasRun
                ? 'Darker blue is deeper standing water'
                : 'Click a sector to place a barrier. Brighter sectors are more densely populated.'}
            </span>
          </div>

          {/* 18x18 sector board */}
          {/* The board keeps a minimum cell size so sectors stay tappable on a
              phone, and pans horizontally rather than shrinking to 15px squares. */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(28px, 1fr))` }}
            >
            {Array.from({ length: GRID_HEIGHT }).flatMap((_, y) =>
              Array.from({ length: GRID_WIDTH }).map((__, x) => {
                const cell = BOARD[y]?.[x];
                if (!cell) return <div key={`${x}-${y}`} />;

                const isBarrier = barriers.has(cell.id);
                const depth = depthByCell?.get(cell.id) ?? 0;

                // Before the run: shade by population density so the operator can
                // see what is worth shielding. After: shade by water depth.
                let background: string;
                if (hasRun) {
                  const t = Math.min(1, depth / 1.5);
                  background = `rgba(14, 165, 233, ${0.08 + t * 0.8})`;
                } else {
                  const t = Math.min(1, cell.population / 6000);
                  background = `rgba(148, 163, 184, ${0.06 + t * 0.35})`;
                }

                return (
                  <button
                    key={cell.id}
                    type="button"
                    onClick={() => toggleBarrier(cell.id)}
                    disabled={hasRun}
                    aria-label={`${cell.name}, population ${cell.population}, elevation ${cell.elevation} metres${
                      isBarrier ? ', barrier placed' : ''
                    }`}
                    title={`${cell.name}\nPopulation: ${cell.population.toLocaleString()}\nElevation: ${cell.elevation} m${
                      hasRun ? `\nWater depth: ${depth.toFixed(2)} m` : ''
                    }`}
                    className={`relative aspect-square rounded-[3px] transition-all ${
                      hasRun ? 'cursor-default' : 'hover:ring-1 hover:ring-cyan-400/70'
                    } ${isBarrier ? 'ring-2 ring-emerald-400' : ''}`}
                    style={{ background }}
                  >
                    {isBarrier && (
                      <Shield className="absolute inset-0 m-auto h-2.5 w-2.5 text-emerald-300" />
                    )}
                  </button>
                );
                }),
              )}
            </div>
          </div>

          {/* Outcome timeline */}
          {attempt && (
            <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Drill Timeline
              </h3>
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
                {attempt.steps.map(step => (
                  <div
                    key={step.timeLabel}
                    className="rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5"
                  >
                    <div className="font-mono text-[10px] text-slate-400">{step.timeLabel}</div>
                    <div className="text-[11px] font-bold text-amber-300">
                      {step.affectedPopulation.toLocaleString()} exposed
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {step.criticalZones} critical &middot; {step.maxWaterDepth.toFixed(2)} m peak
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Control column ────────────────────────────────────────────────── */}
        <aside className="min-w-0 space-y-3">
          {/* Drill selection */}
          <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Select Drill
            </h2>
            <div className="space-y-1.5">
              {DRILL_SCENARIOS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => resetAttempt(s)}
                  className={`w-full rounded-md border px-2.5 py-2 text-left transition-all ${
                    s.id === scenario.id
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                      : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-[11px] font-bold">{s.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {s.rainfallMmHr} mm/h &middot; gate {s.sluiceGateOpen ? 'open' : 'shut'} &middot;{' '}
                    {s.fixedPumps} pumps
                  </div>
                </button>
              ))}
            </div>
            <p className="border-t border-slate-800/80 pt-2 text-[11px] leading-relaxed text-slate-400">
              {scenario.briefing}
            </p>
          </div>

          {/* Conditions & budget */}
          <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Conditions
            </h2>

            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Droplets className="h-3.5 w-3.5 text-cyan-400" />
                GMDA pumps running
              </span>
              <span className="font-mono font-bold text-cyan-300">
                {scenario.fixedPumps} / 20
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                Barriers remaining
              </span>
              <span
                className={`font-mono font-bold ${
                  barriersLeft === 0 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {barriersLeft} / {scenario.barrierBudget}
              </span>
            </div>

            <p className="text-[10px] leading-relaxed text-slate-500">
              The pump fleet is fixed for each drill. Barrier placement is the only decision, and
              the only thing scored.
            </p>

            <div className="flex gap-1.5 border-t border-slate-800/80 pt-2.5">
              <Button
                size="sm"
                variant="cyan"
                onClick={runDrill}
                disabled={hasRun || barriers.size === 0}
                className="h-7 flex-1 text-[11px]"
                title={
                  barriers.size === 0
                    ? 'Place at least one barrier before running the drill'
                    : 'Run the drill with these placements'
                }
              >
                <Play className="mr-1 h-3 w-3" />
                Commit &amp; Run Drill
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetAttempt()}
                className="h-7 px-2 text-[11px]"
                title="Reset this drill attempt"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Result */}
          {score && (
            <div
              className={`space-y-2.5 rounded-xl border p-3 ${
                score.passed
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-rose-500/50 bg-rose-950/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
                  {score.passed ? (
                    <Trophy className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  )}
                  {score.passed ? 'Drill Passed' : 'Drill Failed'}
                </h2>
                <Badge variant={score.passed ? 'safe' : 'critical'} className="text-[10px]">
                  {score.points.toLocaleString()} PTS
                </Badge>
              </div>

              <dl className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-slate-300">
                    <Droplets className="h-3 w-3 text-emerald-400" />
                    Exposure avoided
                  </dt>
                  <dd className="font-mono font-bold text-emerald-300">
                    {score.exposureAvoided.toLocaleString()}{' '}
                    <span className="text-[9px] font-normal text-slate-400">res&middot;m</span>
                  </dd>
                </div>

                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-slate-300">
                    <Target className="h-3 w-3 text-cyan-400" />
                    Target to pass
                  </dt>
                  <dd className="font-mono text-slate-200">
                    {score.targetExposureAvoided.toLocaleString()}{' '}
                    <span className="text-[9px] text-slate-400">res&middot;m</span>
                  </dd>
                </div>

                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-slate-300">
                    <Ban className="h-3 w-3 text-amber-400" />
                    Barriers wasted
                  </dt>
                  <dd
                    className={`font-mono font-bold ${
                      score.wastedBarriers > 0 ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {score.wastedBarriers} / {barriers.size}
                  </dd>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                  <dt className="flex items-center gap-1.5 text-slate-400">
                    <Users className="h-3 w-3" />
                    Residents fully cleared
                  </dt>
                  <dd className="font-mono text-slate-400">
                    {score.protectedPopulation.toLocaleString()}
                  </dd>
                </div>

                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Sectors cleared of flooding</dt>
                  <dd className="font-mono text-slate-400">{score.sectorsSaved}</dd>
                </div>
              </dl>

              <p className="border-t border-slate-800/80 pt-2 text-[11px] leading-relaxed text-slate-400">
                {score.wastedBarriers > 0
                  ? `${score.wastedBarriers} of your barriers sat on ground that was already draining, so they changed nothing. Look for dense, low-lying sectors that actually pond.`
                  : 'Every barrier reduced depth where you placed it. A barrier raises its sector’s hydraulic head, shedding water onto its neighbours — so shield dense ground and let runoff reach sparse ground.'}
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
