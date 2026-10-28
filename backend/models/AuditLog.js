const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedByEmail: {
      type: String,
      required: true
    },
    performedByRole: {
      type: String,
      required: true
    },
    targetResource: {
      type: String,
      required: true
    },
    targetId: {
      type: String,
      default: null
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent modifications to audit logs (immutable ledger)
auditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are append-only and cannot be updated');
});
auditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs cannot be deleted');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
