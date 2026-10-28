const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Site = require('../models/Site');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);
router.use(verifyCsrf);

/**
 * 1. GET /api/projects - Retrieve projects (Company-wide for Owner, scoped for non-owners)
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.user.role !== 'Owner') {
      const assigned = req.user.assignedSites || [];
      if (assigned.length === 0) {
        return res.status(200).json([]);
      }
      const userSites = await Site.find({ name: { $in: assigned } }).select('project');
      const projectIds = userSites.map((s) => s.project).filter(Boolean);
      filter._id = { $in: projectIds };
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving projects: ' + error.message });
  }
});

/**
 * 2. POST /api/projects - Create a new project (Owner only)
 */
router.post('/', requirePermission(PERMISSIONS.PROJECTS_MANAGE), async (req, res) => {
  try {
    const { name, code, description, location, status, budget } = req.body;

    if (!name || !code) {
      return res.status(400).json({ message: 'Project name and unique code are required.' });
    }

    const existing = await Project.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: `Project code '${code.trim().toUpperCase()}' is already in use.` });
    }

    const project = new Project({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : '',
      location: location ? location.trim() : '',
      status: status || 'Active',
      budget: budget ? Math.max(0, Number(budget)) : 0
    });

    const saved = await project.save();
    res.status(201).json({ message: 'Project created successfully!', project: saved });
  } catch (error) {
    res.status(500).json({ message: 'Error creating project: ' + error.message });
  }
});

/**
 * 3. PUT /api/projects/:id - Update an existing project
 */
router.put('/:id', requirePermission(PERMISSIONS.PROJECTS_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { name, description, location, status, budget } = req.body;
    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (location !== undefined) project.location = location.trim();
    if (status) project.status = status;
    if (budget !== undefined) project.budget = Math.max(0, Number(budget));

    const updated = await project.save();
    res.status(200).json({ message: 'Project updated successfully!', project: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating project: ' + error.message });
  }
});

module.exports = router;
