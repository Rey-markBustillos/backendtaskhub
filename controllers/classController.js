const Class = require('../models/Class');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
const mongoose = require('mongoose');

// GET /api/class - Kunin lahat ng klase
const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find({})
      .populate('teacher', 'name email')
      .populate('students', 'name email')
      .sort({ createdAt: -1 });
    res.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Server error while fetching classes' });
  }
};

// POST /api/class - Gumawa ng bagong klase
const createClass = async (req, res) => {
  const { className, teacher, time, day, roomNumber } = req.body;

  try {
    if (!className || !teacher || !day) {
      return res.status(400).json({ message: 'Class Name, Teacher, and Day are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(teacher)) {
      return res.status(400).json({ message: 'Invalid Teacher ID format' });
    }
    const teacherExists = await User.findById(teacher);
    if (!teacherExists || teacherExists.role !== 'teacher') {
      return res.status(400).json({ message: 'A valid teacher ID is required' });
    }

    // Always save time as string "HH:mm"
    const newClass = new Class({
      className,
      teacher,
      time: typeof time === 'string' ? time : '',
      day,
      roomNumber,
      students: [],
    });

    const savedClass = await newClass.save();
    const populatedClass = await Class.findById(savedClass._id)
      .populate('teacher', 'name email')
      .populate('students', 'name email');
    res.status(201).json(populatedClass);
  } catch (error) {
    console.error('Error creating class:', error);

    if (error.code === 11000) {
      return res.status(409).json({ message: `Class with name '${error.keyValue.className}' already exists.` });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error while creating class' });
  }
};

// DELETE /api/class/:id - Burahin ang klase
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid class ID' });
    }
    await Announcement.deleteMany({ classId: id });
    const deletedClass = await Class.findByIdAndDelete(id);
    if (!deletedClass) {
      return res.status(404).json({ message: 'Class not found' });
    }
    res.json({ message: 'Class and associated announcements deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ message: 'Error deleting class' });
  }
};

// PUT /api/class/:id/students - I-update ang mga estudyante sa klase
const updateClassStudents = async (req, res) => {
  try {
    const classId = req.params.id;
    const { studentIds } = req.body;
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'Invalid Class ID' });
    }
    if (!Array.isArray(studentIds)) {
      return res.status(400).json({ message: 'studentIds must be an array' });
    }
    const classFound = await Class.findById(classId);
    if (!classFound) {
      return res.status(404).json({ message: 'Class not found' });
    }
    classFound.students = studentIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    await classFound.save();
    const populatedClass = await Class.findById(classId)
      .populate('teacher', 'name email')
      .populate('students', 'name email');
    res.json(populatedClass);
  } catch (error) {
    console.error('Error updating students in class:', error);
    res.status(500).json({ message: 'Error updating students' });
  }
};

// GET /api/class/:id - Kunin ang isang klase by ID
const getClassById = async (req, res) => {
  try {
    const classId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'Invalid Class ID' });
    }
    const classData = await Class.findById(classId)
      .populate('teacher', 'name email')
      .populate('students', 'name email');
    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }
    res.json(classData);
  } catch (error) {
    console.error(`Error fetching class by ID: ${req.params.id}`, error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/class/:id - I-update ang class details
const updateClass = async (req, res) => {
  const { id } = req.params;
  const { className, teacher, time, day, roomNumber } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid class ID' });
    }
    if (!className || !teacher || !day) {
      return res.status(400).json({ message: 'Class Name, Teacher, and Day are required' });
    }
    // Always save time as string "HH:mm"
    const updated = await Class.findByIdAndUpdate(
      id,
      { className, teacher, time: typeof time === 'string' ? time : '', day, roomNumber },
      { new: true, runValidators: true }
    ).populate('teacher', 'name email').populate('students', 'name email');
    if (!updated) {
      return res.status(404).json({ message: 'Class not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ message: 'Server error while updating class' });
  }
};

// GET /api/class/my-classes/:studentId - Kunin lang ang classes na enrolled ang student
const getClassesByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }
    const classes = await Class.find({ students: studentId })
      .populate('teacher', 'name email')
      .populate('students', 'name email')
      .sort({ createdAt: -1 });
    res.json(classes);
  } catch (error) {
    console.error('Error fetching student classes:', error);
    res.status(500).json({ message: 'Server error while fetching student classes' });
  }
};

module.exports = {
  getAllClasses,
  createClass,
  deleteClass,
  updateClassStudents,
  updateClass,
  getClassById,
  getClassesByStudent
};