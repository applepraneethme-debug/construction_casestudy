const mongoose = require('mongoose');

const consumptionRecordSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    projectName: {
      type: String,
      default: ''
    },
    site: {
      type: String,
      required: [true, 'Site is required'],
      trim: true
    },
    activity: {
      type: String,
      required: [true, 'Work activity description is required'],
      trim: true
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Material reference is required']
    },
    materialName: {
      type: String,
      required: true
    },
    expectedQty: {
      type: Number,
      required: [true, 'Expected quantity is required'],
      min: [0, 'Expected quantity cannot be negative']
    },
    actualQty: {
      type: Number,
      required: [true, 'Actual quantity consumed is required'],
      min: [0, 'Actual quantity cannot be negative']
    },
    unit: {
      type: String,
      required: true
    },
    excessQty: {
      type: Number,
      default: 0
    },
    excessPercentage: {
      type: Number,
      default: 0
    },
    varianceReason: {
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
    reportDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Pre-save calculation hook: Excess Quantity and Percentage
consumptionRecordSchema.pre('save', function (next) {
  this.excessQty = Number((this.actualQty - this.expectedQty).toFixed(4));
  if (this.expectedQty > 0) {
    this.excessPercentage = Number(
      (((this.actualQty - this.expectedQty) / this.expectedQty) * 100).toFixed(2)
    );
  } else {
    this.excessPercentage = this.actualQty > 0 ? 100 : 0;
  }
  next();
});

module.exports = mongoose.model('ConsumptionRecord', consumptionRecordSchema);
