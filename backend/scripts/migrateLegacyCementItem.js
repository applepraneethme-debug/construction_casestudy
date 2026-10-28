require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

/**
 * Safe, idempotent migration script for legacy 'cement' item without site/SKU.
 * Default mode: --dry-run (no database writes).
 * Pass --apply explicitly to commit changes.
 */
async function migrateLegacyCement() {
  const isDryRun = !process.argv.includes('--apply');

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing from backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    console.log(`Connected to MongoDB Atlas: ${mongoose.connection.name}`);
    console.log(`Execution Mode: ${isDryRun ? 'DRY-RUN (No writes will be committed)' : 'APPLY (Writing changes to database)'}\n`);

    const InventoryItem = mongoose.model('InventoryItem', new mongoose.Schema({}, { strict: false }));
    const Site = mongoose.model('Site', new mongoose.Schema({}, { strict: false }));

    // Find the target site: Site Central - Station Yard
    const targetSite = await Site.findOne({ name: 'Site Central - Station Yard' });
    const siteName = targetSite ? targetSite.name : 'Site Central - Station Yard';
    const projectId = targetSite ? targetSite.project : null;

    // Search for legacy items where site is missing or undefined
    const legacyItems = await InventoryItem.find({
      $or: [
        { site: { $exists: false } },
        { site: null },
        { site: 'undefined' },
        { site: '' }
      ]
    });

    console.log(`Found ${legacyItems.length} legacy items requiring site assignment:`);

    for (const item of legacyItems) {
      console.log(`\n• Item ID: ${item._id}`);
      console.log(`  Current Name: "${item.itemName}" | Current SKU: "${item.sku || 'NONE'}" | Current Site: "${item.site}"`);

      const proposedUpdate = {
        site: siteName,
        project: projectId,
        sku: item.sku || 'CEM-LEG-01',
        unitCost: item.unitCost !== undefined && item.unitCost !== null ? item.unitCost : 400,
        minThreshold: item.minThreshold || 10,
        isArchived: false
      };

      console.log(`  Proposed Values:`, proposedUpdate);

      if (!isDryRun) {
        await InventoryItem.updateOne({ _id: item._id }, { $set: proposedUpdate });
        console.log(`  --> [APPLIED] Updated successfully.`);
      } else {
        console.log(`  --> [DRY RUN] Would update record without deleting.`);
      }
    }

    if (isDryRun && legacyItems.length > 0) {
      console.log(`\nTo commit this safe update to Atlas, execute:\n  node backend/scripts/migrateLegacyCementItem.js --apply`);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from Atlas.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateLegacyCement();
