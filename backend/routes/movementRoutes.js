const express = require('express');
const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);
router.use(verifyCsrf);

/**
 * 1. GET /api/movements - View persistent stock ledger with role- and site-scoping
 */
router.get('/', requirePermission(PERMISSIONS.INVENTORY_READ), async (req, res) => {
  try {
    const filter = {};

    // Site scoping for non-owners: non-owners only see their assigned sites or unassigned legacy
    if (req.user.role !== 'Owner') {
      const assigned = req.user.assignedSites || [];
      filter.$or = [
        { site: { $in: assigned } },
        { site: 'General Site' }
      ];
    }

    if (req.query.site) {
      if (req.user.role !== 'Owner' && !(req.user.assignedSites || []).includes(req.query.site)) {
        return res.status(403).json({ message: `Forbidden: No access to site '${req.query.site}'` });
      }
      filter.site = req.query.site;
    }

    if (req.query.material) {
      filter.material = req.query.material;
    }

    if (req.query.movementType) {
      filter.movementType = req.query.movementType;
    }

    const movements = await StockMovement.find(filter).sort({ createdAt: -1 }).limit(200);
    res.status(200).json(movements);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving stock movements: ' + error.message });
  }
});

/**
 * 2. POST /api/movements/receipt - Record stock receipt from supplier
 */
router.post('/receipt', requirePermission(PERMISSIONS.INVENTORY_RECEIVE), async (req, res) => {
  try {
    const { materialId, quantity, unitCost, reference, reason, notes } = req.body;

    if (!materialId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid material ID and positive quantity are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID format' });
    }

    const item = await InventoryItem.findById(materialId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Site access check
    if (req.user.role !== 'Owner' && item.site !== 'General Site' && !(req.user.assignedSites || []).includes(item.site)) {
      return res.status(403).json({ message: `Forbidden: No access to receive materials for site '${item.site}'` });
    }

    const numQty = Number(quantity);
    const cost = unitCost !== undefined && Number(unitCost) >= 0 ? Number(unitCost) : item.unitCost;

    // Atomic increment
    item.quantity = Number((item.quantity + numQty).toFixed(4));
    if (unitCost !== undefined && Number(unitCost) >= 0) {
      item.unitCost = Number(unitCost);
    }
    await item.save();

    // Create immutable stock movement record
    const movement = new StockMovement({
      material: item._id,
      materialName: item.itemName,
      site: item.site || 'General Site',
      project: item.project || null,
      movementType: 'receipt',
      quantity: numQty,
      unit: item.unit,
      unitCost: cost,
      totalValue: Number((numQty * cost).toFixed(2)),
      reference: reference ? reference.trim() : 'Supplier Delivery',
      reason: reason ? reason.trim() : 'Stock receipt from supplier',
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      recordedByRole: req.user.role,
      status: 'completed',
      notes: notes ? notes.trim() : ''
    });

    await movement.save();

    res.status(201).json({
      message: `Successfully received ${numQty} ${item.unit} of ${item.itemName}. New balance: ${item.quantity}`,
      movement,
      updatedBalance: item.quantity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing stock receipt: ' + error.message });
  }
});

/**
 * 3. POST /api/movements/issue - Issue material to construction activity (Atomic, no negative stock)
 */
router.post('/issue', requirePermission(PERMISSIONS.INVENTORY_ISSUE), async (req, res) => {
  try {
    const { materialId, quantity, activity, reference, notes } = req.body;

    if (!materialId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid material ID and positive quantity are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID format' });
    }

    const numQty = Number(quantity);

    // Atomic conditional decrement to strictly prevent negative stock or race conditions
    const updatedItem = await InventoryItem.findOneAndUpdate(
      { _id: materialId, quantity: { $gte: numQty } },
      { $inc: { quantity: -numQty } },
      { new: true }
    );

    if (!updatedItem) {
      const existing = await InventoryItem.findById(materialId);
      if (!existing) {
        return res.status(404).json({ message: 'Inventory item not found.' });
      }
      return res.status(400).json({
        message: `Insufficient stock! Requested ${numQty} ${existing.unit}, but only ${existing.quantity} ${existing.unit} available.`
      });
    }

    // Site access check
    if (req.user.role !== 'Owner' && updatedItem.site !== 'General Site' && !(req.user.assignedSites || []).includes(updatedItem.site)) {
      // Revert decrement if unauthorized site
      await InventoryItem.findByIdAndUpdate(materialId, { $inc: { quantity: numQty } });
      return res.status(403).json({ message: `Forbidden: No access to issue materials from site '${updatedItem.site}'` });
    }

    const movement = new StockMovement({
      material: updatedItem._id,
      materialName: updatedItem.itemName,
      site: updatedItem.site || 'General Site',
      project: updatedItem.project || null,
      movementType: 'issue',
      quantity: numQty,
      unit: updatedItem.unit,
      unitCost: updatedItem.unitCost,
      totalValue: Number((numQty * updatedItem.unitCost).toFixed(2)),
      reference: reference ? reference.trim() : 'Material Issue Slip',
      reason: activity ? `Issued to: ${activity.trim()}` : 'Material issued for construction works',
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      recordedByRole: req.user.role,
      status: 'completed',
      notes: notes ? notes.trim() : ''
    });

    await movement.save();

    res.status(201).json({
      message: `Successfully issued ${numQty} ${updatedItem.unit} of ${updatedItem.itemName}. Remaining balance: ${updatedItem.quantity}`,
      movement,
      remainingBalance: updatedItem.quantity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing stock issue: ' + error.message });
  }
});

/**
 * 4. POST /api/movements/return - Return unused material back into inventory
 */
router.post('/return', requirePermission(PERMISSIONS.INVENTORY_RETURN), async (req, res) => {
  try {
    const { materialId, quantity, reason, reference, notes } = req.body;

    if (!materialId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid material ID and positive quantity are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID format' });
    }

    const numQty = Number(quantity);
    const item = await InventoryItem.findById(materialId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    if (req.user.role !== 'Owner' && item.site !== 'General Site' && !(req.user.assignedSites || []).includes(item.site)) {
      return res.status(403).json({ message: `Forbidden: No access to site '${item.site}'` });
    }

    item.quantity = Number((item.quantity + numQty).toFixed(4));
    await item.save();

    const movement = new StockMovement({
      material: item._id,
      materialName: item.itemName,
      site: item.site || 'General Site',
      project: item.project || null,
      movementType: 'return',
      quantity: numQty,
      unit: item.unit,
      unitCost: item.unitCost,
      totalValue: Number((numQty * item.unitCost).toFixed(2)),
      reference: reference ? reference.trim() : 'Material Return Slip',
      reason: reason ? reason.trim() : 'Return of unused site materials',
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      recordedByRole: req.user.role,
      status: 'completed',
      notes: notes ? notes.trim() : ''
    });

    await movement.save();

    res.status(201).json({
      message: `Returned ${numQty} ${item.unit} to stock. New balance: ${item.quantity}`,
      movement,
      updatedBalance: item.quantity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing return: ' + error.message });
  }
});

/**
 * 5. POST /api/movements/transfer - Transfer material between sites
 */
router.post('/transfer', requirePermission(PERMISSIONS.INVENTORY_ADJUST), async (req, res) => {
  try {
    const { materialId, destinationSite, quantity, reason, reference, notes } = req.body;

    if (!materialId || !destinationSite || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Material ID, destination site, and positive quantity are required.' });
    }

    const numQty = Number(quantity);

    // Decrement from source
    const sourceItem = await InventoryItem.findOneAndUpdate(
      { _id: materialId, quantity: { $gte: numQty } },
      { $inc: { quantity: -numQty } },
      { new: true }
    );

    if (!sourceItem) {
      const existing = await InventoryItem.findById(materialId);
      if (!existing) return res.status(404).json({ message: 'Source material not found' });
      return res.status(400).json({ message: `Insufficient stock for transfer. Current balance: ${existing.quantity}` });
    }

    const sourceSite = sourceItem.site || 'General Site';

    // Verify non-owner has site access to both source and destination
    if (req.user.role !== 'Owner') {
      const assigned = req.user.assignedSites || [];
      if (sourceSite !== 'General Site' && !assigned.includes(sourceSite)) {
        await InventoryItem.findByIdAndUpdate(materialId, { $inc: { quantity: numQty } });
        return res.status(403).json({ message: `Forbidden: No access to transfer from site '${sourceSite}'` });
      }
      if (!assigned.includes(destinationSite.trim())) {
        await InventoryItem.findByIdAndUpdate(materialId, { $inc: { quantity: numQty } });
        return res.status(403).json({ message: `Forbidden: No access to transfer to site '${destinationSite.trim()}'` });
      }
    }

    // Find or create item at destination site
    let destItem = await InventoryItem.findOne({
      itemName: sourceItem.itemName,
      site: destinationSite.trim()
    });

    if (destItem) {
      destItem.quantity = Number((destItem.quantity + numQty).toFixed(4));
      await destItem.save();
    } else {
      destItem = new InventoryItem({
        itemName: sourceItem.itemName,
        category: sourceItem.category,
        quantity: numQty,
        unit: sourceItem.unit,
        supplier: sourceItem.supplier,
        site: destinationSite.trim(),
        minThreshold: sourceItem.minThreshold,
        unitCost: sourceItem.unitCost,
        project: sourceItem.project
      });
      await destItem.save();
    }

    const movement = new StockMovement({
      material: sourceItem._id,
      materialName: sourceItem.itemName,
      site: sourceSite,
      sourceSite,
      destinationSite: destinationSite.trim(),
      project: sourceItem.project || null,
      movementType: 'transfer',
      quantity: numQty,
      unit: sourceItem.unit,
      unitCost: sourceItem.unitCost,
      totalValue: Number((numQty * sourceItem.unitCost).toFixed(2)),
      reference: reference ? reference.trim() : 'Site Transfer Slip',
      reason: reason ? reason.trim() : `Transfer from ${sourceSite} to ${destinationSite.trim()}`,
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      recordedByRole: req.user.role,
      status: 'completed',
      notes: notes ? notes.trim() : ''
    });

    await movement.save();

    res.status(201).json({
      message: `Transferred ${numQty} ${sourceItem.unit} from ${sourceSite} to ${destinationSite.trim()}`,
      movement,
      sourceBalance: sourceItem.quantity,
      destBalance: destItem.quantity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing transfer: ' + error.message });
  }
});

/**
 * 6. POST /api/movements/adjustment - Controlled physical count stock adjustment
 */
router.post('/adjustment', requirePermission(PERMISSIONS.INVENTORY_ADJUST), async (req, res) => {
  try {
    const { materialId, newPhysicalQuantity, reason, reference, notes } = req.body;

    if (!materialId || newPhysicalQuantity === undefined || Number(newPhysicalQuantity) < 0) {
      return res.status(400).json({ message: 'Valid material ID and non-negative physical count are required.' });
    }

    const item = await InventoryItem.findById(materialId);
    if (!item) return res.status(404).json({ message: 'Inventory item not found.' });

    const targetQty = Number(newPhysicalQuantity);
    const variance = Number((targetQty - item.quantity).toFixed(4));

    if (variance === 0) {
      return res.status(400).json({ message: 'New physical count matches current stock balance. No adjustment required.' });
    }

    // Material Manager cannot approve exceptional adjustments of their own without Owner permission
    if (req.user.role !== 'Owner' && Math.abs(variance) > 50) {
      return res.status(403).json({
        message: 'Exceptional stock adjustments (> 50 units) require Owner approval.'
      });
    }

    const oldQty = item.quantity;
    item.quantity = targetQty;
    await item.save();

    const movement = new StockMovement({
      material: item._id,
      materialName: item.itemName,
      site: item.site || 'General Site',
      project: item.project || null,
      movementType: 'adjustment',
      quantity: Math.abs(variance),
      unit: item.unit,
      unitCost: item.unitCost,
      totalValue: Number((Math.abs(variance) * item.unitCost).toFixed(2)),
      reference: reference ? reference.trim() : 'Physical Audit Adjustment',
      reason: `Stock adjustment: count changed from ${oldQty} to ${targetQty}. Reason: ${reason || 'Physical count reconciliation'}`,
      recordedBy: req.user._id,
      recordedByName: req.user.name,
      recordedByRole: req.user.role,
      approvedBy: req.user.role === 'Owner' ? req.user._id : null,
      approvedByName: req.user.role === 'Owner' ? req.user.name : null,
      status: 'completed',
      notes: notes ? notes.trim() : ''
    });

    await movement.save();

    res.status(201).json({
      message: `Adjusted ${item.itemName} stock from ${oldQty} to ${targetQty}`,
      movement,
      newBalance: item.quantity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing stock adjustment: ' + error.message });
  }
});

module.exports = router;
