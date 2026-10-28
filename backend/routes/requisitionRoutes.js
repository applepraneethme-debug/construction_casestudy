const express = require('express');
const mongoose = require('mongoose');
const Requisition = require('../models/Requisition');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);
router.use(verifyCsrf);

/**
 * 1. GET /api/requisitions - View requisitions with role/site scoping
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

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.site) {
      filter.site = req.query.site;
    }

    const requisitions = await Requisition.find(filter)
      .populate('project', 'name code')
      .sort({ createdAt: -1 });

    res.status(200).json(requisitions);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving requisitions: ' + error.message });
  }
});

/**
 * 2. POST /api/requisitions - Site Engineer creates material requisition
 */
router.post('/', requirePermission(PERMISSIONS.REQUISITIONS_CREATE), async (req, res) => {
  try {
    const { project, site, activity, priority, items, notes } = req.body;

    if (!site || !activity || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Site, activity description, and at least one material item are required.'
      });
    }

    // Site permission check
    if (req.user.role !== 'Owner' && !(req.user.assignedSites || []).includes(site)) {
      return res.status(403).json({ message: `Forbidden: No access to create requisition for site '${site}'` });
    }

    // Validate items
    const parsedItems = [];
    for (const item of items) {
      if (!item.material || !item.quantityRequested || Number(item.quantityRequested) <= 0) {
        return res.status(400).json({ message: 'Each item must have a valid material and positive quantity.' });
      }

      const inv = await InventoryItem.findById(item.material);
      if (!inv) {
        return res.status(404).json({ message: `Material with ID ${item.material} not found.` });
      }

      if (inv.site && inv.site !== site.trim()) {
        return res.status(400).json({
          message: `Material '${inv.itemName}' belongs to site '${inv.site}', but requisition is for '${site.trim()}'. Cross-site requisitions are not permitted.`
        });
      }

      parsedItems.push({
        material: inv._id,
        materialName: inv.itemName,
        quantityRequested: Number(item.quantityRequested),
        quantityIssued: 0,
        unit: inv.unit
      });
    }

    // Generate unique requisition number
    const count = await Requisition.countDocuments();
    const reqNum = `REQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const requisition = new Requisition({
      requisitionNumber: reqNum,
      project: project && mongoose.Types.ObjectId.isValid(project) ? project : null,
      site: site.trim(),
      activity: activity.trim(),
      priority: priority || 'Medium',
      items: parsedItems,
      status: 'Pending',
      requestedBy: req.user._id,
      requestedByName: req.user.name,
      requestedByRole: req.user.role,
      notes: notes ? notes.trim() : ''
    });

    const saved = await requisition.save();
    res.status(201).json({ message: `Requisition ${reqNum} created successfully!`, requisition: saved });
  } catch (error) {
    res.status(500).json({ message: 'Error creating requisition: ' + error.message });
  }
});

/**
 * 3. PATCH /api/requisitions/:id/approve - Approve requisition (Material Manager / Owner)
 */
router.patch('/:id/approve', requirePermission(PERMISSIONS.REQUISITIONS_APPROVE), async (req, res) => {
  try {
    const { id } = req.params;
    const requisition = await Requisition.findById(id);

    if (!requisition) {
      return res.status(404).json({ message: 'Requisition not found.' });
    }

    if (requisition.status !== 'Pending') {
      return res.status(400).json({ message: `Cannot approve requisition in status '${requisition.status}'.` });
    }

    // Separation of duties: Cannot approve your own requisition (unless Owner)
    if (req.user.role !== 'Owner' && requisition.requestedBy.toString() === req.user._id.toString()) {
      return res.status(403).json({
        message: 'Separation of duties violation: You cannot approve your own material requisition.'
      });
    }

    // Site permission check
    if (req.user.role !== 'Owner' && !(req.user.assignedSites || []).includes(requisition.site)) {
      return res.status(403).json({ message: `Forbidden: No access to approve requisitions for site '${requisition.site}'` });
    }

    requisition.status = 'Approved';
    requisition.approvedBy = req.user._id;
    requisition.approvedByName = req.user.name;
    requisition.approvalDate = new Date();
    await requisition.save();

    res.status(200).json({ message: `Requisition ${requisition.requisitionNumber} approved!`, requisition });
  } catch (error) {
    res.status(500).json({ message: 'Error approving requisition: ' + error.message });
  }
});

/**
 * 4. PATCH /api/requisitions/:id/reject - Reject requisition with reason
 */
router.patch('/:id/reject', requirePermission(PERMISSIONS.REQUISITIONS_APPROVE), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Rejection reason is required.' });
    }

    const requisition = await Requisition.findById(id);
    if (!requisition) {
      return res.status(404).json({ message: 'Requisition not found.' });
    }

    if (requisition.status !== 'Pending') {
      return res.status(400).json({ message: `Cannot reject requisition in status '${requisition.status}'.` });
    }

    // Site permission check
    if (req.user.role !== 'Owner' && !(req.user.assignedSites || []).includes(requisition.site)) {
      return res.status(403).json({ message: `Forbidden: No access to reject requisitions for site '${requisition.site}'` });
    }

    requisition.status = 'Rejected';
    requisition.approvedBy = req.user._id;
    requisition.approvedByName = req.user.name;
    requisition.approvalDate = new Date();
    requisition.rejectionReason = reason.trim();
    await requisition.save();

    res.status(200).json({ message: `Requisition ${requisition.requisitionNumber} rejected.`, requisition });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting requisition: ' + error.message });
  }
});

/**
 * 5. POST /api/requisitions/:id/fulfill - Issue stock against approved requisition (Storekeeper / Manager)
 * Guarantees atomic fulfillment and prevents duplicate issuance.
 */
router.post('/:id/fulfill', requirePermission(PERMISSIONS.INVENTORY_ISSUE), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid requisition ID format' });
    }

    // Atomic transition to 'Processing' prevents duplicate fulfillment or race conditions
    const requisition = await Requisition.findOneAndUpdate(
      { _id: id, status: 'Approved' },
      { status: 'Processing' },
      { new: true }
    );

    if (!requisition) {
      const existing = await Requisition.findById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Requisition not found.' });
      }
      if (existing.status === 'Fulfilled') {
        return res.status(400).json({ message: 'This requisition has already been fulfilled and issued.' });
      }
      if (existing.status === 'Processing') {
        return res.status(409).json({ message: 'Requisition is currently being fulfilled by another process.' });
      }
      return res.status(400).json({
        message: `Requisition must be approved before materials can be issued. Current status: '${existing.status}'`
      });
    }

    // Site permission check
    if (req.user.role !== 'Owner' && !(req.user.assignedSites || []).includes(requisition.site)) {
      await Requisition.findByIdAndUpdate(id, { status: 'Approved' });
      return res.status(403).json({ message: `Forbidden: No access to fulfill requisitions for site '${requisition.site}'` });
    }

    // Pre-verify stock availability and site matching for all items before any deduction
    for (const item of requisition.items) {
      const inv = await InventoryItem.findById(item.material);
      if (!inv || (inv.site && inv.site !== requisition.site)) {
        await Requisition.findByIdAndUpdate(id, { status: 'Approved' });
        return res.status(400).json({
          message: `Cannot fulfill: Material '${item.materialName}' does not belong to site '${requisition.site}'.`
        });
      }
      if (inv.quantity < item.quantityRequested) {
        await Requisition.findByIdAndUpdate(id, { status: 'Approved' });
        return res.status(400).json({
          message: `Cannot fulfill: Insufficient stock for ${item.materialName}. Available: ${inv ? inv.quantity : 0}, Required: ${item.quantityRequested}`
        });
      }
    }

    const successfulDeductions = [];

    try {
      // Step 1: Atomically decrement stock for all items
      for (const item of requisition.items) {
        const updated = await InventoryItem.findOneAndUpdate(
          { _id: item.material, quantity: { $gte: item.quantityRequested } },
          { $inc: { quantity: -item.quantityRequested } },
          { new: true }
        );

        if (!updated) {
          throw new Error(`Insufficient stock during atomic deduction for ${item.materialName}`);
        }

        successfulDeductions.push({
          materialId: item.material,
          quantity: item.quantityRequested,
          updatedMaterial: updated,
          item
        });
      }

      // Step 2: Deferred ledger creation - create and insert movements ONLY after all deductions succeeded
      const movementsToCreate = successfulDeductions.map(({ updatedMaterial, quantity, item }) => ({
        material: updatedMaterial._id,
        materialName: updatedMaterial.itemName,
        site: updatedMaterial.site || requisition.site,
        project: requisition.project || null,
        movementType: 'issue',
        direction: 'outbound',
        linkedRequisition: requisition._id,
        quantity: quantity,
        unit: item.unit,
        unitCost: updatedMaterial.unitCost,
        totalValue: Number((quantity * updatedMaterial.unitCost).toFixed(2)),
        reference: requisition.requisitionNumber,
        reason: `Requisition Fulfillment for activity: ${requisition.activity}`,
        recordedBy: req.user._id,
        recordedByName: req.user.name,
        recordedByRole: req.user.role,
        status: 'completed'
      }));

      // Step 2: Update item quantityIssued and mark requisition as Fulfilled
      for (const item of requisition.items) {
        item.quantityIssued = item.quantityRequested;
      }
      requisition.status = 'Fulfilled';
      requisition.fulfilledDate = new Date();
      await requisition.save();

      // Step 3: Deferred ledger creation - insert movements into StockMovement
      try {
        await StockMovement.insertMany(movementsToCreate);
      } catch (ledgerErr) {
        // Rollback requisition status and item quantityIssued if ledger insertion fails
        await Requisition.findByIdAndUpdate(id, {
          status: 'Approved',
          fulfilledDate: null,
          items: requisition.items.map((it) => ({
            material: it.material,
            materialName: it.materialName,
            quantityRequested: it.quantityRequested,
            quantityIssued: 0,
            unit: it.unit
          }))
        });
        throw new Error('Ledger insertion failed: ' + ledgerErr.message);
      }

      res.status(200).json({
        message: `Requisition ${requisition.requisitionNumber} fulfilled successfully! Stock deducted and ledger updated.`,
        requisition
      });
    } catch (fulfillmentErr) {
      // Rollback successful deductions if any deduction or ledger step failed
      for (const deduction of successfulDeductions) {
        await InventoryItem.findByIdAndUpdate(deduction.materialId, { $inc: { quantity: deduction.quantity } });
      }
      await Requisition.findByIdAndUpdate(id, { status: 'Approved' });
      return res.status(400).json({ message: 'Fulfillment failed and was rolled back: ' + fulfillmentErr.message });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fulfilling requisition: ' + error.message });
  }
});

module.exports = router;
