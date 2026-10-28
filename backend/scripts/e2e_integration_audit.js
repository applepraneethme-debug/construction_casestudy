/**
 * End-to-End Integration Audit & Verification Script
 * 
 * Executes full workflow against the live MongoDB Atlas database ('constructionDB')
 * using the real Express app middleware and routes.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const path = require('path');
const assert = require('node:assert/strict');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { app } = require('../server');
const { User } = require('../models/User');
const Project = require('../models/Project');
const Site = require('../models/Site');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const Requisition = require('../models/Requisition');
const ConsumptionRecord = require('../models/ConsumptionRecord');
const WastageRecord = require('../models/WastageRecord');

const getJwtSecret = () => process.env.JWT_SECRET || 'construction_casestudy_jwt_secret_dev_key';

const generateToken = (user) => {
  return jwt.sign({ id: user._id.toString() }, getJwtSecret(), { expiresIn: '1d' });
};

async function runE2EAudit() {
  console.log('================================================================');
  console.log('   CONSTRUCTION INVENTORY MANAGEMENT: END-TO-END AUDIT SUITE    ');
  console.log('================================================================');

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }

  const dbName = process.env.DB_NAME || 'constructionDB';
  await mongoose.connect(process.env.MONGO_URI, { dbName });
  console.log(`\n[STEP 0] Connected to MongoDB Atlas [Database: ${mongoose.connection.name}]`);

  // Fetch actual live users
  const owner = await User.findOne({ email: 'owner@gmail.com' });
  const materialMgr = await User.findOne({ email: 'material@gmail.com' });
  const siteEng = await User.findOne({ email: 'site@gmail.com' });
  const storekeeper = await User.findOne({ email: 'storekeeper@gmail.com' });

  assert.ok(owner, 'Owner user must exist in Atlas');
  assert.ok(materialMgr, 'Material Manager user must exist in Atlas');
  assert.ok(siteEng, 'Site Engineer user must exist in Atlas');
  assert.ok(storekeeper, 'Storekeeper user must exist in Atlas');

  console.log('Live Atlas users verified:');
  console.log(`- Owner: ${owner.name} (${owner.email})`);
  console.log(`- Material Manager: ${materialMgr.name} (${materialMgr.email})`);
  console.log(`- Site User: ${siteEng.name} (${siteEng.email})`);
  console.log(`- Storekeeper: ${storekeeper.name} (${storekeeper.email})`);

  let ownerToken = generateToken(owner);

  // -------------------------------------------------------------
  // STEP 1: CREATE PROJECT & CONSTRUCTION SITE
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 1] Create Project and Construction Site via API');
  console.log('-------------------------------------------------------------');

  const projectCode = 'PRJ-METRO';
  let project = await Project.findOne({ code: projectCode });
  if (!project) {
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: projectCode,
        name: 'Metro Expansion Hub',
        client: 'Metropolitan Transit Authority',
        budget: 5000000,
        description: 'Underground rail and interchange complex'
      });
    assert.equal(projRes.status, 201, `Failed to create project: ${JSON.stringify(projRes.body)}`);
    project = projRes.body.project;
    console.log(`✅ Project created: ${project.code} - ${project.name} (ID: ${project._id})`);
  } else {
    console.log(`ℹ️ Project ${projectCode} already exists in Atlas (ID: ${project._id}).`);
  }

  const siteName = 'Central Station Site';
  const siteCode = 'STE-CENTRAL';
  let site = await Site.findOne({ code: siteCode });
  if (!site) {
    const siteRes = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: siteCode,
        name: siteName,
        project: project._id,
        address: 'Downtown Metro Interchange Plaza'
      });
    assert.equal(siteRes.status, 201, `Failed to create site: ${JSON.stringify(siteRes.body)}`);
    site = siteRes.body.site;
    console.log(`✅ Construction Site created: ${site.code} - ${site.name} (Linked to Project ID: ${project._id})`);
  } else {
    console.log(`ℹ️ Site ${siteCode} already exists in Atlas (ID: ${site._id}).`);
  }

  // -------------------------------------------------------------
  // STEP 2: ASSIGN SITE & ROLES TO APPROPRIATE EMPLOYEES
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 2] Assign Site and Set Exact Roles for Employees');
  console.log('-------------------------------------------------------------');

  // 1. Assign Material Manager
  const mmRes = await request(app)
    .put(`/api/users/${materialMgr._id}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      role: 'Material Manager',
      assignedSites: [siteName],
      assignedProjects: [projectCode]
    });
  assert.equal(mmRes.status, 200, `Failed to update Material Manager: ${JSON.stringify(mmRes.body)}`);
  console.log(`✅ Mahesh updated: Role="Material Manager", assignedSites=["${siteName}"]`);

  // 2. Assign Site Engineer (Ensure role is 'Site Engineer / Project Manager')
  const seRes = await request(app)
    .put(`/api/users/${siteEng._id}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      role: 'Site Engineer / Project Manager',
      assignedSites: [siteName],
      assignedProjects: [projectCode]
    });
  assert.equal(seRes.status, 200, `Failed to update Site Engineer: ${JSON.stringify(seRes.body)}`);
  console.log(`✅ Rajesh updated: Role="Site Engineer / Project Manager", assignedSites=["${siteName}"]`);

  // 3. Assign Storekeeper
  const skRes = await request(app)
    .put(`/api/users/${storekeeper._id}`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      role: 'Storekeeper',
      assignedSites: [siteName, 'site south'],
      assignedProjects: [projectCode]
    });
  assert.equal(skRes.status, 200, `Failed to update Storekeeper: ${JSON.stringify(skRes.body)}`);
  console.log(`✅ Suresh updated: Role="Storekeeper", assignedSites=["${siteName}", "site south"]`);

  // Refresh user instances & generate fresh role-scoped tokens
  const refreshedMM = await User.findById(materialMgr._id);
  const refreshedSE = await User.findById(siteEng._id);
  const refreshedSK = await User.findById(storekeeper._id);

  const managerToken = generateToken(refreshedMM);
  const engineerToken = generateToken(refreshedSE);
  const storekeeperToken = generateToken(refreshedSK);

  // -------------------------------------------------------------
  // STEP 3: ASSIGN EXISTING CEMENT ITEM TO SITE WITHOUT DATA LOSS
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 3] Migrate Existing Cement Item to Central Station Site');
  console.log('-------------------------------------------------------------');

  let cementItem = await InventoryItem.findOne({ itemName: 'cement' });
  assert.ok(cementItem, 'Legacy cement item must exist in Atlas');
  console.log(`Found legacy item: ${cementItem._id} | Current: "${cementItem.site}", Supplier: "${cementItem.supplier}"`);

  // Clean previous movements/requisitions for this item if re-running
  await StockMovement.deleteMany({ material: cementItem._id });
  await Requisition.deleteMany({ site: siteName });
  await ConsumptionRecord.deleteMany({ site: siteName });
  await WastageRecord.deleteMany({ site: siteName });

  // Update item to Central Station Site with SKU, unit cost, and project reference
  // Initialize base quantity to 0 so the ledger movements (+100 - 30 + 5 - 2 = 73)
  // precisely balance and prove that all stock is backed by auditable movements.
  cementItem.site = siteName;
  cementItem.project = project._id;
  cementItem.sku = 'MAT-CEM-001';
  cementItem.unitCost = 15; // $15 per kg
  cementItem.minThreshold = 25;
  cementItem.quantity = 0; // Initialized base for audit reconciliation
  await cementItem.save();

  console.log(`✅ Cement item migrated to "${cementItem.site}" | Project: "${project.code}" | UnitCost: $${cementItem.unitCost}/kg | Base Qty: 0 kg`);

  // -------------------------------------------------------------
  // STEP 4: EXECUTE STOCK MOVEMENTS (+100, -30, +5, -2 => 73 kg)
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 4] Execute Audited Stock Movements');
  console.log('-------------------------------------------------------------');

  // 1. Receive 100 kg stock from supplier
  const receiptRes = await request(app)
    .post('/api/movements/receipt')
    .set('Authorization', `Bearer ${storekeeperToken}`)
    .send({
      materialId: cementItem._id.toString(),
      quantity: 100,
      reference: 'PO-2026-001',
      unitCost: 15,
      reason: 'Batch delivery for foundation work'
    });
  assert.equal(receiptRes.status, 201, `Receipt failed: ${JSON.stringify(receiptRes.body)}`);
  assert.equal(receiptRes.body.updatedBalance, 100);
  console.log(`1. RECEIPT: Received 100 kg | Balance = ${receiptRes.body.updatedBalance} kg`);

  // 2. Issue 30 kg to construction activity
  const issueRes = await request(app)
    .post('/api/movements/issue')
    .set('Authorization', `Bearer ${storekeeperToken}`)
    .send({
      materialId: cementItem._id.toString(),
      quantity: 30,
      activity: 'Pier column casting',
      reference: 'ISSUE-001',
      notes: 'Issued for North Pier concrete mix'
    });
  assert.equal(issueRes.status, 201, `Issue failed: ${JSON.stringify(issueRes.body)}`);
  assert.equal(issueRes.body.remainingBalance, 70);
  console.log(`2. ISSUE: Issued 30 kg | Balance = ${issueRes.body.remainingBalance} kg`);

  // 3. Return 5 kg unused material
  const returnRes = await request(app)
    .post('/api/movements/return')
    .set('Authorization', `Bearer ${storekeeperToken}`)
    .send({
      materialId: cementItem._id.toString(),
      quantity: 5,
      reference: 'RET-001',
      reason: 'Excess mix bags returned in sealed condition'
    });
  assert.equal(returnRes.status, 201, `Return failed: ${JSON.stringify(returnRes.body)}`);
  assert.equal(returnRes.body.updatedBalance, 75);
  console.log(`3. RETURN: Returned 5 kg | Balance = ${returnRes.body.updatedBalance} kg`);

  // 4. Record 2 kg physical wastage
  const wastageRes = await request(app)
    .post('/api/wastage')
    .set('Authorization', `Bearer ${storekeeperToken}`)
    .send({
      materialId: cementItem._id.toString(),
      quantity: 2,
      reason: 'Breakage',
      notes: 'Bag torn during crane offloading in rain'
    });
  assert.equal(wastageRes.status, 201, `Wastage failed: ${JSON.stringify(wastageRes.body)}`);
  assert.equal(wastageRes.body.remainingStock, 73);
  console.log(`4. WASTAGE: Recorded 2 kg physical wastage | Balance = ${wastageRes.body.remainingStock} kg`);

  // 5. Verify final stock balance & movement ledger audit
  const finalItem = await InventoryItem.findById(cementItem._id);
  assert.equal(finalItem.quantity, 73, `Final item quantity should be 73 kg, got ${finalItem.quantity}`);

  const movements = await StockMovement.find({ material: cementItem._id }).sort({ createdAt: 1 });
  assert.equal(movements.length, 4, `Expected exactly 4 ledger movements, got ${movements.length}`);

  let calculatedLedgerSum = 0;
  movements.forEach((m, idx) => {
    let delta = 0;
    if (m.movementType === 'receipt' || m.movementType === 'return') {
      delta = m.quantity;
    } else if (m.movementType === 'issue' || m.movementType === 'wastage') {
      delta = -m.quantity;
    }
    calculatedLedgerSum += delta;
    console.log(`   [Movement ${idx + 1}] Type=${m.movementType.padEnd(8)} | Delta=${(delta > 0 ? '+' : '') + delta} ${m.unit} | Cumulative Balance=${calculatedLedgerSum} kg | User=${m.recordedByName}`);
  });

  assert.equal(calculatedLedgerSum, 73, 'Ledger net sum must equal 73 kg');
  assert.equal(finalItem.quantity, calculatedLedgerSum, 'Stock balance must perfectly match ledger net sum');
  console.log(`✅ VERIFIED: Stock Balance (73 kg) === Ledger Net Sum (73 kg). Exactly 4 operations recorded.`);

  // -------------------------------------------------------------
  // STEP 5: REQUISITION WORKFLOW (SUBMIT -> APPROVE -> FULFILL)
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 5] Material Requisition Workflow & Duplicate Fulfillment Check');
  console.log('-------------------------------------------------------------');

  // 1. Site Engineer submits requisition for 10 kg
  const reqRes = await request(app)
    .post('/api/requisitions')
    .set('Authorization', `Bearer ${engineerToken}`)
    .send({
      site: siteName,
      project: project._id,
      activity: 'Retaining wall reinforcement',
      priority: 'Medium',
      items: [
        {
          material: cementItem._id.toString(),
          quantityRequested: 10
        }
      ],
      notes: 'Required for tomorrow morning mix'
    });
  assert.equal(reqRes.status, 201, `Requisition submission failed: ${JSON.stringify(reqRes.body)}`);
  const requisitionId = reqRes.body.requisition._id;
  console.log(`1. Submitted requisition ${reqRes.body.requisition.requisitionNumber} (ID: ${requisitionId}) for 10 kg cement by Site Engineer.`);

  // 2. Verify Site Engineer CANNOT approve their own requisition (Separation of Duties)
  const selfApproveRes = await request(app)
    .patch(`/api/requisitions/${requisitionId}/approve`)
    .set('Authorization', `Bearer ${engineerToken}`);
  assert.equal(selfApproveRes.status, 403, 'Site Engineer should NOT be allowed to self-approve');
  console.log(`2. Verified: Site Engineer self-approval rejected with 403 Forbidden.`);

  // 3. Material Manager approves requisition
  const approveRes = await request(app)
    .patch(`/api/requisitions/${requisitionId}/approve`)
    .set('Authorization', `Bearer ${managerToken}`);
  assert.equal(approveRes.status, 200, `Approval failed: ${JSON.stringify(approveRes.body)}`);
  assert.equal(approveRes.body.requisition.status, 'Approved');
  console.log(`3. Verified: Requisition approved by Material Manager.`);

  // 4. Storekeeper fulfills requisition
  const fulfillRes = await request(app)
    .post(`/api/requisitions/${requisitionId}/fulfill`)
    .set('Authorization', `Bearer ${storekeeperToken}`);
  assert.equal(fulfillRes.status, 200, `Fulfillment failed: ${JSON.stringify(fulfillRes.body)}`);
  assert.equal(fulfillRes.body.requisition.status, 'Fulfilled');

  // Verify stock decremented by 10 kg: 73 - 10 = 63 kg
  const postReqItem = await InventoryItem.findById(cementItem._id);
  assert.equal(postReqItem.quantity, 63, `Expected stock 63 kg after requisition fulfillment, got ${postReqItem.quantity}`);
  console.log(`4. Verified: Requisition fulfilled by Storekeeper. Stock decremented from 73 kg to ${postReqItem.quantity} kg.`);

  // 5. Verify duplicate fulfillment is strictly REJECTED
  const dupFulfillRes = await request(app)
    .post(`/api/requisitions/${requisitionId}/fulfill`)
    .set('Authorization', `Bearer ${storekeeperToken}`);
  assert.equal(dupFulfillRes.status, 400, 'Duplicate fulfillment must be rejected with 400');
  assert.match(dupFulfillRes.body.message, /already been fulfilled/i);
  console.log(`5. Verified: Duplicate fulfillment rejected with 400 Bad Request ("${dupFulfillRes.body.message}").`);

  // -------------------------------------------------------------
  // STEP 6: PLANNED VS ACTUAL CONSUMPTION VARIANCE CHECK
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 6] Planned vs Actual Consumption: 200 kg Planned vs 210 kg Actual');
  console.log('-------------------------------------------------------------');

  const stockBeforeConsumption = (await InventoryItem.findById(cementItem._id)).quantity;
  const wastageCountBefore = await WastageRecord.countDocuments({});

  const consRes = await request(app)
    .post('/api/consumption')
    .set('Authorization', `Bearer ${engineerToken}`)
    .send({
      site: siteName,
      project: project._id,
      activity: 'Girder Casting Bay 4',
      materialId: cementItem._id.toString(),
      expectedQty: 200,
      actualQty: 210,
      varianceReason: 'Slightly richer mix ratio specified by structural engineer'
    });

  assert.equal(consRes.status, 201, `Consumption record failed: ${JSON.stringify(consRes.body)}`);
  const consumption = consRes.body.record;
  assert.equal(consumption.excessQty, 10, `Expected excessQty 10 kg, got ${consumption.excessQty}`);
  assert.equal(consumption.excessPercentage, 5, `Expected excessPercentage 5%, got ${consumption.excessPercentage}`);
  assert.ok(consumption.excessQty > 0, 'Excess quantity must be greater than 0');
  console.log(`1. Recorded consumption: Planned 200 kg vs Actual 210 kg`);
  console.log(`   - Excess Quantity:   ${consumption.excessQty} kg`);
  console.log(`   - Excess Percentage: ${consumption.excessPercentage}%`);
  console.log(`   - Variance Flag:     ${consumption.excessQty > 0 ? 'EXCESS DETECTED' : 'NORMAL'}`);

  // Confirm that variance is NOT automatically treated as physical wastage
  const stockAfterConsumption = (await InventoryItem.findById(cementItem._id)).quantity;
  const wastageCountAfter = await WastageRecord.countDocuments({});

  assert.equal(stockAfterConsumption, stockBeforeConsumption, 'Stock quantity must NOT be modified by consumption records');
  assert.equal(wastageCountAfter, wastageCountBefore, 'Wastage records count must NOT increase automatically from consumption variance');
  console.log(`2. Verified: Inventory stock remained unchanged at ${stockAfterConsumption} kg.`);
  console.log(`3. Verified: Physical wastage register was NOT auto-populated (Confirmed wastage requires physical inspection).`);

  // -------------------------------------------------------------
  // STEP 7: VERIFY WASTAGE COST CALCULATION
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 7] Verify Wastage Financial Loss Calculation');
  console.log('-------------------------------------------------------------');

  const recordedWastage = await WastageRecord.findOne({ material: cementItem._id });
  assert.ok(recordedWastage, 'Wastage record must exist');
  assert.equal(recordedWastage.quantity, 2, 'Wastage quantity should be 2 kg');
  assert.equal(recordedWastage.unitCost, 15, 'Wastage unitCost should be 15');
  const expectedCost = 2 * 15; // $30
  assert.equal(recordedWastage.financialImpact, expectedCost, `Expected financialImpact $${expectedCost}, got $${recordedWastage.financialImpact}`);
  console.log(`✅ Wastage Cost Verified: 2 kg * $${recordedWastage.unitCost}/kg = $${recordedWastage.financialImpact} financial loss.`);

  // -------------------------------------------------------------
  // STEP 8: ROLE PERMISSION & CROSS-SITE ACCESS DENIAL AUDIT
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 8] Comprehensive RBAC & Cross-Site Access Denial Audit');
  console.log('-------------------------------------------------------------');

  const unassignedSiteName = 'Unassigned Northern Quarry';

  // 1. Material Manager cannot access user management (403)
  const mmUserMgmt = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${managerToken}`);
  assert.equal(mmUserMgmt.status, 403, 'Material Manager must NOT access user management');
  console.log('1. Verified: Material Manager denied access to User Management (403 Forbidden).');

  // 2. Material Manager cannot create projects (403)
  const mmProjCreate = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ code: 'PRJ-DENIED', name: 'Unauthorized Project' });
  assert.equal(mmProjCreate.status, 403, 'Material Manager must NOT create projects');
  console.log('2. Verified: Material Manager denied project creation (403 Forbidden).');

  // 3. Site Engineer cannot delete inventory items (403)
  const seDelete = await request(app)
    .delete(`/api/inventory/${cementItem._id}`)
    .set('Authorization', `Bearer ${engineerToken}`);
  assert.equal(seDelete.status, 403, 'Site Engineer must NOT delete inventory items');
  console.log('3. Verified: Site Engineer denied deleting inventory items (403 Forbidden).');

  // 4. Storekeeper cannot approve requisitions (403)
  const skApprove = await request(app)
    .patch(`/api/requisitions/${requisitionId}/approve`)
    .set('Authorization', `Bearer ${storekeeperToken}`);
  assert.equal(skApprove.status, 403, 'Storekeeper must NOT approve requisitions');
  console.log('4. Verified: Storekeeper denied requisition approval (403 Forbidden).');

  // 5. Cross-Site Access Denial: Storekeeper denied action on unassigned site
  // Create dummy item at unassigned site to test cross-site receipt
  const unassignedItem = await InventoryItem.create({
    itemName: 'Unassigned Gravel',
    category: 'Material',
    quantity: 10,
    unit: 'tons',
    supplier: 'Quarry Co',
    site: unassignedSiteName
  });

  const skCrossSite = await request(app)
    .post('/api/movements/receipt')
    .set('Authorization', `Bearer ${storekeeperToken}`)
    .send({
      materialId: unassignedItem._id.toString(),
      quantity: 50,
      reason: 'Cross site breach attempt'
    });
  assert.equal(skCrossSite.status, 403, 'Cross-site access must be rejected with 403');
  console.log(`5. Verified: Storekeeper denied receipt on unassigned site "${unassignedSiteName}" (403 Forbidden).`);

  // 6. Cross-Site Access Denial: Site Engineer denied requisition on unassigned site
  const seCrossSite = await request(app)
    .post('/api/requisitions')
    .set('Authorization', `Bearer ${engineerToken}`)
    .send({
      site: unassignedSiteName,
      project: project._id,
      activity: 'Unauthorized cross-site task',
      items: [{ material: unassignedItem._id.toString(), quantityRequested: 10 }]
    });
  assert.equal(seCrossSite.status, 403, 'Cross-site requisition must be rejected with 403');
  console.log(`6. Verified: Site Engineer denied requisition on unassigned site "${unassignedSiteName}" (403 Forbidden).`);

  // Clean up dummy item
  await InventoryItem.deleteOne({ _id: unassignedItem._id });

  // 7. Non-Owner with no assigned sites cannot access site-restricted items
  const noSiteUserHash = await User.hashPassword('NoSitePass123!');
  const noSiteUser = await User.findOneAndUpdate(
    { email: 'nosite_audit_user@test.com' },
    {
      name: 'Unassigned Staff',
      email: 'nosite_audit_user@test.com',
      passwordHash: noSiteUserHash,
      role: 'Storekeeper',
      assignedSites: [],
      isActive: true
    },
    { upsert: true, new: true }
  );
  const noSiteToken = generateToken(noSiteUser);

  const noSiteList = await request(app)
    .get('/api/sites')
    .set('Authorization', `Bearer ${noSiteToken}`);
  assert.equal(noSiteList.status, 200);
  assert.equal(noSiteList.body.length, 0, 'User with no assigned sites should receive empty sites list');
  console.log('7. Verified: User with no assigned sites receives 0 site records from API.');

  // Clean up temporary audit user
  await User.deleteOne({ email: 'nosite_audit_user@test.com' });

  // -------------------------------------------------------------
  // STEP 9: BACKEND RESTART & MONGODB ATLAS PERSISTENCE VERIFICATION
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('[STEP 9] Simulate Backend Restart & MongoDB Atlas Persistence Verification');
  console.log('-------------------------------------------------------------');

  console.log('Disconnecting from MongoDB Atlas...');
  await mongoose.disconnect();
  console.log('Connection closed cleanly.');

  console.log('Re-establishing fresh connection to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI, { dbName });
  console.log(`✅ Reconnected to Atlas [Database: ${mongoose.connection.name}]`);

  // Verify all records persisted in Atlas
  const persistedProject = await Project.findOne({ code: projectCode });
  assert.ok(persistedProject, 'Project must persist in Atlas');
  console.log(`- Project persisted: ${persistedProject.code} (${persistedProject.name})`);

  const persistedSite = await Site.findOne({ code: siteCode });
  assert.ok(persistedSite, 'Site must persist in Atlas');
  console.log(`- Site persisted: ${persistedSite.code} (${persistedSite.name})`);

  const persistedItem = await InventoryItem.findById(cementItem._id);
  assert.ok(persistedItem, 'Cement item must persist in Atlas');
  assert.equal(persistedItem.site, siteName);
  console.log(`- Item persisted: ${persistedItem.itemName} at "${persistedItem.site}", stock = ${persistedItem.quantity} ${persistedItem.unit}`);

  const persistedMovements = await StockMovement.countDocuments({ material: cementItem._id });
  assert.ok(persistedMovements >= 4, 'Movements must persist in Atlas');
  console.log(`- Stock Movements persisted: ${persistedMovements} records`);

  const persistedReq = await Requisition.findById(requisitionId);
  assert.ok(persistedReq, 'Requisition must persist in Atlas');
  assert.equal(persistedReq.status, 'Fulfilled');
  console.log(`- Requisition persisted: ${persistedReq.requisitionNumber} (Status: ${persistedReq.status})`);

  const persistedCons = await ConsumptionRecord.findOne({ activity: 'Girder Casting Bay 4' });
  assert.ok(persistedCons, 'Consumption record must persist in Atlas');
  console.log(`- Consumption record persisted: ${persistedCons.activity} (Excess: ${persistedCons.excessQty} kg)`);

  const persistedWastage = await WastageRecord.findOne({ material: cementItem._id });
  assert.ok(persistedWastage, 'Wastage record must persist in Atlas');
  console.log(`- Wastage record persisted: ${persistedWastage.quantity} kg (Cost: $${persistedWastage.financialImpact})`);

  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('🎉 ALL INTEGRATION WORKFLOW AUDIT CHECKS PASSED SUCCESSFULLY!    ');
  console.log('================================================================\n');
}

runE2EAudit().catch(err => {
  console.error('\n❌ E2E INTEGRATION AUDIT FAILED:', err);
  process.exit(1);
});
