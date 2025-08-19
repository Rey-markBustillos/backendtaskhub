const express = require('express');
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

// Routes for creating and getting all announcements
router.route('/')
  .get(getAllAnnouncements)
  .post(createAnnouncement);

// Routes for a specific announcement by ID
router.route('/:id')
  .get(getAnnouncementById)
  .put(updateAnnouncement)
  .delete(deleteAnnouncement);

// Route for adding a comment
router.route('/:id/comments').post(addComment);

// Route for toggling a reaction
router.route('/:id/reactions').post(toggleReaction);

// AYOS: Bagong route para sa pag-view
router.route('/:id/view').post(markAsViewed);

module.exports = router;