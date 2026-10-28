const express = require('express');
const { User, ROLES } = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Site = require('../models/Site');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// All user management routes require authentication and users.manage permission (Owner only)
router.use(authenticate);
router.use(requirePermission(PERMISSIONS.USERS_MANAGE));
router.use(verifyCsrf);

/**
 * 1. GET /api/users - List all users
 */
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving users: ' + error.message });
  }
});

/**
 * 2. POST /api/users - Create a new user with specific role & assigned sites
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, assignedSites, assignedProjects } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: 'Name, email, password, and role are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long.'
      });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Allowed roles: ${ROLES.join(', ')}`
      });
    }

    // Check if email already registered
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({
        message: 'A user with this email address already exists.'
      });
    }

    // Validate assigned sites exist in the system
    if (Array.isArray(assignedSites) && assignedSites.length > 0) {
      const validSites = await Site.find({ name: { $in: assignedSites } }).select('name');
      const validNames = validSites.map((s) => s.name);
      const invalid = assignedSites.filter((s) => !validNames.includes(s));
      if (invalid.length > 0) {
        return res.status(400).json({
          message: `The following assigned sites do not exist in the system: ${invalid.join(', ')}`
        });
      }
    }

    const passwordHash = await User.hashPassword(password);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      assignedSites: Array.isArray(assignedSites) ? assignedSites : [],
      assignedProjects: Array.isArray(assignedProjects) ? assignedProjects : [],
      isActive: true
    });

    const savedUser = await newUser.save();

    // Record audit event
    await AuditLog.create({
      action: 'USER_CREATED',
      performedBy: req.user._id,
      performedByEmail: req.user.email,
      performedByRole: req.user.role,
      targetResource: 'User',
      targetId: savedUser._id.toString(),
      details: {
        createdUserEmail: savedUser.email,
        assignedRole: savedUser.role,
        assignedSites: savedUser.assignedSites
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'User created successfully',
      user: savedUser.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user: ' + error.message });
  }
});

/**
 * 3. PUT /api/users/:id - Update user details (role, sites, name)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, assignedSites, assignedProjects, isActive } = req.body;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent Owner from changing their own role or deactivating their own account
    if (targetUser._id.toString() === req.user._id.toString()) {
      if (role && role !== 'Owner') {
        return res.status(400).json({
          message: 'You cannot revoke your own Owner role.'
        });
      }
      if (isActive === false) {
        return res.status(400).json({
          message: 'You cannot deactivate your own active Owner account.'
        });
      }
    }

    if (role && !ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Allowed roles: ${ROLES.join(', ')}`
      });
    }

    // Validate assigned sites exist in the system
    if (Array.isArray(assignedSites) && assignedSites.length > 0) {
      const validSites = await Site.find({ name: { $in: assignedSites } }).select('name');
      const validNames = validSites.map((s) => s.name);
      const invalid = assignedSites.filter((s) => !validNames.includes(s));
      if (invalid.length > 0) {
        return res.status(400).json({
          message: `The following assigned sites do not exist in the system: ${invalid.join(', ')}`
        });
      }
    }

    // Apply allowed fields only (Mass Assignment Protection)
    if (name) targetUser.name = name.trim();
    if (role) targetUser.role = role;
    if (Array.isArray(assignedSites)) targetUser.assignedSites = assignedSites;
    if (Array.isArray(assignedProjects)) targetUser.assignedProjects = assignedProjects;
    if (typeof isActive === 'boolean') targetUser.isActive = isActive;

    const updatedUser = await targetUser.save();

    // Record audit event
    await AuditLog.create({
      action: 'USER_UPDATED',
      performedBy: req.user._id,
      performedByEmail: req.user.email,
      performedByRole: req.user.role,
      targetResource: 'User',
      targetId: updatedUser._id.toString(),
      details: {
        updatedRole: updatedUser.role,
        assignedSites: updatedUser.assignedSites,
        isActive: updatedUser.isActive
      },
      ipAddress: req.ip
    });

    res.status(200).json({
      message: 'User updated successfully',
      user: updatedUser.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user: ' + error.message });
  }
});

/**
 * 4. PATCH /api/users/:id/status - Toggle active/deactive status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive boolean flag is required' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent Owner self-lockout
    if (targetUser._id.toString() === req.user._id.toString() && !isActive) {
      return res.status(400).json({
        message: 'Security protection: You cannot deactivate your own active Owner account.'
      });
    }

    targetUser.isActive = isActive;
    await targetUser.save();

    // Record audit event
    await AuditLog.create({
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      performedBy: req.user._id,
      performedByEmail: req.user.email,
      performedByRole: req.user.role,
      targetResource: 'User',
      targetId: targetUser._id.toString(),
      details: {
        targetUserEmail: targetUser.email,
        isActive
      },
      ipAddress: req.ip
    });

    res.status(200).json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: targetUser.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error modifying user status: ' + error.message });
  }
});

module.exports = router;
