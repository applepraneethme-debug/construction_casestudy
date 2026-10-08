const express = require('express');
const router = express.Router();
const InventoryItem = require('../models/InventoryItem');

// ==========================================
// 1. POST /api/inventory - Add a new inventory item
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { itemName, category, quantity, unit, supplier } = req.body;

    // Create a new Inventory Item document
    const newItem = new InventoryItem({
      itemName,
      category,
      quantity,
      unit,
      supplier
    });

    // Save item into MongoDB database
    const savedItem = await newItem.save();
    res.status(201).json({
      message: 'Inventory item added successfully!',
      item: savedItem
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
});

// ==========================================
// 2. GET /api/inventory - Get all inventory items
// ==========================================
router.get('/', async (req, res) => {
  try {
    // Fetch all items sorted by creation time (latest first)
    const items = await InventoryItem.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
});

// ==========================================
// 3. DELETE /api/inventory/:id - Delete item by ID
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const deletedItem = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ message: 'Item not found!' });
    }
    res.status(200).json({ message: 'Item removed successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
});

module.exports = router;
