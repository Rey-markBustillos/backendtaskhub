const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Configuration ---

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const activityStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/activities';
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `activity-${Date.now()}${ext}`);
  },
});

const submissionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/submissions';
    ensureDir(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `submission-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  cb(null, true); 
};

const uploadActivity = multer({
  storage: activityStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

const uploadSubmission = multer({
  storage: submissionStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

// --- Routes ---

// GET all activities for a class
router.get('/', activityController.getActivities);

// POST create a new activity
router.post('/', uploadActivity.single('attachment'), activityController.createActivity);

// GET a single submission for a student and activity
router.get('/submission', activityController.getSubmissionForActivity);

// GET to download a submission file
router.get('/submission/:id/download', activityController.downloadSubmissionFile);

// Get all students' scores for a class
router.get('/export-scores', require('../controllers/activityController').exportScores);

// DELETE a submission by its ID (for students)
router.delete('/submission/:id', activityController.deleteSubmission);

// GET all submissions for a student in a class
router.get('/submissions', activityController.getSubmissionsForStudentInClass);

// GET submissions for a teacher to monitor
router.get('/submissions/teacher/:teacherId', activityController.getActivitySubmissionsByTeacher);

// PUT to update a submission's score
router.put('/submissions/score/:submissionId', activityController.updateActivityScore);

// POST a new submission for an activity
router.post('/submit', uploadSubmission.single('file'), activityController.submitActivity);

// PUT to resubmit an activity
router.put('/resubmit/:id', uploadSubmission.single('file'), activityController.resubmitActivity);

// GET to download an activity attachment
router.get('/:id/download', activityController.downloadActivityAttachment);

// GET a single activity by its ID
router.get('/:id', activityController.getActivityById);

// PUT to update an activity
router.put('/:id', uploadActivity.single('attachment'), activityController.updateActivity);

// DELETE an activity
router.delete('/:id', activityController.deleteActivity);

module.exports = router;