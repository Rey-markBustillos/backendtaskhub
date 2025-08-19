const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

// Routes
const userRoutes = require('./routes/userRoutes');
const classRoutes = require('./routes/classRoutes');
const activityRoutes = require('./routes/activityRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const scheduleRoutes = require('./routes/schedule');

// ADD: Import submission routes
const submissionRoutes = require('./routes/submissionRoutes');

dotenv.config();

// Connect to MongoDB
connectDB().catch((err) => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

const app = express();

// Middleware
app.use(
  cors({
    origin: '*', // Adjust in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json());

// Ensure uploads folder exists
const uploadDirActivities = path.join(__dirname, 'uploads', 'activities');
if (!fs.existsSync(uploadDirActivities)) {
  fs.mkdirSync(uploadDirActivities, { recursive: true });
  console.log('Created uploads/activities directory');
}

const uploadDirSubmissions = path.join(__dirname, 'uploads', 'submissions');
if (!fs.existsSync(uploadDirSubmissions)) {
  fs.mkdirSync(uploadDirSubmissions, { recursive: true });
  console.log('Created uploads/submissions directory');
}

// Serve static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/class', classRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/schedule', scheduleRoutes);

// ADD: Mount submission routes (for /api/submissions/student/:studentId)
app.use('/api/submissions', submissionRoutes);

// 404 handler (keep this AFTER all routes)
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler (keep this LAST)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});