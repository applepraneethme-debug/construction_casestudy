require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function auditData() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing from backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    console.log('Connected to MongoDB Atlas: ' + mongoose.connection.name);

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
    const Site = mongoose.model('Site', new mongoose.Schema({}, { strict: false }));
    const InventoryItem = mongoose.model('InventoryItem', new mongoose.Schema({}, { strict: false }));
    const StockMovement = mongoose.model('StockMovement', new mongoose.Schema({}, { strict: false }));
    const Requisition = mongoose.model('Requisition', new mongoose.Schema({}, { strict: false }));
    const ConsumptionRecord = mongoose.model('ConsumptionRecord', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({}, { name: 1, email: 1, role: 1, assignedSites: 1, isActive: 1 }).lean();
    console.log('\n--- USERS (' + users.length + ') ---');
    users.forEach(u => console.log(`• ${u.name} <${u.email}> [${u.role}] Sites: ${JSON.stringify(u.assignedSites)} Active: ${u.isActive}`));

    const projects = await Project.find({}, { name: 1, code: 1, status: 1 }).lean();
    console.log('\n--- PROJECTS (' + projects.length + ') ---');
    projects.forEach(p => console.log(`• ${p.name} (${p.code}) Status: ${p.status}`));

    const sites = await Site.find({}, { name: 1, code: 1, project: 1, status: 1 }).lean();
    console.log('\n--- SITES (' + sites.length + ') ---');
    sites.forEach(s => console.log(`• ${s.name} (${s.code}) ProjectRef: ${s.project} Status: ${s.status}`));

    const items = await InventoryItem.find({}, { itemName: 1, sku: 1, site: 1, quantity: 1, unit: 1, unitCost: 1, isArchived: 1 }).lean();
    console.log('\n--- INVENTORY ITEMS (' + items.length + ') ---');
    items.forEach(it => console.log(`• ID: ${it._id} | "${it.itemName}" | SKU: ${it.sku || '(NONE)'} | Site: "${it.site}" | Qty: ${it.quantity} ${it.unit} | Cost: ₹${it.unitCost} | Archived: ${it.isArchived}`));

    const movements = await StockMovement.find({}, { movementType: 1, direction: 1, materialName: 1, quantity: 1, site: 1, reference: 1 }).lean();
    console.log('\n--- STOCK MOVEMENTS (' + movements.length + ') ---');
    movements.forEach(m => console.log(`• [${m.movementType}] Dir: ${m.direction} | ${m.materialName} (${m.quantity}) @ "${m.site}" | Ref: ${m.reference}`));

    const requisitions = await Requisition.find({}, { requisitionNumber: 1, site: 1, status: 1, activity: 1 }).lean();
    console.log('\n--- REQUISITIONS (' + requisitions.length + ') ---');
    requisitions.forEach(r => console.log(`• ${r.requisitionNumber} | Site: "${r.site}" | Status: ${r.status} | Activity: ${r.activity}`));

    const consumptions = await ConsumptionRecord.find({}, { activity: 1, site: 1, materialName: 1, expectedQty: 1, actualQty: 1 }).lean();
    console.log('\n--- CONSUMPTION RECORDS (' + consumptions.length + ') ---');
    consumptions.forEach(c => console.log(`• Activity: ${c.activity} | Site: "${c.site}" | Mat: ${c.materialName} (Exp: ${c.expectedQty}, Act: ${c.actualQty})`));

    console.log('\n=== AUDIT ANALYSIS SUMMARY ===');
    const itemsWithoutSite = items.filter(it => !it.site || it.site === 'General Site');
    if (itemsWithoutSite.length > 0) {
      console.log(`⚠️ Legacy / Unassigned Inventory Items found: ${itemsWithoutSite.length}`);
      itemsWithoutSite.forEach(it => console.log(`   - "${it.itemName}" (ID: ${it._id}, site: ${it.site})`));
    } else {
      console.log('✅ All inventory items have assigned construction sites.');
    }

    const itemsWithoutSku = items.filter(it => !it.sku || it.sku.trim() === '');
    if (itemsWithoutSku.length > 0) {
      console.log(`⚠️ Inventory Items without SKU found: ${itemsWithoutSku.length}`);
      itemsWithoutSku.forEach(it => console.log(`   - "${it.itemName}" (ID: ${it._id})`));
    } else {
      console.log('✅ All inventory items have SKUs.');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from Atlas.');
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
}

auditData();
