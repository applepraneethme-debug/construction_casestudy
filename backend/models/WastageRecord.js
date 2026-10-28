const mongoose = require('mongoose');

const wastageRecordSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Material reference is required']
    },
    materialName: {
      type: String,
      required: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    site: {
      type: String,
      required: [true, 'Site is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Wasted quantity is required'],
      min: [0.0001, 'Quantity must be greater than zero']
    },
    unit: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: [true, 'Wastage reason is required'],
      enum: ['Breakage', 'Spillage', 'Cutting Loss', 'Storage Damage', 'Expiry', 'Other']
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0
    },
    financialImpact: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    reportingUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reportingUserName: {
      type: String,
      required: true
    },
    stockMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockMovement',
      required: [true, 'Stock movement ledger reference is required']
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Pre-save calculation hook: Financial Impact
wastageRecordSchema.pre('save', function (next) {
  this.financialImpact = Number((this.quantity * (this.unitCost || 0)).toFixed(2));
  next();
});

module.exports = mongoose.model('WastageRecord', wastageRecordSchema);
