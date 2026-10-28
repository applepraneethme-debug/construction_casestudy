/**
 * Secure Bootstrap Script for Initial Owner Account
 * 
 * Usage (Interactive):
 *   node backend/scripts/bootstrapOwner.js
 * 
 * Usage (CLI arguments):
 *   node backend/scripts/bootstrapOwner.js --email="owner@company.com" --name="Company Owner" --password="SecurePassword123!"
 * 
 * Security Guard:
 *   Refuses to run if an Owner account already exists in the database unless --force is provided.
 */

const readline = require('readline');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { User } = require('../models/User');

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
};

// Parse command-line flags
const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, ...values] = arg.slice(2).split('=');
      args[key] = values.join('=');
    }
  });
  return args;
};

const bootstrapOwner = async () => {
  const args = parseArgs();

  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.error('❌ Error: MONGO_URI is missing from backend/.env');
    process.exit(1);
  }

  try {
    const dbName = process.env.DB_NAME || 'constructionDB';
    await mongoose.connect(mongoURI, {
      dbName,
      serverSelectionTimeoutMS: 5000
    });
    console.log(`🔌 Connected to database: ${mongoose.connection.name}`);

    // Check if an Owner already exists
    const existingOwner = await User.findOne({ role: 'Owner' });
    if (existingOwner && !args.force) {
      console.log(`⚠️ An Owner account already exists in the system: [${existingOwner.email}]`);
      console.log('👉 To maintain security, new users must be created by the Owner through the dashboard.');
      console.log('👉 If you need to create another Owner via CLI, pass the --force flag.');
      await mongoose.disconnect();
      process.exit(0);
    }

    let name = args.name;
    let email = args.email;
    let password = args.password;

    if (!name) {
      name = await askQuestion('👤 Enter Owner Name (e.g. Construction Admin): ');
    }
    if (!email) {
      email = await askQuestion('📧 Enter Owner Email: ');
    }
    if (!password) {
      password = await askQuestion('🔑 Enter Secure Password (min 8 characters): ');
    }

    if (!name || !email || !password) {
      console.error('❌ Error: Name, email, and password are all required.');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Error: Password must be at least 8 characters long for an Owner account.');
      await mongoose.disconnect();
      process.exit(1);
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Error: Invalid email address format.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.error(`❌ Error: A user with email ${email} already exists.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const passwordHash = await User.hashPassword(password);

    const owner = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'Owner',
      assignedSites: [],
      assignedProjects: [],
      isActive: true
    });

    await owner.save();

    console.log('======================================================');
    console.log('🎉 Owner account successfully bootstrapped!');
    console.log(`   Name:  ${owner.name}`);
    console.log(`   Email: ${owner.email}`);
    console.log(`   Role:  ${owner.role}`);
    console.log('======================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Bootstrap failed:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

bootstrapOwner();
