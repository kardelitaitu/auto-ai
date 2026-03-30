/**
 * Health Dashboard Route
 * Serves the health dashboard HTML page
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DASHBOARD_DIR = join(__dirname, '..', 'health-dashboard');

/**
 * Create health dashboard router
 * @param {object} options - Router options
 * @returns {express.Router}
 */
export function createHealthDashboardRouter(options = {}) {
  const router = express.Router();
  
  // Serve dashboard HTML
  router.get('/', (req, res) => {
    res.sendFile(join(DASHBOARD_DIR, 'index.html'));
  });
  
  // Serve static files (CSS, JS)
  router.use(express.static(DASHBOARD_DIR));
  
  return router;
}

export default {
  createHealthDashboardRouter
};
