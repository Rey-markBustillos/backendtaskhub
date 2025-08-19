const Activity = require('../models/Activity');
const Class = require('../models/Class');
const Submission = require('../models/Submission');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ============================
// Create activity
// ============================
exports.createActivity = async (req, res) => {
  try {
    const { title, description, date, totalPoints, link, createdBy, classId } = req.body;
    let attachmentPath = null;

    if (req.file) {
      attachmentPath = req.file.path.replace(/\\/g, '/').replace(/^.*uploads\//, 'uploads/');
    }

    if (!title || !date || !classId) {
      return res.status(400).json({ message: 'Title, date, and classId are required.' });
    }

    const activity = new Activity({
      title,
      description,
      date,
      totalPoints,
      link,
      attachment: attachmentPath,
      createdBy,
      classId,
    });

    const savedActivity = await activity.save();
    res.status(201).json(savedActivity);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ message: 'Error creating activity', error: error.message });
  }
};

// ============================
// Get all activities
// ============================
exports.getActivities = async (req, res) => {
  try {
    const filter = {};
    if (req.query.classId && mongoose.Types.ObjectId.isValid(req.query.classId)) {
      filter.classId = req.query.classId;
    }

    const activities = await Activity.find(filter).sort({ date: -1 });
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Error fetching activities', error: error.message });
  }
};

// ============================
// Get single activity
// ============================
exports.getActivityById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid activity ID' });
    }

    const activity = await Activity.findById(id);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ message: 'Error fetching activity', error: error.message });
  }
};

// ============================
// Update activity
// ============================
exports.updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid activity ID' });
    }

    let updateData = { ...req.body };
    if (req.file) {
      updateData.attachment = req.file.path.replace(/\\/g, '/').replace(/^.*uploads\//, 'uploads/');
    }

    const updated = await Activity.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ message: 'Error updating activity', error: error.message });
  }
};

// ============================
// Delete activity
// ============================
exports.deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid activity ID' });
    }

    await Submission.deleteMany({ activityId: id });

    const deleted = await Activity.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    res.json({ message: 'Activity and associated submissions deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ message: 'Error deleting activity', error: error.message });
  }
};

// ============================
// Teacher Activity Submissions
// ============================
exports.getActivitySubmissionsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { classId } = req.query;

    if (!teacherId || !classId) {
      return res.status(400).json({ message: 'Teacher ID and Class ID are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(teacherId) || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const targetClass = await Class.findOne({ _id: classId, teacher: teacherId });
    if (!targetClass) {
      return res.status(403).json({ message: 'Access denied or class not found.' });
    }

    const activitiesInClass = await Activity.find({ classId: classId }).select('_id');
    const activityIds = activitiesInClass.map(activity => activity._id);

    const submissions = await Submission.find({ activityId: { $in: activityIds } })
      .populate('studentId', 'name email')
      .populate('activityId', 'title date')
      .sort({ submissionDate: -1 });

    // add fileUrl
    const host = `${req.protocol}://${req.get('host')}`;
    const submissionsWithUrl = submissions.map(s => ({
      ...s.toObject(),
      fileUrl: s.filePath ? `${host}/${s.filePath.replace(/\\/g, '/')}` : null
    }));

    res.json({ submissions: submissionsWithUrl });
  } catch (error) {
    console.error('Error fetching activity submissions:', error);
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
};

// ============================
// Get all submissions for a student in a class
// ============================
exports.getSubmissionsForStudentInClass = async (req, res) => {
  try {
    const { classId, studentId } = req.query;

    if (!classId || !studentId) {
      return res.status(400).json({ message: 'classId and studentId are required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid classId or studentId.' });
    }

    // FIX: Get all activities in the class, then get submissions for those activities
    const activities = await Activity.find({ classId });
    const activityIds = activities.map(a => a._id);

    const submissions = await Submission.find({
      activityId: { $in: activityIds },
      studentId: studentId
    });

    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
};

// ============================
// Update activity score
// ============================
exports.updateActivityScore = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { score } = req.body;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid Submission ID format' });
    }
    if (score === undefined || score === null) {
      return res.status(400).json({ message: 'Score is required' });
    }
    const scoreNumber = Number(score);
    if (isNaN(scoreNumber)) {
      return res.status(400).json({ message: 'Score must be a number' });
    }

    const updatedSubmission = await Submission.findByIdAndUpdate(
      submissionId,
      { score: scoreNumber, status: 'Graded' },
      { new: true, runValidators: true }
    );

    if (!updatedSubmission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(updatedSubmission);
  } catch (error) {
    console.error('Error updating submission score:', error);
    res.status(500).json({ message: 'Error updating submission score', error: error.message });
  }
};

// ============================
// Submit Activity
// ============================
exports.submitActivity = async (req, res) => {
  try {
    const { activityId, studentId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file was uploaded.' });
    }
    if (!activityId || !studentId) {
      return res.status(400).json({ message: 'Activity ID and Student ID are required.' });
    }

    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found.' });
    }

    const existingSubmission = await Submission.findOne({ activityId, studentId });
    if (existingSubmission) {
      return res.status(409).json({ message: 'You have already submitted this activity. Please use the resubmit option.' });
    }

    const submission = new Submission({
      activityId,
      studentId,
      submissionDate: new Date(),
      filePath: req.file.path.replace(/\\/g, '/').replace(/^.*uploads\//, 'uploads/'),
      fileName: req.file.originalname,
      score: null
    });

    const savedSubmission = await submission.save();
    res.status(201).json(savedSubmission);
  } catch (error) {
    console.error('Error submitting activity:', error);
    res.status(500).json({ message: 'Error submitting activity', error: error.message });
  }
};

// ============================
// Resubmit Activity
// ============================
exports.resubmitActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No file was uploaded for resubmission.' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Submission ID.' });
    }

    const updatedSubmission = await Submission.findByIdAndUpdate(
      id,
      {
        filePath: req.file.path.replace(/\\/g, '/').replace(/^.*uploads\//, 'uploads/'),
        fileName: req.file.originalname,
        submissionDate: new Date(),
        status: 'Resubmitted',
        score: null,
      },
      { new: true }
    );

    if (!updatedSubmission) {
      return res.status(404).json({ message: 'Submission not found to update.' });
    }

    res.status(200).json(updatedSubmission);
  } catch (error) {
    console.error('Error resubmitting activity:', error);
    res.status(500).json({ message: 'Error resubmitting activity', error: error.message });
  }
};

// ============================
// Delete submission
// ============================
exports.deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Submission ID.' });
    }

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found.' });
    }

    if (submission.filePath) {
      const filePath = path.join(__dirname, '..', submission.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete submission file from disk:', err);
        });
      }
    }

    await Submission.findByIdAndDelete(id);
    res.status(200).json({ message: 'Submission deleted successfully.' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ message: 'Error deleting submission', error: error.message });
  }
};

// ============================
// Get submission for activity
// ============================
exports.getSubmissionForActivity = async (req, res) => {
  try {
    const { activityId, studentId } = req.query;
    if (!activityId || !studentId) {
      return res.status(400).json({ message: 'activityId and studentId are required query parameters.' });
    }

    const submission = await Submission.findOne({ activityId, studentId });
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found.' });
    }

    res.json(submission);
  } catch (error) {
    console.error('Error fetching single submission:', error);
    res.status(500).json({ message: 'Error fetching submission', error: error.message });
  }
};

// ============================
// Get all submissions for student
// ============================
exports.getStudentSubmissions = async (req, res) => {
  try {
    const { studentId } = req.params;

    const submissions = await Submission.find({ studentId })
      .populate("activityId", "title description dueDate")
      .sort({ submissionDate: -1 });

    const formatted = submissions.map((s) => ({
      ...s.toObject(),
      fileUrl: s.filePath
        ? `${req.protocol}://${req.get("host")}/${s.filePath}`
        : null,
    }));

    res.json({ submissions: formatted });
  } catch (error) {
    res.status(500).json({ message: "Error fetching submissions", error });
  }
};

// ============================
// Download Activity Attachment
// ============================
exports.downloadActivityAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid activity ID' });
    }

    const activity = await Activity.findById(id);
    if (!activity || !activity.attachment) {
      return res.status(404).json({ message: 'Attachment not found for this activity.' });
    }

    const filePath = path.join(__dirname, '..', activity.attachment);
    if (fs.existsSync(filePath)) {
      res.download(filePath, path.basename(activity.attachment));
    } else {
      res.status(404).json({ message: 'File not found on server.' });
    }
  } catch (error) {
    console.error('Error downloading activity attachment:', error);
    res.status(500).json({ message: 'Error downloading file', error: error.message });
  }
};

// ============================
// Download Submission File
// ============================
exports.downloadSubmissionFile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid submission ID' });
    }

    const submission = await Submission.findById(id);
    if (!submission || !submission.filePath) {
      return res.status(404).json({ message: 'Submission file not found.' });
    }

    const filePath = path.join(__dirname, '..', submission.filePath);
    if (fs.existsSync(filePath)) {
      res.download(filePath, submission.fileName);
    } else {
      res.status(404).json({ message: 'File not found on server.' });
    }
  } catch (error) {
    console.error('Error downloading submission file:', error);
    res.status(500).json({ message: 'Error downloading file', error: error.message });
  }
};

// ============================
// Export Scores
// ============================
exports.exportScores = async (req, res) => {
  try {
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ message: 'classId is required' });

    const activities = await Activity.find({ classId }).sort({ date: 1 });
    const targetClass = await Class.findById(classId).populate('students', 'name email');
    if (!targetClass) return res.status(404).json({ message: 'Class not found' });

    const activityIds = activities.map(a => a._id);
    const submissions = await Submission.find({ activityId: { $in: activityIds } });

    const studentScores = {};
    submissions.forEach(sub => {
      if (!studentScores[sub.studentId]) studentScores[sub.studentId] = {};
      studentScores[sub.studentId][sub.activityId] = sub.score;
    });

    const exportData = targetClass.students.map(student => {
      const row = { Name: student.name, Email: student.email };
      activities.forEach(act => {
        row[act.title] = studentScores[student._id]?.[act._id] ?? '';
      });
      return row;
    });

    res.json({ exportData, activityTitles: activities.map(a => a.title) });
  } catch (error) {
    console.error('Error exporting scores:', error);
    res.status(500).json({ message: 'Error exporting scores', error: error.message });
  }
};