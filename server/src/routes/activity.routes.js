const { Router } = require('express');
const authenticate = require('../middleware/auth');
const activityService = require('../services/activity.service');

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit, entityType, entityId } = req.query;
    const activity = await activityService.getRecentActivity({
      limit: parseInt(limit, 10) || 20,
      entityType,
      entityId: entityId ? parseInt(entityId, 10) : undefined,
    });
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
