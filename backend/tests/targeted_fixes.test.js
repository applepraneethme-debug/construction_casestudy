const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_for_automated_testing_key_123';

const { app } = require('../server');
const { User } = require('../models/User');
const Project = require('../models/Project');
const Site = require('../models/Site');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const Requisition = require('../models/Requisition');

describe('Targeted Fixes Verification Suite (Phases 1-6)', () => {
  let mongoServer;
  let ownerToken;
  let managerToken;
  let engineerToken;
  let projectAlpha;
  let siteAlpha;
  let siteBeta;
  let itemAlpha;

  before(async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // 1. Projects and Sites
    projectAlpha = await Project.create({ name: 'Alpha Metro', code: 'AM-01' });
    siteAlpha = await Site.create({ name: 'Site Alpha - Yard', code: 'SAY', project: projectAlpha._id });
    siteBeta = await Site.create({ name: 'Site Beta - Station', code: 'SBS', project: projectAlpha._id });

    // 2. Users
    const ownerHash = await User.hashPassword('OwnerPass123!');
    await User.create({
      name: 'Owner User',
      email: 'owner_fixes@test.com',
      passwordHash: ownerHash,
      role: 'Owner',
      assignedSites: [],
      isActive: true
    });

    const mgrHash = await User.hashPassword('MgrPass123!');
    await User.create({
      name: 'Manager User',
      email: 'manager_fixes@test.com',
      passwordHash: mgrHash,
      role: 'Material Manager',
      assignedSites: ['Site Alpha - Yard', 'Site Beta - Station'],
      isActive: true
    });

    const engHash = await User.hashPassword('EngPass123!');
    await User.create({
      name: 'Engineer User',
      email: 'eng_fixes@test.com',
      passwordHash: engHash,
      role: 'Site Engineer',
      assignedSites: ['Site Alpha - Yard'],
      isActive: true
    });

    // 3. Inventory Item
    itemAlpha = await InventoryItem.create({
      itemName: 'Reinforcement Steel 16mm',
      sku: 'STL-BAR-16',
      category: 'Material',
      quantity: 100,
      unit: 'tonne',
      supplier: 'Steel Corp',
      site: 'Site Alpha - Yard',
      unitCost: 55000,
      minThreshold: 15
    });

    // 4. Log in
    const oRes = await request(app).post('/api/auth/login').send({ email: 'owner_fixes@test.com', password: 'OwnerPass123!' });
    ownerToken = oRes.body.token;

    const mRes = await request(app).post('/api/auth/login').send({ email: 'manager_fixes@test.com', password: 'MgrPass123!' });
    managerToken = mRes.body.token;

    const eRes = await request(app).post('/api/auth/login').send({ email: 'eng_fixes@test.com', password: 'EngPass123!' });
    engineerToken = eRes.body.token;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Phase 1: Stock Ledger Direction & Hooks', () => {
    it('StockMovement automatically sets outbound direction for issue and wastage', async () => {
      const issueMov = new StockMovement({
        material: itemAlpha._id,
        materialName: itemAlpha.itemName,
        site: 'Site Alpha - Yard',
        movementType: 'issue',
        quantity: 5,
        unit: 'tonne',
        unitCost: 55000,
        totalValue: 275000,
        reason: 'Site activity issue test',
        recordedBy: new mongoose.Types.ObjectId(),
        recordedByName: 'Tester',
        recordedByRole: 'Material Manager'
      });
      await issueMov.validate();
      assert.equal(issueMov.direction, 'outbound');

      const wasteMov = new StockMovement({
        material: itemAlpha._id,
        materialName: itemAlpha.itemName,
        site: 'Site Alpha - Yard',
        movementType: 'wastage',
        quantity: 1,
        unit: 'tonne',
        unitCost: 55000,
        totalValue: 55000,
        reason: 'Physical wastage test',
        recordedBy: new mongoose.Types.ObjectId(),
        recordedByName: 'Tester',
        recordedByRole: 'Material Manager'
      });
      await wasteMov.validate();
      assert.equal(wasteMov.direction, 'outbound');
    });

    it('StockMovement sets inbound direction for receipt and return', async () => {
      const receiptMov = new StockMovement({
        material: itemAlpha._id,
        materialName: itemAlpha.itemName,
        site: 'Site Alpha - Yard',
        movementType: 'receipt',
        quantity: 20,
        unit: 'tonne',
        unitCost: 55000,
        totalValue: 1100000,
        reason: 'Vendor receipt test',
        recordedBy: new mongoose.Types.ObjectId(),
        recordedByName: 'Tester',
        recordedByRole: 'Material Manager'
      });
      await receiptMov.validate();
      assert.equal(receiptMov.direction, 'inbound');

      const returnMov = new StockMovement({
        material: itemAlpha._id,
        materialName: itemAlpha.itemName,
        site: 'Site Alpha - Yard',
        movementType: 'return',
        quantity: 2,
        unit: 'tonne',
        unitCost: 55000,
        totalValue: 110000,
        reason: 'Unused material return test',
        recordedBy: new mongoose.Types.ObjectId(),
        recordedByName: 'Tester',
        recordedByRole: 'Material Manager'
      });
      await returnMov.validate();
      assert.equal(returnMov.direction, 'inbound');
    });
  });

  describe('Phase 2: Requisition Fulfillment Integrity', () => {
    it('Requisition schema supports Processing status and defers ledger insertion', async () => {
      const reqDoc = await Requisition.create({
        requisitionNumber: 'REQ-TEST-PROC-01',
        site: 'Site Alpha - Yard',
        activity: 'Foundation Piling',
        priority: 'High',
        items: [
          {
            material: itemAlpha._id,
            materialName: itemAlpha.itemName,
            quantityRequested: 10,
            quantityIssued: 0,
            unit: itemAlpha.unit
          }
        ],
        status: 'Approved',
        requestedBy: new mongoose.Types.ObjectId(),
        requestedByName: 'Test User',
        requestedByRole: 'Site Engineer'
      });

      assert.equal(reqDoc.status, 'Approved');

      // Fulfill requisition
      const fulfillRes = await request(app)
        .post(`/api/requisitions/${reqDoc._id}/fulfill`)
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(fulfillRes.status, 200);
      assert.equal(fulfillRes.body.requisition.status, 'Fulfilled');

      // Check stock deducted
      const updatedItem = await InventoryItem.findById(itemAlpha._id);
      assert.equal(updatedItem.quantity, 90);

      // Verify StockMovement exists with direction: outbound
      const mov = await StockMovement.findOne({ linkedRequisition: reqDoc._id });
      assert.ok(mov);
      assert.equal(mov.direction, 'outbound');
      assert.equal(mov.movementType, 'issue');
    });

    it('Rejects cross-site requisition creation', async () => {
      const crossReq = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          site: 'Site Beta - Station',
          activity: 'Station Beam Pour',
          items: [
            {
              material: itemAlpha._id, // itemAlpha is at Site Alpha - Yard!
              quantityRequested: 5
            }
          ]
        });

      assert.equal(crossReq.status, 400);
      assert.match(crossReq.body.message, /Cross-site requisitions are not permitted/i);
    });

    it('Rolls back inventory and restores requisition to Approved without orphaned ledger entries if ledger insertion fails', async () => {
      const initialQty = (await InventoryItem.findById(itemAlpha._id)).quantity;

      const reqDoc = await Requisition.create({
        requisitionNumber: 'REQ-TEST-LEDGER-FAIL-01',
        site: 'Site Alpha - Yard',
        activity: 'Roof Trusses Erection',
        priority: 'High',
        items: [
          {
            material: itemAlpha._id,
            materialName: itemAlpha.itemName,
            quantityRequested: 15,
            quantityIssued: 0,
            unit: itemAlpha.unit
          }
        ],
        status: 'Approved',
        requestedBy: new mongoose.Types.ObjectId(),
        requestedByName: 'Test User',
        requestedByRole: 'Site Engineer'
      });

      // Stub StockMovement.insertMany to simulate ledger write failure
      const originalInsertMany = StockMovement.insertMany;
      StockMovement.insertMany = async () => {
        throw new Error('Simulated database ledger write failure');
      };

      try {
        const res = await request(app)
          .post(`/api/requisitions/${reqDoc._id}/fulfill`)
          .set('Authorization', `Bearer ${managerToken}`);

        assert.equal(res.status, 400);
        assert.match(res.body.message, /Fulfillment failed and was rolled back/i);

        // Verify inventory quantity was refunded and not decremented
        const itemAfter = await InventoryItem.findById(itemAlpha._id);
        assert.equal(itemAfter.quantity, initialQty, 'Inventory quantity must be completely restored');

        // Verify requisition status was restored to Approved and quantityIssued is 0
        const reqAfter = await Requisition.findById(reqDoc._id);
        assert.equal(reqAfter.status, 'Approved', 'Requisition status must be reverted to Approved');
        assert.equal(reqAfter.items[0].quantityIssued, 0, 'quantityIssued must be 0');

        // Verify NO stock movements were inserted
        const movements = await StockMovement.find({ linkedRequisition: reqDoc._id });
        assert.equal(movements.length, 0, 'Zero stock movements must exist for failed fulfillment');
      } finally {
        StockMovement.insertMany = originalInsertMany;
      }
    });
  });

  describe('Phase 3: Material ID Validation & Per-Site SKU Uniqueness', () => {
    it('Rejects invalid materialId in /api/movements/transfer with 400', async () => {
      const res = await request(app)
        .post('/api/movements/transfer')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          materialId: 'not-a-valid-id',
          destinationSite: 'Site Beta - Station',
          quantity: 5
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid material ID format/i);
    });

    it('Rejects invalid materialId in /api/movements/adjustment with 400', async () => {
      const res = await request(app)
        .post('/api/movements/adjustment')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          materialId: 'invalid-id-xyz',
          newPhysicalQuantity: 80
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid material ID format/i);
    });

    it('Rejects duplicate SKU at the same site (400)', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemName: 'Another Steel Bar',
          sku: 'STL-BAR-16', // Same SKU as itemAlpha
          category: 'Material',
          quantity: 20,
          unit: 'tonne',
          supplier: 'Alt Supplier',
          site: 'Site Alpha - Yard' // Same site!
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /already exists at site/i);
    });

    it('Allows identical SKU at a different site (201)', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemName: 'Beta Steel Rebars',
          sku: 'STL-BAR-16', // Same SKU
          category: 'Material',
          quantity: 30,
          unit: 'tonne',
          supplier: 'Beta Supplier',
          site: 'Site Beta - Station' // Different site!
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.item.sku, 'STL-BAR-16');
      assert.equal(res.body.item.site, 'Site Beta - Station');
    });
  });

  describe('Phase 5: Consumption Site Derived from Material', () => {
    it('Records consumption using material site and ignores cross-site overrides', async () => {
      const res = await request(app)
        .post('/api/consumption')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          materialId: itemAlpha._id,
          activity: 'Pier Concreting',
          expectedQty: 20,
          actualQty: 22,
          varianceReason: 'Over-reinforcement specification'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.record.site, 'Site Alpha - Yard');
      assert.equal(res.body.record.materialName, itemAlpha.itemName);
      assert.equal(res.body.excessQty, 2);
    });

    it('Rejects consumption with invalid materialId format (400)', async () => {
      const res = await request(app)
        .post('/api/consumption')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          materialId: 'not-valid-id',
          activity: 'Pier Concreting',
          expectedQty: 10,
          actualQty: 10
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Invalid material ID format/i);
    });
  });

  describe('Phase 6: User Assigned Site Validation', () => {
    it('Rejects non-existent site when Owner creates user (400)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Invalid Site Employee',
          email: 'invalid_site_emp@test.com',
          password: 'Password123!',
          role: 'Storekeeper',
          assignedSites: ['NonExistentSite99']
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /do not exist in the system/i);
    });

    it('Accepts registered sites when Owner creates user (201)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Valid Site Employee',
          email: 'valid_site_emp@test.com',
          password: 'Password123!',
          role: 'Storekeeper',
          assignedSites: ['Site Alpha - Yard']
        });

      assert.equal(res.status, 201);
      assert.deepEqual(res.body.user.assignedSites, ['Site Alpha - Yard']);
    });
  });
});
