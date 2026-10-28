const mongoose = require('mongoose');

const requisitionItemSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    materialName: {
      type: String,
      required: true
    },
    quantityRequested: {
      type: Number,
      required: true,
      min: [0.0001, 'Quantity requested must be greater than zero']
    },
    quantityIssued: {
      type: Number,
      default: 0,
      min: 0
    },
    unit: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const requisitionSchema = new mongoose.Schema(
  {
    requisitionNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
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
    activity: {
      type: String,
      required: [true, 'Construction activity description is required'],
      trim: true
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium'
    },
    items: {
      type: [requisitionItemSchema],
      validate: [(val) => val.length > 0, 'Requisition must contain at least one material item']
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Processing', 'Rejected', 'Fulfilled'],
      default: 'Pending'
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    requestedByName: {
      type: String,
      required: true
    },
    requestedByRole: {
      type: String,
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedByName: {
      type: String,
      default: null
    },
    approvalDate: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    },
    fulfilledDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Requisition', requisitionSchema);
