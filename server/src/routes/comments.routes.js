const { Router } = require('express');
const commentsController = require('../controllers/comments.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

const router = Router();

router.get('/', authenticate, commentsController.list);
router.post('/', authenticate, requireRole('admin', 'manager', 'editor'), commentsController.create);
router.put('/:id', authenticate, commentsController.update);
router.delete('/:id', authenticate, commentsController.remove);

module.exports = router;
