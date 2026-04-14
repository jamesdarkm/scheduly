const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

const router = Router();

router.get('/', authenticate, requireRole('admin', 'manager'), usersController.list);
router.post('/', authenticate, requireRole('admin'), usersController.create);
router.get('/:id', authenticate, requireRole('admin', 'manager'), usersController.get);
router.put('/:id', authenticate, requireRole('admin'), usersController.update);
router.delete('/:id', authenticate, requireRole('admin'), usersController.deactivate);

module.exports = router;
