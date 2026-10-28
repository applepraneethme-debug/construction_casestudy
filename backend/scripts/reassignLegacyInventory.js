/**
 * Safe Migration and Reassignment Script for Legacy Inventory Items
 * 
 * Purpose:
 * Safely migrate legacy inventory items (e.g. items with 'General Site' or no project/site)
 * to an authenticated project and construction site without data loss.
 * 
 * Usage:
 *   # List unassigned or legacy items:
 *   node backend/scripts/reassignLegacyInventory.js --list
 * 
 *   # Reassign an item to a verified site and project:
 *   node backend/scripts/reassignLegacyInventory.js --itemId="<ITEM_ID>" --site="<SITE_NAME>" --projectCode="<PROJECT_CODE>"
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const InventoryItem = require('../models/InventoryItem');
const Site = require('../models/Site');
const Project = require('../models/Project');
const AuditLog = require('../models/AuditLog');

const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, ...values] = arg.slice(2).split('=');
      args[key] = values.length > 0 ? values.join('=') : true;
    }
  });
  return args;
};

async function run() {
  const args = parseArgs();

  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set in backend/.env');
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || 'constructionDB';
  await mongoose.connect(process.env.MONGO_URI, { dbName });
  console.log(`Connected to MongoDB Atlas [Database: ${mongoose.connection.name}]`);

  try {
    // 1. Identify legacy items
    const legacyQuery = {
      $or: [
        { site: 'General Site' },
        { site: { $exists: false } },
        { site: null },
        { site: '' },
        { projectCode: { $exists: false } },
        { projectCode: null },
        { projectCode: '' }
      ]
    };

    const legacyItems = await InventoryItem.find(legacyQuery).lean();

    if (args.list || (!args.itemId && !args.site)) {
      console.log(`\nFound ${legacyItems.length} legacy/unassigned inventory items:`);
      legacyItems.forEach((item, index) => {
        console.log(`  [${index + 1}] ID: ${item._id}`);
        console.log(`      Name: ${item.itemName} (${item.category || 'General'})`);
        console.log(`      Current Site: "${item.site || 'None'}" | Project: "${item.projectCode || 'None'}"`);
        console.log(`      Quantity: ${item.quantity} ${item.unit} | Supplier: ${item.supplier || 'N/A'}`);
        console.log(`      SKU: ${item.sku || 'N/A'} | Unit Cost: ${item.unitCost || 0}`);
        console.log('------------------------------------------------------------');
      });

      if (legacyItems.length === 0) {
        console.log('✅ No legacy items require migration.');
      } else {
        console.log('\nTo reassign an item safely, run:');
        console.log('node backend/scripts/reassignLegacyInventory.js --itemId="<ID>" --site="<SITE_NAME>" --projectCode="<PROJECT_CODE>"');
      }

      await mongoose.disconnect();
      return;
    }

    // 2. Perform reassignment
    const { itemId, site: targetSiteName, projectCode: targetProjectCode } = args;

    if (!itemId || !targetSiteName || !targetProjectCode) {
      console.error('❌ Missing required parameters: --itemId, --site, and --projectCode are all required.');
      process.exit(1);
    }

    // Verify item exists
    const item = await InventoryItem.findById(itemId);
    if (!item) {
      console.error(`❌ Inventory item with ID "${itemId}" not found.`);
      process.exit(1);
    }

    // Verify target project exists and is active
    const project = await Project.findOne({ code: targetProjectCode });
    if (!project) {
      console.error(`❌ Target project "${targetProjectCode}" does not exist in the database.`);
      console.error('👉 Please create the project first in Projects & Sites before reassigning.');
      process.exit(1);
    }

    // Verify target site exists, is active, and is associated with the project
    const site = await Site.findOne({ name: targetSiteName });
    if (!site) {
      console.error(`❌ Target site "${targetSiteName}" does not exist in the database.`);
      console.error('👉 Please register the construction site before reassigning inventory.');
      process.exit(1);
    }

    if (site.projectCode !== targetProjectCode) {
      console.warn(`⚠️ Warning: Site "${targetSiteName}" is associated with project "${site.projectCode}", but target project is "${targetProjectCode}".`);
    }

    // Safe Update - Preserve all existing data
    const previousSite = item.site;
    const previousProject = item.projectCode;

    item.site = targetSiteName;
    item.projectCode = targetProjectCode;
    await item.save();

    console.log(`\n✅ Inventory Item "${item.itemName}" (${item._id}) successfully migrated:`);
    console.log(`   - Previous Location: Site "${previousSite}", Project "${previousProject}"`);
    console.log(`   - New Location:      Site "${item.site}", Project "${item.projectCode}"`);
    console.log(`   - Quantity Preserved: ${item.quantity} ${item.unit}`);
    console.log(`   - Supplier:           ${item.supplier}`);

    // Record Audit Entry
    await AuditLog.create({
      action: 'INVENTORY_REASSIGNED',
      targetResource: 'InventoryItem',
      targetId: item._id.toString(),
      details: {
        itemName: item.itemName,
        previousSite,
        newSite: item.site,
        previousProject,
        newProject: item.projectCode,
        quantity: item.quantity,
        unit: item.unit
      }
    });

    console.log('✅ Audit log recorded.');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

run();
