const { Router } = require('express');
const socialController = require('../controllers/social.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

const router = Router();

router.get('/accounts', authenticate, socialController.listAccounts);
router.get('/auth/facebook', authenticate, requireRole('admin'), socialController.startOAuth);
router.get('/auth/facebook/callback', socialController.oauthCallback); // No auth — redirected from Facebook
router.delete('/accounts/:id', authenticate, requireRole('admin'), socialController.disconnectAccount);
router.post('/accounts/:id/reconnect', authenticate, requireRole('admin'), socialController.reconnectAccount);

module.exports = router;
