const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/health
// Reports backend liveness + a real DB round-trip (not just "server is up").
// Consumed by the frontend's neon status pill under the login button.
const getHealth = asyncHandler(async (req, res) => {
  const backend = { status: 'up' };
  let database = { status: 'down' };

  try {
    // Real Prisma query, not a fake ping
    await prisma.$queryRaw`SELECT 1`;
    database = { status: 'up' };
  } catch (err) {
    database = { status: 'down', message: err.message };
  }

  const healthy = backend.status === 'up' && database.status === 'up';

  res.status(healthy ? 200 : 503).json({
    success: true,
    status: healthy ? 'healthy' : 'unhealthy',
    backend,
    database,
    timestamp: new Date().toISOString(),
  });
});

module.exports = { getHealth };
