const express = require('express');
const mongoose = require('mongoose');
const Site = require('../models/Site');
const Project = require('../models/Project');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);
router.use(verifyCsrf);

/**
 * 1. GET /api/sites - Retrieve sites with project details and site-scoping
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.project) {
      filter.project = req.query.project;
    }

    // Role-based scoping for non-owners: non-owners only see their assigned sites
    if (req.user.role !== 'Owner') {
      const assigned = req.user.assignedSites || [];
      filter.name = { $in: assigned };
    }

    const sites = await Site.find(filter).populate('project', 'name code').sort({ name: 1 });
    res.status(200).json(sites);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving sites: ' + error.message });
  }
});

/**
 * 2. POST /api/sites - Create a new construction site (Owner only)
 */
router.post('/', requirePermission(PERMISSIONS.SITES_MANAGE), async (req, res) => {
  try {
    const { name, code, project, address, status } = req.body;

    if (!name || !code || !project) {
      return res.status(400).json({ message: 'Site name, code, and project are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(project)) {
      return res.status(400).json({ message: 'Invalid project ID format.' });
    }

    const projectExists = await Project.findById(project);
    if (!projectExists) {
      return res.status(404).json({ message: 'Referenced project does not exist.' });
    }

    const existingCode = await Site.findOne({ code: code.trim().toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ message: `Site code '${code.trim().toUpperCase()}' is already in use.` });
    }

    const site = new Site({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      project,
      address: address ? address.trim() : '',
      status: status || 'Active'
    });

    const saved = await site.save();
    const populated = await Site.findById(saved._id).populate('project', 'name code');
    res.status(201).json({ message: 'Site created successfully!', site: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error creating site: ' + error.message });
  }
});

/**
 * 3. PUT /api/sites/:id - Update an existing site (Owner only)
 */
router.put('/:id', requirePermission(PERMISSIONS.SITES_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid site ID format' });
    }

    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    const { name, project, address, status } = req.body;
    if (name) site.name = name.trim();
    if (address !== undefined) site.address = address.trim();
    if (status) site.status = status;
    if (project) {
      if (!mongoose.Types.ObjectId.isValid(project)) {
        return res.status(400).json({ message: 'Invalid project ID format.' });
      }
      site.project = project;
    }

    const updated = await site.save();
    const populated = await Site.findById(updated._id).populate('project', 'name code');
    res.status(200).json({ message: 'Site updated successfully!', site: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating site: ' + error.message });
  }
});

module.exports = router;
