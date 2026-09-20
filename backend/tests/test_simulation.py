"""
HYDRO MATRIX : Backend Simulation & Mathematical Physics Test Suite
Validates 2D mass conservation, CFL stability bounds, and MCDA scoring.
"""

import unittest
import numpy as np
from backend.simulation.hydrology_solver import execute_vectorized_step
from backend.simulation.cfl_limiter import CFLLimiterEngine
from backend.optimization.mcda_camp_placement import compute_suitability_matrix


class TestHydroMatrixSimulation(unittest.TestCase):
    def test_vectorized_physics_step_execution(self):
        """Validates that a single 2D Saint-Venant step executes without NaN or inf."""
        res = execute_vectorized_step(rainfall_mm_hr=45.0, active_pumps=20, sluice_open=True)

        self.assertIn("flooded_area_sqkm", res)
        self.assertIn("critical_zones", res)
        self.assertIn("warning_zones", res)
        self.assertIn("max_water_depth_m", res)
        self.assertGreaterEqual(res["flooded_area_sqkm"], 0.0)
        self.assertFalse(np.isnan(res["max_water_depth_m"]))
        self.assertFalse(np.isinf(res["max_water_depth_m"]))

    def test_mass_conservation_and_cfl_limiter(self):
        """Validates that Courant-Friedrichs-Lewy flux limiter bounds outbound volume."""
        cfl = CFLLimiterEngine(cell_size_m=250.0, courant_max=0.35)
        water_depth = np.full((18, 18), 1.0)  # 1 meter standing water

        # Deliberately oversized outbound flux
        flux = np.full((18, 18), 0.8)
        qn, qs, qw, qe = cfl.apply_outbound_flux_limiter(water_depth, flux, flux, flux, flux)

        total_outbound = qn + qs + qw + qe
        self.assertTrue(np.all(total_outbound <= 0.350001))

    def test_relief_camp_mcda_suitability_bounds(self):
        """Validates that MCDA suitability scores remain within [0, 100]."""
        test_depth = np.zeros((18, 18))
        scores = compute_suitability_matrix(test_depth)

        self.assertTrue(np.all(scores >= 0.0))
        self.assertTrue(np.all(scores <= 100.0))
        # Brahmaputra riverbed must be strictly 0
        self.assertTrue(np.all(scores[0:2, :] == 0.0))


if __name__ == "__main__":
    unittest.main()