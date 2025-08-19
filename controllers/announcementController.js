const Announcement = require('../models/Announcement');
const mongoose = require('mongoose');

// Helper function para i-populate ang lahat ng necessary fields
const populateFields = (query) => {
  return query
    .populate('postedBy', 'name email')
    .populate({
      path: 'comments',
      populate: { path: 'postedBy', select: 'name' }
    })
    .populate('reactions.user', 'name')
    .populate('viewedBy', 'name');
};

// Create a new announcement
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, postedBy, classId } = req.body;

    if (!title || !content || !postedBy || !classId) {
      return res.status(400).json({ message: 'Title, content, postedBy, and classId are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(postedBy) || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'Invalid user ID or class ID' });
    }

    const newAnnouncement = new Announcement({ title, content, postedBy, classId });
    await newAnnouncement.save();
    const populatedAnnouncement = await populateFields(Announcement.findById(newAnnouncement._id));
    res.status(201).json(populatedAnnouncement);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create announcement', error: error.message });
  }
};

// Get all announcements, filtered by classId or studentId
exports.getAllAnnouncements = async (req, res) => {
  try {
    const { classId, studentId } = req.query;
    let filter = {};

    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      filter.classId = classId;
    } else if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      // Hanapin lahat ng class na kasali ang studentId
      const Class = require('../models/Class');
      const classes = await Class.find({ students: studentId }).select('_id');
      const classIds = classes.map(c => c._id);
      filter.classId = { $in: classIds };
    } else {
      return res.status(400).json({ message: 'A valid classId or studentId is required.' });
    }

    const announcements = await populateFields(Announcement.find(filter)).sort({ datePosted: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch announcements', error: error.message });
  }
};

// Get a single announcement by ID
exports.getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid announcement ID' });
    }
    const announcement = await populateFields(Announcement.findById(id));
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    res.json(announcement);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch announcement', error: error.message });
  }
};

// Update an announcement
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid announcement ID' });
    }
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updatedAnnouncement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    const populatedAnnouncement = await populateFields(Announcement.findById(updatedAnnouncement._id));
    res.json(populatedAnnouncement);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update announcement', error: error.message });
  }
};

// Delete an announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid announcement ID' });
    }
    const deleted = await Announcement.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete announcement', error: error.message });
  }
};

// Add a comment to an announcement
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, postedBy } = req.body;

    if (!text || !postedBy) {
      return res.status(400).json({ message: 'Text and postedBy are required.' });
    }

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { $push: { comments: { text, postedBy } } },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    
    const populatedAnnouncement = await populateFields(Announcement.findById(announcement._id));
    res.status(201).json(populatedAnnouncement);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment.', error: error.message });
  }
};

// Add/remove a reaction from an announcement
exports.toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji, userId } = req.body;

    if (!emoji || !userId) {
      return res.status(400).json({ message: 'Emoji and userId are required.' });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }

    const reactionIndex = announcement.reactions.findIndex(r => r.user.toString() === userId && r.emoji === emoji);

    if (reactionIndex > -1) {
      announcement.reactions.splice(reactionIndex, 1);
    } else {
      announcement.reactions.push({ emoji, user: userId });
    }

    await announcement.save();
    const populatedAnnouncement = await populateFields(Announcement.findById(announcement._id));
    res.json(populatedAnnouncement);
  } catch (error) {
    res.status(400).json({ message: 'Failed to toggle reaction.', error: error.message });
  }
};

// Mark an announcement as viewed by a user
exports.markAsViewed = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' });
    }

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { $addToSet: { viewedBy: userId } },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    
    const populatedAnnouncement = await populateFields(Announcement.findById(announcement._id));
    res.json(populatedAnnouncement);
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark as viewed.', error: error.message });
  }
};