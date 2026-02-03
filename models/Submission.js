const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  filePath: {
    type: String // Local path (for backward compatibility)
  },
  fileName: {
    type: String // Original file name
  },
  cloudinaryUrl: {
    type: String // Cloudinary public URL
  },
  cloudinaryPublicId: {
    type: String // Cloudinary public ID for deletion
  },
  fileType: {
    type: String // File MIME type
  },
  fileSize: {
    type: Number // File size in bytes
  },
  resourceType: {
    type: String // Cloudinary resource type (image, raw, video, auto)
  },
  content: {
    type: String // Text content for submissions without files
  },
  status: {
    type: String,
    enum: ['Submitted', 'Resubmitted', 'Graded', 'Late'],
    default: 'Submitted'
  },
  score: {
    type: Number,
    default: null // Initially no score
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Submission', submissionSchema);