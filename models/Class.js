const mongoose = require('mongoose');

// In models/Class.js
const classSchema = new mongoose.Schema({
  className: { type: String, required: true, unique: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  time: { type: String }, // store as "HH:mm"
  day: { type: String, required: true },
  roomNumber: { type: String },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const Class = mongoose.model('Class', classSchema);

module.exports = Class;