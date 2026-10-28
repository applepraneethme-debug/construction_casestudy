const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');

/**
 * Centralized Stock Movement Helper
 * Enforces:
 * 1. Single source of truth for stock balance updates
 * 2. Atomic conditional decrement to strictly prevent negative stock
 * 3. Consistent creation of immutable ledger entries with explicit direction metadata
 * 4. Automatic valuation tracking (quantity * unitCost)
 */
async function postMovement({
  materialId,
  quantity,
  movementType,
  direction, // 'inbound' | 'outbound' | 'neutral'
  reason,
  reference,
  user,
  unitCost,
  sourceSite,
  destinationSite,
  transferGroupId,
  linkedRequisition,
  notes
}) {
  if (!materialId || !mongoose.Types.ObjectId.isValid(materialId)) {
    throw new Error('Valid material ID is required');
  }

  const numQty = Number(quantity);
  if (isNaN(numQty) || numQty <= 0) {
    throw new Error('Movement quantity must be a positive number');
  }

  // 1. Check existing item
  const existingItem = await InventoryItem.findById(materialId);
  if (!existingItem) {
    throw new Error('Inventory item not found');
  }

  if (existingItem.isArchived) {
    throw new Error('Cannot perform stock movements on an archived inventory item');
  }

  const resolvedUnitCost = unitCost !== undefined && Number(unitCost) >= 0
    ? Number(unitCost)
    : (existingItem.unitCost || 0);

  let updatedItem;

  // 2. Perform Atomic Stock Update based on direction
  if (direction === 'outbound') {
    updatedItem = await InventoryItem.findOneAndUpdate(
      { _id: materialId, quantity: { $gte: numQty }, isArchived: { $ne: true } },
      { $inc: { quantity: -numQty } },
      { new: true }
    );

    if (!updatedItem) {
      throw new Error(
        `Insufficient stock for ${existingItem.itemName}! Requested ${numQty} ${existingItem.unit}, but only ${existingItem.quantity} ${existingItem.unit} available.`
      );
    }
  } else if (direction === 'inbound') {
    const updatePayload = { $inc: { quantity: numQty } };
    if (unitCost !== undefined && Number(unitCost) >= 0) {
      updatePayload.$set = { unitCost: Number(unitCost) };
    }

    updatedItem = await InventoryItem.findByIdAndUpdate(
      materialId,
      updatePayload,
      { new: true }
    );
  } else {
    // Neutral (no balance change)
    updatedItem = existingItem;
  }

  // 3. Create Immutable StockMovement Record
  const movement = new StockMovement({
    material: updatedItem._id,
    materialName: updatedItem.itemName,
    site: updatedItem.site || 'General Site',
    project: updatedItem.project || null,
    movementType,
    direction: direction || 'inbound',
    quantity: numQty,
    unit: updatedItem.unit,
    unitCost: resolvedUnitCost,
    totalValue: Number((numQty * resolvedUnitCost).toFixed(2)),
    sourceSite: sourceSite || '',
    destinationSite: destinationSite || '',
    transferGroupId: transferGroupId || null,
    linkedRequisition: linkedRequisition || null,
    reference: reference ? reference.trim() : `${movementType.toUpperCase()}-ENTRY`,
    reason: reason ? reason.trim() : `${movementType} transaction`,
    recordedBy: user._id,
    recordedByName: user.name,
    recordedByRole: user.role,
    status: 'completed',
    notes: notes ? notes.trim() : ''
  });

  const savedMovement = await movement.save();

  return {
    item: updatedItem,
    movement: savedMovement,
    balance: updatedItem.quantity
  };
}

module.exports = { postMovement };
