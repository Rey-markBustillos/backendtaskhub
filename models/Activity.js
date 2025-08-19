const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  score: { type: Number },
  link: { type: String },
  attachment: { type: String }, // could be a file path or URL
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Activity', ActivitySchema);