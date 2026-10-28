const express = require('express');
const mongoose = require('mongoose');
const WastageRecord = require('../models/WastageRecord');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);
router.use(verifyCsrf);

/**
 * 1. GET /api/wastage - Retrieve physical wastage register with role/site scoping
 */
router.get('/', requirePermission(PERMISSIONS.WASTAGE_READ), async (req, res) => {
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

    if (req.query.site) filter.site = req.query.site;
    if (req.query.reason) filter.reason = req.query.reason;

    const records = await WastageRecord.find(filter)
      .populate('project', 'name code')
      .populate('stockMovement')
      .sort({ date: -1 })
      .limit(200);

    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving wastage records: ' + error.message });
  }
});

/**
 * 2. POST /api/wastage - Record physical wastage and atomically update stock ledger
 * Guarantees stock is deducted once and linked to a StockMovement ledger entry.
 */
router.post('/', requirePermission(PERMISSIONS.WASTAGE_RECORD), async (req, res) => {
  try {
    const { materialId, quantity, reason, notes } = req.body;

    if (!materialId || !quantity || Number(quantity) <= 0 || !reason) {
      return res.status(400).json({
        message: 'Material ID, positive wasted quantity, and valid reason are required.'
      });
    }

    const validReasons = ['Breakage', 'Spillage', 'Cutting Loss', 'Storage Damage', 'Expiry', 'Other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        message: `Invalid reason. Allowed: ${validReasons.join(', ')}`
      });
    }

    const numQty = Number(quantity);

    // Atomic conditional decrement: Prevents deducting more than available stock
    const updatedItem = await InventoryItem.findOneAndUpdate(
      { _id: materialId, quantity: { $gte: numQty } },
      { $inc: { quantity: -numQty } },
      { new: true }
    );

    if (!updatedItem) {
      const existing = await InventoryItem.findById(materialId);
      if (!existing) return res.status(404).json({ message: 'Inventory item not found.' });
      return res.status(400).json({
        message: `Insufficient stock! Cannot write off ${numQty} ${existing.unit}. Current stock is only ${existing.quantity} ${existing.unit}.`
      });
    }

    // Site permission check
    if (req.user.role !== 'Owner' && updatedItem.site !== 'General Site' && !(req.user.assignedSites || []).includes(updatedItem.site)) {
      // Revert decrement if unauthorized site
      await InventoryItem.findByIdAndUpdate(materialId, { $inc: { quantity: numQty } });
      return res.status(403).json({ message: `Forbidden: No access to report wastage for site '${updatedItem.site}'` });
    }

    const financialImpact = Number((numQty * (updatedItem.unitCost || 0)).toFixed(2));

    // 1. Create StockMovement ledger entry
    const movement = new StockMovement({
      material: updatedItem._id,
      materialName: updatedItem.itemName,
      site: updatedItem.site || 'General Site',
      project: updatedItem.project || null,
      movementType: 'wastage',
      quantity: numQty,
      unit: updatedItem.unit,
      unitCost: updatedItem.unitCost || 0,
      totalValue: financialImpact,
      reference: `Physical Wastage [${reason}]`,
      reason: `Wastage write-off (${reason}): ${notes || 'Site damage/loss'}`,
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      recordedByRole: req.user.role,
      status: 'completed',
      notes: notes ? notes.trim() : ''
    });

    const savedMovement = await movement.save();

    // 2. Create WastageRecord referencing the ledger entry
    const wastage = new WastageRecord({
      material: updatedItem._id,
      materialName: updatedItem.itemName,
      project: updatedItem.project || null,
      site: updatedItem.site || 'General Site',
      quantity: numQty,
      unit: updatedItem.unit,
      reason,
      unitCost: updatedItem.unitCost || 0,
      financialImpact,
      notes: notes ? notes.trim() : '',
      reportingUser: req.user._id,
      reportingUserName: req.user.name,
      stockMovement: savedMovement._id,
      date: new Date()
    });

    const savedWastage = await wastage.save();

    res.status(201).json({
      message: `Recorded ${numQty} ${updatedItem.unit} of ${updatedItem.itemName} as physical waste (${reason}). Stock balance: ${updatedItem.quantity}`,
      wastage: savedWastage,
      stockMovement: savedMovement,
      remainingStock: updatedItem.quantity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error recording wastage: ' + error.message });
  }
});

module.exports = router;
