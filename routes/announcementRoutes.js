const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  addComment,
  toggleReaction,
  markAsViewed // AYOS: I-import ang bagong function
} = require('../controllers/announcementController');

// --- Multer / Cloudinary Setup for Announcements ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage configuration for announcements
const announcementCloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "taskhub/announcements",
    public_id: `announcement-${Date.now()}`,
    resource_type: 'auto', // ⭐ REQUIRED: Handles images + documents
    access_mode: "public",  // ✅ Ensure files are publicly accessible
    type: "upload",
  }),
});

const upload = multer({
  storage: announcementCloudinaryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types including Word and PowerPoint
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|txt|mp4|mp3|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, documents, videos, audio, and archive files are allowed'));
    }
  }
});

// Keep legacy uploads directory for backward compatibility (if needed)
const uploadsDir = path.join(__dirname, '../uploads/announcements');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes for creating and getting all announcements
router.route('/')
  .get(getAllAnnouncements)
  .post(upload.array('attachments', 5), createAnnouncement); // Allow up to 5 files

// Routes for a specific announcement by ID
router.route('/:id')
  .get(getAnnouncementById)
  .put(updateAnnouncement)
  .delete(deleteAnnouncement);

// Route for adding a comment
router.route('/:id/comments').post(addComment);

// Route for toggling a reaction
router.route('/:id/reactions').post(toggleReaction);

// Legacy route for downloading announcement attachments (for backward compatibility)
router.get('/attachment/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    console.log('Legacy file request:', filename);
    console.log('File path:', filePath);
    console.log('File exists:', fs.existsSync(filePath));
    
    // Check if file exists locally (for legacy files)
    if (!fs.existsSync(filePath)) {
      console.log('Legacy file not found:', filename);
      return res.status(404).json({ message: 'File not found - files are now stored in cloud storage' });
    }
    
    // Check if it's a download request or view request
    const download = req.query.download === 'true';
    
    if (download) {
      res.download(filePath);
    } else {
      // For viewing in browser - set appropriate headers
      const ext = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';
      
      // Set proper content types for inline viewing
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        contentType = `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`;
      } else if (ext === '.pdf') {
        contentType = 'application/pdf';
      } else if (['.mp4', '.webm'].includes(ext)) {
        contentType = `video/${ext.slice(1)}`;
      } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
        contentType = `audio/${ext.slice(1)}`;
      }
      
      console.log('Serving legacy file with content type:', contentType);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.sendFile(filePath);
    }
  } catch (error) {
    console.error('Error serving legacy file:', error);
    res.status(500).json({ message: 'Error accessing file', error: error.message });
  }
});

// Legacy file serving route (for backward compatibility with old local files)
router.get('/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    console.log('🌐 LEGACY FILES REQUEST:', filename);
    console.log('📁 File path:', filePath);
    console.log('✅ File exists:', fs.existsSync(filePath));
    
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    if (fs.existsSync(filePath)) {
      // Set proper headers for images
      const ext = path.extname(filename).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        res.setHeader('Content-Type', `image/${ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1)}`);
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(filePath);
    } else {
      console.log('❌ Legacy file not found:', filename);
      res.status(404).json({ message: 'File not found - files are now stored in cloud storage' });
    }
  } catch (error) {
    console.error('❌ Error in legacy /files/ route:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route for downloading Cloudinary files with proper headers
router.get('/download/:announcementId/:attachmentIndex', async (req, res) => {
  try {
    const { announcementId, attachmentIndex } = req.params;
    
    console.log('🔽 Download request for announcement:', announcementId, 'attachment:', attachmentIndex);
    
    // Find the announcement
    const announcement = await require('../controllers/announcementController').getAnnouncementByIdHelper(announcementId);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Get the specific attachment
    const attachment = announcement.attachments[parseInt(attachmentIndex)];
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    console.log('🔽 Found attachment:', attachment.originalName, 'Cloudinary URL:', attachment.cloudinaryUrl);
    
    // If it's a Cloudinary file, redirect to the download URL
    if (attachment.cloudinaryUrl) {
      // Create download URL with proper Cloudinary transformation
      const downloadUrl = attachment.cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/');
      console.log('🔽 Redirecting to Cloudinary download URL:', downloadUrl);
      
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
      return res.redirect(downloadUrl);
    }
    
    // For legacy files, use the existing logic
    const filePath = path.join(__dirname, '../uploads/announcements', attachment.filename);
    if (fs.existsSync(filePath)) {
      res.download(filePath, attachment.originalName);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  } catch (error) {
    console.error('❌ Error in download route:', error);
    res.status(500).json({ message: 'Download failed', error: error.message });
  }
});

// AYOS: Bagong route para sa pag-view
router.route('/:id/view').post(markAsViewed);

module.exports = router;