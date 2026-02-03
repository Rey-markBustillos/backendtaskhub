const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { verifyToken } = require('../middleware/auth');
const path = require('path');

// --- Multer / Cloudinary Setup ---
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Debug: Verify Cloudinary config loaded
console.log('[DEBUG] Cloudinary Config:');
console.log('- Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME || 'MISSING ❌');
console.log('- API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Loaded' : 'MISSING ❌');
console.log('- API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Loaded' : 'MISSING ❌');

// filepath: c:\xampp\htdocs\Capstone-Admin-TaskHub\backend\routes\activityRoutes.js
const activityCloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    const isDoc = /^(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|zip|rar)$/i.test(ext);

    return {
      folder: "taskhub/activities",
      public_id: `activity-${Date.now()}`,  // ✅ Cloudinary adds extension automatically
      resource_type: isDoc ? "raw" : "image",
      access_mode: "public",  // ✅ Ensure files are publicly accessible
      type: "upload",
    };
  },
});

const uploadActivity = multer({
  storage: activityCloudinaryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    // Allow common file types including images, documents, videos, audio, and archives
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|txt|mp4|mp3|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, documents, videos, audio, and archive files are allowed'));
    }
  },
});

// ------------------------------------------------------
// 📌 SUBMISSIONS — MUST BE FIRST (prevents /:id conflicts)
// ------------------------------------------------------
router.post('/submit', verifyToken, uploadActivity.single('file'), activityController.submitActivity);
router.get("/submission", verifyToken, activityController.getSubmissionForActivity);
router.get("/submissions", verifyToken, activityController.getSubmissionsForStudentInClass);
router.get("/submissions/teacher/:teacherId", verifyToken, activityController.getActivitySubmissionsByTeacher);
router.put("/submissions/score/:submissionId", verifyToken, activityController.updateActivityScore);
router.delete("/submission/:id", verifyToken, activityController.deleteSubmission);

// Legacy submission routes
router.get("/submission/:id/download", verifyToken, activityController.downloadSubmissionFile);
router.get("/submission/:id/info", verifyToken, activityController.getSubmissionInfo);

// ------------------------------------------------------
// 📌 ACTIVITY CRUD
// ------------------------------------------------------
router.get("/", activityController.getActivities); // Get all activities
router.post("/", verifyToken, uploadActivity.single("attachment"), activityController.createActivity); // Create new activity
router.put("/:id", verifyToken, uploadActivity.single("attachment"), activityController.updateActivity); // Update activity
router.delete("/:id", verifyToken, activityController.deleteActivity); // Delete activity

// ------------------------------------------------------
// 📌 Lock / Unlock Activity
// ------------------------------------------------------
router.patch("/:id/lock", verifyToken, activityController.toggleActivityLock);

// ------------------------------------------------------
// 📌 Download activity attachment - MUST BE BEFORE /:id
// ------------------------------------------------------
router.get("/:id/download", activityController.downloadActivityAttachment);

// ------------------------------------------------------
// 📌 Export Scores - MUST BE BEFORE /:id
// ------------------------------------------------------
router.get("/export-scores", verifyToken, activityController.exportScores);

// ------------------------------------------------------
// 📌 Resubmission (Legacy Support)
// ------------------------------------------------------
router.options("/resubmit/:id", (req, res) => {
  res.header("Access-Control-Allow-Origin", "https://capstone-admin-task-hub-jske.vercel.app");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(204);
});

router.put("/resubmit/:id", verifyToken, uploadActivity.single("file"), activityController.resubmitActivity);

// ------------------------------------------------------
// 📌 Get single activity (MUST BE LAST to avoid route conflicts)
// ------------------------------------------------------
router.get("/:id", activityController.getActivityById);

module.exports = router;