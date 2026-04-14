const { Router } = require('express');
const teamsController = require('../controllers/teams.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

const router = Router();

router.get('/', authenticate, teamsController.list);
router.post('/', authenticate, requireRole('admin'), teamsController.create);
router.get('/:id', authenticate, teamsController.get);
router.put('/:id', authenticate, requireRole('admin'), teamsController.update);
router.delete('/:id', authenticate, requireRole('admin'), teamsController.remove);
router.post('/:id/members', authenticate, requireRole('admin', 'manager'), teamsController.addMember);
router.delete('/:id/members/:userId', authenticate, requireRole('admin', 'manager'), teamsController.removeMember);

module.exports = router;
