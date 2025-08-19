const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

// GET all submissions for a student
router.get('/student/:studentId', activityController.getStudentSubmissions);

module.exports = router;