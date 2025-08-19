const express = require('express');
const router = express.Router();

const classController = require('../controllers/classController'); // <-- FIXED: import as classController

// Destructure all controller functions
const {
  getAllClasses,
  createClass,
  deleteClass,
  updateClassStudents,
  getClassById,
  updateClass,
  getClassesByStudent // <-- add this
} = classController;

// Get all classes (admin/teacher) or create class
router.route('/')
  .get(getAllClasses)
  .post(createClass);

// Get, update, or delete a class by ID
router.route('/:id')
  .get(getClassById)
  .delete(deleteClass)
  .put(updateClass);

// Update students in a class
router.route('/:id/students')
  .put(updateClassStudents);

// GET all classes for a student (student view only)
router.get('/my-classes/:studentId', getClassesByStudent);

// REMOVE the duplicate and inline async route below!
// (delete this block)
// router.get('/my-classes/:studentId', async (req, res) => { ... });

module.exports = router;