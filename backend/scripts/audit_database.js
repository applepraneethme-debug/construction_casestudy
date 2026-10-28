const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { User } = require('../models/User');
const Project = require('../models/Project');
const Site = require('../models/Site');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const Requisition = require('../models/Requisition');
const ConsumptionRecord = require('../models/ConsumptionRecord');
const WastageRecord = require('../models/WastageRecord');

async function auditDatabase() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  try {
    const dbName = process.env.DB_NAME || 'constructionDB';
    await mongoose.connect(process.env.MONGO_URI, { dbName });
    console.log('Connected to MongoDB Atlas successfully.');
    console.log('Default connected database name:', mongoose.connection.name);

    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('\n--- DATABASES ON CLUSTER ---');
    for (const d of dbs.databases) {
      console.log(`Database: ${d.name} (${(d.sizeOnDisk / 1024).toFixed(1)} KB)`);
      const db = mongoose.connection.client.db(d.name);
      const cols = await db.listCollections().toArray();
      for (const col of cols) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  - Collection: ${col.name} (${count} docs)`);
      }
    }

    // 1. Inspect Users
    const users = await User.find({}).select('-passwordHash').lean();
    console.log('\n--- USERS IN DATABASE (' + users.length + ') ---');
    users.forEach(u => {
      console.log(`- ID: ${u._id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | Sites: [${u.assignedSites?.join(', ')}] | Active: ${u.isActive}`);
    });

    // 2. Inspect Projects
    const projects = await Project.find({}).lean();
    console.log('\n--- PROJECTS IN DATABASE (' + projects.length + ') ---');
    projects.forEach(p => {
      console.log(`- ID: ${p._id} | Code: ${p.code} | Name: ${p.name} | Status: ${p.status}`);
    });

    // 3. Inspect Sites
    const sites = await Site.find({}).lean();
    console.log('\n--- SITES IN DATABASE (' + sites.length + ') ---');
    sites.forEach(s => {
      console.log(`- ID: ${s._id} | Code: ${s.code} | Name: ${s.name} | Project: ${s.projectCode} | Active: ${s.isActive}`);
    });

    // 4. Inspect Inventory Items (Raw MongoDB collection to see exact stored fields)
    const rawItems = await mongoose.connection.db.collection('inventoryitems').find({}).toArray();
    console.log('\n--- INVENTORY ITEMS (RAW ATLAS DOCUMENTS) (' + rawItems.length + ') ---');
    rawItems.forEach(item => {
      console.log(JSON.stringify(item, null, 2));
    });

    // 5. Inspect Movements, Requisitions, Consumption, Wastage counts
    const movementCount = await StockMovement.countDocuments({});
    const requisitionCount = await Requisition.countDocuments({});
    const consumptionCount = await ConsumptionRecord.countDocuments({});
    const wastageCount = await WastageRecord.countDocuments({});

    console.log('\n--- TRANSACTION COLLECTIONS ---');
    console.log(`- Stock Movements: ${movementCount}`);
    console.log(`- Requisitions: ${requisitionCount}`);
    console.log(`- Consumptions: ${consumptionCount}`);
    console.log(`- Wastages: ${wastageCount}`);

    await mongoose.disconnect();
    console.log('\nAudit inspection complete. Connection closed.');
  } catch (err) {
    console.error('Audit failed:', err.message);
    process.exit(1);
  }
}

auditDatabase();
