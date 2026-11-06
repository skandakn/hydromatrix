/**
 * HYDRO MATRIX: Flood Response Drill Engine
 *
 * Training mode. The operator is given a historical storm and a limited number
 * of flood barriers, and must decide which sectors to shield. The drill runs the
 * same deterministic shallow-water engine the dashboard uses and scores the
 * placement against an identical run with no barriers.
 *
 * Why barriers are the only lever: measured against this engine, mechanical
 * dewatering dominates every other intervention - four pumps alone avoid around
 * 400,000 resident-metres of floodwater, while six well-placed barriers add
 * roughly 400. Leaving pump count adjustable made the drill a single slider and
 * the placement board decorative. The pump fleet is therefore a fixed condition
 * of each scenario, and the drill scores exactly what the operator decides.
 *
 * The placement decision is genuinely non-trivial. A barrier raises the
 * hydraulic head of the cell it sits on, so that cell resists inflow and sheds
 * water faster - but the water it sheds goes to its neighbours, and a barrier on
 * ground that was already draining achieves nothing at all. The skill is in
 * finding dense, low-lying sectors that actually pond.
 *
 * Drill simulations run on their own grid copy and never touch the dashboard
 * store, so a drill cannot disturb the live simulation.
 */

import { GridNode, SimulationConfig } from '@/types/simulation';
import { generateCityGrid2D } from '@/lib/simulation-engine/cityGrid';
import { runSimulationStep } from '@/lib/simulation-engine/physics';

/**
 * Depth at which a sector counts as inundated for drill reporting. Matches the
 * dashboard's WARNING band so the drill and the live map agree on what
 * "flooded" means.
 */
export const DRILL_INUNDATION_THRESHOLD_M = 0.25;

export interface DrillScenario {
  id: string;
  name: string;
  briefing: string;
  /** Sustained precipitation for the drill, in mm/h. */
  rainfallMmHr: number;
  /** Bharalumukh sluice gate state; closed models Brahmaputra backwater lock. */
  sluiceGateOpen: boolean;
  drainageSystemEfficiency: number;
  /** Flood barriers the operator may place. */
  barrierBudget: number;
  /** GMDA pumps available in this scenario. Fixed, not an operator choice. */
  fixedPumps: number;
  /** Drill horizon in hours; stepped in 6-hour intervals. */
  durationHours: number;
  /**
   * Resident-metres of floodwater the operator must avoid to pass. Calibrated
   * per scenario against what good placement actually achieves in this engine.
   */
  targetExposureAvoided: number;
}

/**
 * Drills are grounded in the Guwahati events the project calibrates against
 * (ASDMA / CWC records for 2022 and 2024) and in the two failure modes the
 * dashboard models explicitly: sluice-gate backwater lock and pump grid loss.
 */
export const DRILL_SCENARIOS: DrillScenario[] = [
  {
    id: 'june-2022',
    name: 'June 2022 Urban Inundation',
    briefing:
      'Sustained convective rainfall over the Bahini-Bharalu catchment, mirroring the June 2022 event. The sluice gate is open and most of the pump fleet is running. Shield the dense low-lying sectors that pond fastest.',
    rainfallMmHr: 70,
    sluiceGateOpen: true,
    drainageSystemEfficiency: 1.0,
    barrierBudget: 6,
    fixedPumps: 8,
    durationHours: 24,
    targetExposureAvoided: 450,
  },
  {
    id: 'sluice-lock',
    name: 'Bharalumukh Sluice Lock',
    briefing:
      'The Brahmaputra is at high stage and the Bharalumukh sluice gate is shut, blocking gravity discharge. Water can only leave the basin by pump, and ponding builds from the outfall inwards.',
    rainfallMmHr: 65,
    sluiceGateOpen: false,
    drainageSystemEfficiency: 1.0,
    barrierBudget: 5,
    fixedPumps: 12,
    durationHours: 24,
    targetExposureAvoided: 170,
  },
  {
    id: 'pump-failure',
    name: 'Pump Grid Failure',
    briefing:
      'An electrical fault has taken most of the GMDA dewatering fleet offline during an extreme cloudburst. With almost no mechanical discharge available, barrier placement is the only lever you have.',
    rainfallMmHr: 95,
    sluiceGateOpen: true,
    drainageSystemEfficiency: 0.4,
    barrierBudget: 8,
    fixedPumps: 2,
    durationHours: 24,
    targetExposureAvoided: 4500,
  },
];

export interface DrillStepResult {
  hours: number;
  timeLabel: string;
  affectedPopulation: number;
  criticalZones: number;
  floodedAreaSqKm: number;
  maxWaterDepth: number;
}

export interface DrillRunResult {
  steps: DrillStepResult[];
  /** Grid state at the end of the run, for map shading. */
  finalGrid: GridNode[];
  /** Deepest water each sector reached during the run, keyed by cell id. */
  peakDepthByCell: Record<string, number>;
  /** Population of every sector inundated at any point in the run. */
  exposedPopulation: number;
  peakAffectedPopulation: number;
  peakCriticalZones: number;
  peakFloodedAreaSqKm: number;
}

/** Permanent water bodies hold water by design and are never "protected". */
function isPermanentWater(cell: GridNode): boolean {
  return cell.infrastructure === 'wetland' || cell.channelType === 'Brahmaputra';
}

/** Fresh grid copy with the operator's barriers applied. */
function buildDrillGrid(barrierCellIds: Set<string>): GridNode[][] {
  return generateCityGrid2D().map(row =>
    row.map(cell => ({
      ...cell,
      barrierActive: barrierCellIds.has(cell.id),
      barrierHeight: barrierCellIds.has(cell.id) ? 1.0 : 0,
    })),
  );
}

/**
 * Run a drill to its horizon and report the outcome at each 6-hour interval.
 */
export function runDrillSimulation(
  scenario: DrillScenario,
  barrierCellIds: Set<string>,
): DrillRunResult {
  const config: Partial<SimulationConfig> = {
    sluiceGateOpen: scenario.sluiceGateOpen,
    drainageSystemEfficiency: scenario.drainageSystemEfficiency,
  };

  let grid = buildDrillGrid(barrierCellIds);
  let finalFlat: GridNode[] = grid.flat();

  const steps: DrillStepResult[] = [];
  const peakDepthByCell: Record<string, number> = {};
  let peakAffectedPopulation = 0;
  let peakCriticalZones = 0;
  let peakFloodedAreaSqKm = 0;

  const intervals = Math.max(1, Math.round(scenario.durationHours / 6));

  for (let i = 1; i <= intervals; i++) {
    const result = runSimulationStep(grid, scenario.rainfallMmHr, scenario.fixedPumps, config);
    grid = result.nextGrid2D;
    finalFlat = result.nextGrid;

    for (const cell of result.nextGrid) {
      const seen = peakDepthByCell[cell.id] ?? 0;
      if (cell.waterDepth > seen) peakDepthByCell[cell.id] = cell.waterDepth;
    }

    const hours = i * 6;
    steps.push({
      hours,
      timeLabel: `T+${String(hours).padStart(2, '0')}h`,
      affectedPopulation: result.affectedResidents,
      criticalZones: result.criticalZoneCount,
      floodedAreaSqKm: result.floodedAreaSqKm,
      maxWaterDepth: result.maxWaterDepth,
    });

    peakAffectedPopulation = Math.max(peakAffectedPopulation, result.affectedResidents);
    peakCriticalZones = Math.max(peakCriticalZones, result.criticalZoneCount);
    peakFloodedAreaSqKm = Math.max(peakFloodedAreaSqKm, result.floodedAreaSqKm);
  }

  const exposedPopulation = finalFlat.reduce((sum, cell) => {
    if (isPermanentWater(cell)) return sum;
    return (peakDepthByCell[cell.id] ?? 0) > DRILL_INUNDATION_THRESHOLD_M
      ? sum + cell.population
      : sum;
  }, 0);

  return {
    steps,
    finalGrid: finalFlat,
    peakDepthByCell,
    exposedPopulation,
    peakAffectedPopulation,
    peakCriticalZones,
    peakFloodedAreaSqKm,
  };
}

export interface DrillScore {
  /**
   * Resident-metres of floodwater avoided: population x depth reduction summed
   * across every sector. Continuous rather than binary, because a 1 m barrier
   * rarely lifts a sector clear of the inundation band outright in a severe
   * storm, while halving the depth over a dense sector is a real result.
   */
  exposureAvoided: number;
  /** Resident-metres the same storm inflicts with no barriers placed. */
  baselineExposure: number;
  /** Residents in sectors lifted fully clear of the inundation band. */
  protectedPopulation: number;
  /** Sectors lifted fully clear of the inundation band. */
  sectorsSaved: number;
  /** Barriers spent on ground where they made no measurable difference. */
  wastedBarriers: number;
  targetExposureAvoided: number;
  passed: boolean;
  points: number;
}

/**
 * Score a placement against an identical run with no barriers. Holding the
 * storm and the pump fleet constant isolates the one thing the operator decided.
 */
export function scoreDrill(
  scenario: DrillScenario,
  baseline: DrillRunResult,
  attempt: DrillRunResult,
  barrierCellIds: Set<string>,
): DrillScore {
  let exposureAvoided = 0;
  let baselineExposure = 0;
  let protectedPopulation = 0;
  let sectorsSaved = 0;
  let wastedBarriers = 0;

  for (const cell of baseline.finalGrid) {
    if (isPermanentWater(cell)) continue;

    const before = baseline.peakDepthByCell[cell.id] ?? 0;
    const after = attempt.peakDepthByCell[cell.id] ?? 0;
    const reduction = Math.max(0, before - after);

    baselineExposure += cell.population * before;
    exposureAvoided += cell.population * reduction;

    if (before > DRILL_INUNDATION_THRESHOLD_M && after <= DRILL_INUNDATION_THRESHOLD_M) {
      protectedPopulation += cell.population;
      sectorsSaved++;
    }

    // A barrier on ground that was already draining changes nothing. Reporting
    // how many were wasted is the main teaching point of the drill.
    if (barrierCellIds.has(cell.id) && reduction < 0.01) {
      wastedBarriers++;
    }
  }

  exposureAvoided = Math.round(exposureAvoided);

  return {
    exposureAvoided,
    baselineExposure: Math.round(baselineExposure),
    protectedPopulation,
    sectorsSaved,
    wastedBarriers,
    targetExposureAvoided: scenario.targetExposureAvoided,
    passed: exposureAvoided >= scenario.targetExposureAvoided,
    points: Math.round(exposureAvoided / 10) + sectorsSaved * 50,
  };
}

/** The no-barrier run a placement is scored against. */
export function runDrillBaseline(scenario: DrillScenario): DrillRunResult {
  return runDrillSimulation(scenario, new Set<string>());
}
