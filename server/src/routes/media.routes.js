const { Router } = require('express');
const mediaController = require('../controllers/media.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const upload = require('../middleware/upload');

const router = Router();

router.get('/', authenticate, mediaController.list);
router.post('/upload', authenticate, requireRole('admin', 'manager', 'editor'), upload.array('files', 10), mediaController.upload);
router.get('/:id', authenticate, mediaController.get);
router.delete('/:id', authenticate, requireRole('admin', 'manager', 'editor'), mediaController.remove);

module.exports = router;
