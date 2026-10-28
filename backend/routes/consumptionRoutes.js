const express = require('express');
const mongoose = require('mongoose');
const ConsumptionRecord = require('../models/ConsumptionRecord');
const InventoryItem = require('../models/InventoryItem');
const Project = require('../models/Project');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);
router.use(verifyCsrf);

/**
 * 1. GET /api/consumption - Retrieve consumption records with site scoping and variance metrics
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};

    // Site scoping for non-owners: non-owners only see their assigned sites; 0 assigned sites = 0 data
    if (req.user.role !== 'Owner') {
      const assigned = req.user.assignedSites || [];
      if (assigned.length === 0) {
        return res.status(200).json([]);
      }
      filter.site = { $in: assigned };
    }

    if (req.query.site) {
      filter.site = req.query.site;
    }
    if (req.query.project) {
      filter.project = req.query.project;
    }

    const records = await ConsumptionRecord.find(filter)
      .populate('project', 'name code')
      .populate('material', 'itemName category unit')
      .sort({ reportDate: -1 })
      .limit(200);

    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving consumption records: ' + error.message });
  }
});

/**
 * 2. POST /api/consumption - Record planned versus actual consumption
 */
router.post('/', requirePermission(PERMISSIONS.CONSUMPTION_RECORD), async (req, res) => {
  try {
    const { project, activity, materialId, expectedQty, actualQty, varianceReason } = req.body;

    if (!activity || !materialId || expectedQty === undefined || actualQty === undefined) {
      return res.status(400).json({
        message: 'Activity, material ID, expected quantity, and actual quantity consumed are required.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID format' });
    }

    const numExpected = Number(expectedQty);
    const numActual = Number(actualQty);

    if (isNaN(numExpected) || isNaN(numActual) || numExpected < 0 || numActual < 0) {
      return res.status(400).json({ message: 'Expected and actual quantities must be non-negative numbers.' });
    }

    const material = await InventoryItem.findById(materialId);
    if (!material) {
      return res.status(404).json({ message: 'Material not found.' });
    }

    const effectiveSite = material.site || (req.body.site ? req.body.site.trim() : 'General Site');

    // Site permission check strictly against the material's site (no bypass)
    if (req.user.role !== 'Owner' && !(req.user.assignedSites || []).includes(effectiveSite)) {
      return res.status(403).json({ message: `Forbidden: No access to record consumption for site '${effectiveSite}'` });
    }

    let projectName = '';
    const projId = project || material.project;
    if (projId && mongoose.Types.ObjectId.isValid(projId)) {
      const prj = await Project.findById(projId);
      if (prj) projectName = prj.name;
    }

    const record = new ConsumptionRecord({
      project: projId && mongoose.Types.ObjectId.isValid(projId) ? projId : null,
      projectName,
      site: effectiveSite,
      activity: activity.trim(),
      material: material._id,
      materialName: material.itemName,
      expectedQty: numExpected,
      actualQty: numActual,
      unit: material.unit,
      varianceReason: varianceReason ? varianceReason.trim() : '',
      reportingUser: req.user._id,
      reportingUserName: req.user.name,
      reportDate: new Date()
    });

    const saved = await record.save();

    res.status(201).json({
      message: 'Consumption record created successfully!',
      record: saved,
      excessQty: saved.excessQty,
      excessPercentage: saved.excessPercentage
    });
  } catch (error) {
    res.status(500).json({ message: 'Error recording consumption: ' + error.message });
  }
});

module.exports = router;
