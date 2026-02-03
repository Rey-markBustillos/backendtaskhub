const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Module = require('../models/Module');

// --- Cloudinary Setup for Modules ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary storage configuration for modules
const moduleCloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "taskhub/modules",
      public_id: `module-${Date.now()}`,
      resource_type: 'auto',  // ✅ Auto-detect: handles PDFs, documents, and all file types
      access_mode: "public",
      type: "upload",
    };
  },
});

// Keep legacy local storage for backward compatibility
const legacyStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'modules');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'module-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: moduleCloudinaryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allowed file types for modules
    const allowedTypes = [
      'application/pdf', // .pdf
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload PDF, DOC, DOCX, PPT, PPTX, XLS, or XLSX files.'), false);
    }
  }
});

// Get all modules for a class
router.get('/', async (req, res) => {
  try {
    const { classId } = req.query;
    
    if (!classId) {
      return res.status(400).json({ message: 'Class ID is required' });
    }
    
    const modules = await Module.find({ classId })
      .populate('uploadedBy', 'name email')
      .sort({ uploadDate: -1 });
    
    res.json(modules);
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload a new module
router.post('/upload', upload.single('module'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { title, description, classId, uploadedBy } = req.body;
    
    if (!title || !classId || !uploadedBy) {
      return res.status(400).json({ message: 'Title, Class ID, and Uploaded By are required' });
    }
    
    console.log('📎 Processing module upload:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      secure_url: req.file.secure_url,
      public_id: req.file.public_id,
      resource_type: req.file.resource_type
    });
    
    // Construct Cloudinary URL if secure_url is missing but we have public_id
    let cloudinaryUrl = req.file.secure_url || req.file.url;
    if (!cloudinaryUrl && req.file.public_id) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dptg3ct9i';
      const resourceType = req.file.resource_type || 'raw';
      cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${req.file.public_id}`;
      console.log('🔧 Constructed Cloudinary URL for module:', cloudinaryUrl);
    }
    
    const module = new Module({
      title: title.trim(),
      description: description ? description.trim() : '',
      fileName: req.file.originalname,
      filePath: req.file.filename || req.file.public_id, // Store filename or public_id
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      classId,
      uploadedBy,
      uploadDate: new Date(),
      // Cloudinary fields
      cloudinaryUrl: cloudinaryUrl,
      publicId: req.file.public_id,
      resourceType: req.file.resource_type
    });
    
    await module.save();
    
    // Populate the uploadedBy field before sending response
    await module.populate('uploadedBy', 'name email');
    
    console.log('✅ Module uploaded successfully with Cloudinary URL:', cloudinaryUrl);
    res.status(201).json({
      message: 'Module uploaded successfully',
      module
    });
  } catch (error) {
    console.error('❌ Error uploading module:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download a module
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 Download request for module ID:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ message: 'Invalid module ID format' });
    }
    
    const module = await Module.findById(id);
    
    if (!module) {
      console.log('Module not found with ID:', id);
      return res.status(404).json({ message: 'Module not found' });
    }
    
    console.log('📋 Module found for download:', module.title);
    console.log('📋 Cloudinary URL:', module.cloudinaryUrl);
    console.log('📋 File path:', module.filePath);
    
    // Increment download count
    try {
      await module.incrementDownloadCount();
    } catch (err) {
      console.warn('Could not increment download count:', err.message);
    }
    
    // If it's a Cloudinary file, redirect to Cloudinary download URL
    if (module.cloudinaryUrl) {
      console.log('🔽 Redirecting to Cloudinary download URL');
      // Create download URL with proper Cloudinary transformation for attachment
      const downloadUrl = module.cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/');
      
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
      return res.redirect(downloadUrl);
    }
    
    // Legacy file handling - local files
    let filePath;
    if (path.isAbsolute(module.filePath)) {
      // Old format: absolute path
      filePath = module.filePath;
    } else {
      // New format: relative path (filename only)
      filePath = path.join(__dirname, '..', 'uploads', 'modules', module.filePath);
    }
    
    console.log('📋 Constructed local file path:', filePath);
    console.log('📋 File exists:', fs.existsSync(filePath));
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found at path:', filePath);
      return res.status(404).json({ message: 'File not found on server - files are now stored in cloud storage' });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${module.fileName}"`);
    res.setHeader('Content-Type', module.mimeType);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('❌ Error downloading module:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// View a module (for PDFs and other viewable files)
router.get('/view/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('👀 View request for module ID:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ message: 'Invalid module ID format' });
    }
    
    const module = await Module.findById(id);
    
    if (!module) {
      console.log('Module not found with ID:', id);
      return res.status(404).json({ message: 'Module not found' });
    }
    
    console.log('👀 Module found for viewing:', module.title);
    console.log('👀 Cloudinary URL:', module.cloudinaryUrl);
    console.log('👀 File path:', module.filePath);
    
    // If it's a Cloudinary file, redirect to Cloudinary URL for inline viewing
    if (module.cloudinaryUrl) {
      console.log('👀 Redirecting to Cloudinary view URL');
      
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
      return res.redirect(module.cloudinaryUrl);
    }
    
    // Legacy file handling - local files
    let filePath;
    if (path.isAbsolute(module.filePath)) {
      // Old format: absolute path
      filePath = module.filePath;
    } else {
      // New format: relative path (filename only)
      filePath = path.join(__dirname, '..', 'uploads', 'modules', module.filePath);
    }
    
    console.log('👀 Constructed local file path:', filePath);
    console.log('👀 File exists:', fs.existsSync(filePath));
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found at path:', filePath);
      return res.status(404).json({ message: 'File not found on server - files are now stored in cloud storage' });
    }
    
    res.setHeader('Content-Type', module.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${module.fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('❌ Error viewing module:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a module
router.delete('/:id', async (req, res) => {
  try {
    const module = await Module.findById(req.params.id);
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    
    console.log('🗑️ Deleting module:', module.title);
    
    // Delete from Cloudinary if it's a cloud file
    if (module.publicId && module.cloudinaryUrl) {
      try {
        console.log('🗑️ Deleting from Cloudinary:', module.publicId);
        await cloudinary.uploader.destroy(module.publicId, { resource_type: module.resourceType || 'raw' });
        console.log('✅ File deleted from Cloudinary successfully');
      } catch (cloudinaryError) {
        console.warn('⚠️ Could not delete file from Cloudinary:', cloudinaryError.message);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }
    
    // Delete legacy local file if it exists
    if (module.filePath && !module.cloudinaryUrl) {
      let filePath;
      if (path.isAbsolute(module.filePath)) {
        filePath = module.filePath;
      } else {
        filePath = path.join(__dirname, '..', 'uploads', 'modules', module.filePath);
      }
      
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('✅ Legacy file deleted from filesystem');
        } catch (fsError) {
          console.warn('⚠️ Could not delete legacy file:', fsError.message);
        }
      }
    }
    
    // Delete from database
    await Module.findByIdAndDelete(req.params.id);
    
    console.log('✅ Module deleted successfully from database');
    res.json({ message: 'Module deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting module:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get module info by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Get module info request for ID:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ message: 'Invalid module ID format' });
    }
    
    const module = await Module.findById(id)
      .populate('uploadedBy', 'name email');
    
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    
    res.json(module);
  } catch (error) {
    console.error('Error fetching module:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Check if module file exists without streaming it
router.get('/check/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid module ID format' });
    }
    
    const module = await Module.findById(id);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    
    // Handle both old absolute paths and new relative paths
    let filePath;
    if (path.isAbsolute(module.filePath)) {
      filePath = module.filePath;
    } else {
      filePath = path.join(__dirname, '..', 'uploads', 'modules', module.filePath);
    }
    
    const fileExists = fs.existsSync(filePath);
    
    res.json({
      moduleId: module._id,
      title: module.title,
      fileName: module.fileName,
      storedPath: module.filePath,
      resolvedPath: filePath,
      fileExists: fileExists,
      fileSize: module.fileSize,
      mimeType: module.mimeType
    });
    
  } catch (error) {
    console.error('Error checking module:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Debug endpoint to check and fix module file paths
router.get('/debug/fix-paths', async (req, res) => {
  try {
    const modules = await Module.find({});
    const results = [];
    
    for (const module of modules) {
      const result = {
        id: module._id,
        title: module.title,
        originalPath: module.filePath,
        isAbsolute: path.isAbsolute(module.filePath),
        fileExists: false
      };
      
      // Check if file exists with current path
      if (path.isAbsolute(module.filePath)) {
        result.fileExists = fs.existsSync(module.filePath);
      } else {
        const constructedPath = path.join(__dirname, '..', 'uploads', 'modules', module.filePath);
        result.fileExists = fs.existsSync(constructedPath);
        result.constructedPath = constructedPath;
      }
      
      results.push(result);
    }
    
    res.json({
      message: 'Module path debug information',
      totalModules: modules.length,
      modules: results
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cleanup endpoint - Delete all modules without Cloudinary URL
router.get('/cleanup/legacy', async (req, res) => {
  try {
    // Find all modules without cloudinaryUrl
    const legacyModules = await Module.find({ 
      $or: [
        { cloudinaryUrl: { $exists: false } },
        { cloudinaryUrl: null },
        { cloudinaryUrl: '' }
      ]
    });
    
    console.log(`🗑️ Found ${legacyModules.length} legacy modules to delete`);
    
    // Delete them
    const result = await Module.deleteMany({
      $or: [
        { cloudinaryUrl: { $exists: false } },
        { cloudinaryUrl: null },
        { cloudinaryUrl: '' }
      ]
    });
    
    console.log(`✅ Deleted ${result.deletedCount} legacy modules`);
    
    res.json({
      message: 'Legacy modules cleaned up successfully',
      deletedCount: result.deletedCount,
      modules: legacyModules.map(m => ({ id: m._id, title: m.title, fileName: m.fileName }))
    });
  } catch (error) {
    console.error('❌ Error cleaning up legacy modules:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;