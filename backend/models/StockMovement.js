const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Material reference is required']
    },
    materialName: {
      type: String,
      required: true,
      trim: true
    },
    site: {
      type: String,
      required: [true, 'Site is required'],
      trim: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    movementType: {
      type: String,
      required: [true, 'Movement type is required'],
      enum: ['receipt', 'issue', 'return', 'transfer', 'adjustment', 'wastage']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.0001, 'Quantity must be greater than zero']
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0
    },
    totalValue: {
      type: Number,
      default: 0
    },
    sourceSite: {
      type: String,
      trim: true,
      default: ''
    },
    destinationSite: {
      type: String,
      trim: true,
      default: ''
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound', 'neutral']
    },
    transferGroupId: {
      type: String,
      trim: true,
      default: null
    },
    linkedRequisition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Requisition',
      default: null
    },
    reference: {
      type: String,
      trim: true,
      default: ''
    },
    reason: {
      type: String,
      required: [true, 'Reason for stock movement is required'],
      trim: true
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recordedByName: {
      type: String,
      required: true
    },
    recordedByRole: {
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
    status: {
      type: String,
      enum: ['completed', 'pending_approval', 'reversed'],
      default: 'completed'
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Automatically derive direction from movementType if not explicitly set
stockMovementSchema.pre('validate', function (next) {
  if (!this.direction) {
    if (this.movementType === 'receipt' || this.movementType === 'return') {
      this.direction = 'inbound';
    } else if (this.movementType === 'issue' || this.movementType === 'wastage') {
      this.direction = 'outbound';
    } else if (this.movementType === 'transfer') {
      if (this.sourceSite && this.site === this.sourceSite) {
        this.direction = 'outbound';
      } else if (this.destinationSite && this.site === this.destinationSite) {
        this.direction = 'inbound';
      } else {
        this.direction = 'outbound';
      }
    } else {
      this.direction = 'neutral';
    }
  }
  next();
});

// Enforce ledger immutability: posted stock movements cannot be silently deleted or edited
stockMovementSchema.pre('updateOne', function () {
  throw new Error('Stock movements are immutable and cannot be updated. Use a reversal or adjustment entry.');
});
stockMovementSchema.pre('deleteOne', function () {
  throw new Error('Stock movements cannot be deleted. History must be preserved.');
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);
