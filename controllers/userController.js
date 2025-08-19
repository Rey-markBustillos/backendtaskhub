const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Helper to remove password before sending user data
const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  return obj;
};

// GET /api/users - Get all users, optionally filtered by role
exports.getUsers = async (req, res) => {
  try {
    const role = req.query.role;
    let query = {};
    if (role) {
      query.role = role;
    }
    const users = await User.find(query).select("-password");
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/users - Create a new user (password will be hashed by model)
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, studentId, teacherId, adminId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Create a user with specific role
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role,
      studentId: role === "student" ? studentId : null,
      teacherId: role === "teacher" ? teacherId : null,
      adminId: role === "admin" ? adminId : null,
      active: true,
    });

    await user.save();
    res.status(201).json(sanitizeUser(user));
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// PUT /api/users/:id - Update user fields (hash password if present)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
      context: "query",
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/users/:id/toggle - Toggle user's active status
exports.toggleActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.active = !user.active;
    await user.save();

    res.json({ message: `User is now ${user.active ? "active" : "inactive"}` });
  } catch (error) {
    console.error("Toggle active status error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/users/:id - Delete user by ID
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/users/add-student - Add a student subdocument to a user
exports.addStudent = async (req, res) => {
  try {
    const { userId, name, subject, time, room } = req.body;

    if (!userId || !name || !subject || !time || !room) {
      return res.status(400).json({ message: "All student fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.students.push({ name, subject, time, room });
    await user.save();

    res.json(sanitizeUser(user));
  } catch (error) {
    console.error("Add student error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/users/login - Authenticate user and respond with user info (no password)
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.active) {
      return res.status(403).json({ message: "User account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json(sanitizeUser(user));
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
