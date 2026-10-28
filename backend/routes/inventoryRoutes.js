const express = require('express');
const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const WastageRecord = require('../models/WastageRecord');
const {
  authenticate,
  requirePermission,
  verifyCsrf
} = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');


const router = express.Router();

// All inventory routes require valid authentication and CSRF validation for mutations
router.use(authenticate);
router.use(verifyCsrf);

/**
 * 1. GET /api/inventory - Retrieve inventory items with search, category/site filtering, and low-stock filter
 */
router.get('/', requirePermission(PERMISSIONS.INVENTORY_READ), async (req, res) => {
  try {
    const filter = {};

    if (req.query.includeArchived !== 'true') {
      filter.isArchived = { $ne: true };
    }

    // Strictly scope inventory to assigned sites; non-owner with 0 sites receives 0 data
    if (req.user.role !== 'Owner') {
      const assignedSites = req.user.assignedSites || [];
      if (assignedSites.length === 0) {
        return res.status(200).json([]);
      }
      filter.site = { $in: assignedSites };
    }


    // Optional query filter by site
    if (req.query.site) {
      if (
        req.user.role !== 'Owner' &&
        !(req.user.assignedSites || []).includes(req.query.site)
      ) {
        return res.status(403).json({
          message: `Forbidden: You do not have permission to view site '${req.query.site}'`
        });
      }
      filter.site = req.query.site;
    }

    // Optional query filter by category
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Optional query filter by project
    if (req.query.project && mongoose.Types.ObjectId.isValid(req.query.project)) {
      filter.project = req.query.project;
    }

    // Search query matching itemName, supplier, or sku
    if (req.query.search && req.query.search.trim()) {
      const regex = new RegExp(req.query.search.trim(), 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { itemName: regex },
          { supplier: regex },
          { sku: regex },
          { storageLocation: regex }
        ]
      });
    }

    // Low stock filter
    if (req.query.lowStock === 'true') {
      filter.$expr = { $lte: ['$quantity', '$minThreshold'] };
    }

    const items = await InventoryItem.find(filter)
      .populate('project', 'name code')
      .sort({ createdAt: -1 });

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
});

/**
 * 2. POST /api/inventory - Add a new inventory item
 */
router.post('/', requirePermission(PERMISSIONS.INVENTORY_CREATE), async (req, res) => {
  try {
    const {
      itemName,
      category,
      quantity,
      unit,
      supplier,
      site,
      minThreshold,
      unitCost,
      sku,
      project,
      storageLocation
    } = req.body;

    if (!itemName || !category || quantity === undefined || !unit || !supplier) {
      return res.status(400).json({
        message: 'Item name, category, quantity, unit, and supplier are required.'
      });
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty < 0) {
      return res.status(400).json({
        message: 'Quantity must be a non-negative number.'
      });
    }

    const targetSite = site && site.trim() ? site.trim() : 'General Site';

    // Verify site access for non-owner
    if (
      req.user.role !== 'Owner' &&
      targetSite !== 'General Site' &&
      !(req.user.assignedSites || []).includes(targetSite)
    ) {
      return res.status(403).json({
        message: `Forbidden: You do not have permission to add materials to site '${targetSite}'`
      });
    }

    const newItem = new InventoryItem({
      itemName: itemName.trim(),
      category,
      quantity: numQty,
      unit: unit.trim(),
      supplier: supplier.trim(),
      site: targetSite,
      minThreshold: minThreshold !== undefined ? Math.max(0, Number(minThreshold)) : 10,
      unitCost: unitCost !== undefined ? Math.max(0, Number(unitCost)) : 0,
      sku: sku ? sku.trim().toUpperCase() : '',
      project: project && mongoose.Types.ObjectId.isValid(project) ? project : null,
      storageLocation: storageLocation ? storageLocation.trim() : ''
    });

    const savedItem = await newItem.save();

    // If item is registered with an opening quantity > 0, record opening-balance ledger entry
    if (numQty > 0) {
      const openingMovement = new StockMovement({
        material: savedItem._id,
        materialName: savedItem.itemName,
        site: savedItem.site || 'General Site',
        project: savedItem.project || null,
        movementType: 'receipt',
        direction: 'inbound',
        quantity: numQty,
        unit: savedItem.unit,
        unitCost: savedItem.unitCost,
        totalValue: Number((numQty * savedItem.unitCost).toFixed(2)),
        reference: 'OPENING-BALANCE',
        reason: 'Initial opening stock registered with inventory item',
        recordedBy: req.user._id,
        recordedByName: req.user.name,
        recordedByRole: req.user.role,
        status: 'completed',
        notes: 'Opening stock balance'
      });
      await openingMovement.save();
    }

    const populated = await InventoryItem.findById(savedItem._id).populate('project', 'name code');

    res.status(201).json({
      message: 'Inventory item added successfully!',
      item: populated
    });

  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
});

/**
 * 3. PUT /api/inventory/:id - Update an existing inventory item (Complete CRUD)
 */
router.put('/:id', requirePermission(PERMISSIONS.INVENTORY_UPDATE), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid item ID format' });
    }

    const existingItem = await InventoryItem.findById(id);
    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found!' });
    }

    // Check site access to existing item
    if (
      req.user.role !== 'Owner' &&
      existingItem.site &&
      existingItem.site !== 'General Site' &&
      !(req.user.assignedSites || []).includes(existingItem.site)
    ) {
      return res.status(403).json({
        message: `Forbidden: You do not have permission to modify items at site '${existingItem.site}'`
      });
    }

    const {
      itemName,
      category,
      quantity,
      unit,
      supplier,
      site,
      minThreshold,
      unitCost,
      sku,
      project,
      storageLocation
    } = req.body;

    // Prevent arbitrary stock balance overwrite via inventory edit
    if (quantity !== undefined && Number(quantity) !== existingItem.quantity) {
      return res.status(400).json({
        message: 'Direct quantity modification via inventory edit is prohibited. All stock changes must be recorded through audited Stock Movements (Receipt, Issue, Transfer, or Adjustment).'
      });
    }


    if (site && site.trim()) {
      const targetSite = site.trim();
      if (
        req.user.role !== 'Owner' &&
        targetSite !== 'General Site' &&
        !(req.user.assignedSites || []).includes(targetSite)
      ) {
        return res.status(403).json({
          message: `Forbidden: You do not have permission to assign items to site '${targetSite}'`
        });
      }
      existingItem.site = targetSite;
    }

    if (itemName) existingItem.itemName = itemName.trim();
    if (category) existingItem.category = category;
    if (unit) existingItem.unit = unit.trim();
    if (supplier) existingItem.supplier = supplier.trim();
    if (minThreshold !== undefined) existingItem.minThreshold = Math.max(0, Number(minThreshold));
    if (unitCost !== undefined) existingItem.unitCost = Math.max(0, Number(unitCost));
    if (sku !== undefined) existingItem.sku = sku.trim().toUpperCase();
    if (storageLocation !== undefined) existingItem.storageLocation = storageLocation.trim();
    if (project !== undefined) {
      existingItem.project = project && mongoose.Types.ObjectId.isValid(project) ? project : null;
    }

    const updatedItem = await existingItem.save();
    const populated = await InventoryItem.findById(updatedItem._id).populate('project', 'name code');

    res.status(200).json({
      message: 'Inventory item updated successfully!',
      item: populated
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
});

router.delete('/:id', requirePermission(PERMISSIONS.INVENTORY_DELETE), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid item ID format' });
    }

    const existingItem = await InventoryItem.findById(id);
    if (!existingItem) {
      return res.status(404).json({ message: 'Item not found!' });
    }

    // Check if movements or wastage records reference this item
    const movementCount = await StockMovement.countDocuments({ material: id });
    const wastageCount = await WastageRecord.countDocuments({ material: id });

    if (movementCount > 0 || wastageCount > 0) {
      // Soft-delete / archive to preserve historical ledger records
      existingItem.isArchived = true;
      await existingItem.save();
      return res.status(200).json({
        message: 'Item has historical transactions and was safely archived rather than deleted to preserve audit trail.',
        archived: true,
        item: existingItem
      });
    }

    // Hard delete if completely unused
    await InventoryItem.findByIdAndDelete(id);
    res.status(200).json({ message: 'Item removed successfully!', archived: false });
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
});

module.exports = router;
