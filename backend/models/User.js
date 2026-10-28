const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = [
  'Owner',
  'Material Manager',
  'Site Engineer / Project Manager',
  'Site Engineer',
  'Storekeeper'
];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ROLES,
        message: 'Invalid role specified'
      }
    },
    assignedSites: {
      type: [String],
      default: []
    },
    assignedProjects: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Method to verify candidate password against stored bcrypt hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash password
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

// Transform output to never expose passwordHash
userSchema.methods.toJSON = function () {
  const userObj = this.toObject();
  delete userObj.passwordHash;
  delete userObj.__v;
  return userObj;
};

module.exports = {
  User: mongoose.model('User', userSchema),
  ROLES
};
