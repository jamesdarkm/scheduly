const { Router } = require('express');
const calendarController = require('../controllers/calendar.controller');
const authenticate = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, calendarController.getEvents);

module.exports = router;
