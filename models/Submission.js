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
    type: String // Path to the uploaded file
  },
  fileName: {
    type: String // Original file name
  },
  score: {
    type: Number,
    default: null // Initially no score
  }
});

module.exports = mongoose.model('Submission', submissionSchema);