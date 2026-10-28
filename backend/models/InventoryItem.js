const mongoose = require('mongoose');

// STEP 1: Define the Inventory Item Schema
// A schema defines the structure of documents stored in MongoDB
const inventoryItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Material', 'Equipment', 'Tool', 'Other']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative']
    },
    unit: {
      type: String,
      required: [true, 'Unit (e.g. kg, bags, pieces) is required'],
      trim: true
    },
    supplier: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true
    },
    site: {
      type: String,
      trim: true,
      default: 'General Site'
    },
    minThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Minimum threshold cannot be negative']
    },
    unitCost: {
      type: Number,
      default: 0,
      min: [0, 'Unit cost cannot be negative']
    },
    sku: {
      type: String,
      trim: true,
      default: ''
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    storageLocation: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt fields
  }
);


// STEP 2: Create and export the Model from Schema
// The model provides methods like find(), save(), findByIdAndDelete(), etc.
module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
