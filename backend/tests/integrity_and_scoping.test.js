const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_for_integrity_and_scoping_tests';

const { app } = require('../server');
const { User } = require('../models/User');
const Project = require('../models/Project');
const Site = require('../models/Site');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const Requisition = require('../models/Requisition');

describe('Integrity & Scoping Verification Suite', () => {
  let mongoServer;
  let ownerToken;
  let managerToken;
  let isolatedUserToken;
  let storekeeperToken;

  let testProject;
  let siteAlpha;
  let siteBeta;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // 1. Owner
    const oHash = await User.hashPassword('OwnerPass123!');
    await User.create({
      name: 'Integrity Owner',
      email: 'owner@integrity.com',
      passwordHash: oHash,
      role: 'Owner',
      assignedSites: [],
      isActive: true
    });

    // 2. Manager with assigned sites Alpha & Beta
    const mHash = await User.hashPassword('ManagerPass123!');
    await User.create({
      name: 'Alpha Manager',
      email: 'manager@integrity.com',
      passwordHash: mHash,
      role: 'Material Manager',
      assignedSites: ['Site Alpha', 'Site Beta'],
      isActive: true
    });

    // 3. User with 0 assigned sites
    const isoHash = await User.hashPassword('IsoPass123!');
    await User.create({
      name: 'Unassigned Engineer',
      email: 'isolated@integrity.com',
      passwordHash: isoHash,
      role: 'Site Engineer',
      assignedSites: [],
      isActive: true
    });

    // 4. Storekeeper
    const sHash = await User.hashPassword('StorePass123!');
    await User.create({
      name: 'Alpha Storekeeper',
      email: 'store@integrity.com',
      passwordHash: sHash,
      role: 'Storekeeper',
      assignedSites: ['Site Alpha', 'Site Beta'],
      isActive: true
    });

    // Logins
    const oRes = await request(app).post('/api/auth/login').send({ email: 'owner@integrity.com', password: 'OwnerPass123!' });
    ownerToken = oRes.body.token;

    const mRes = await request(app).post('/api/auth/login').send({ email: 'manager@integrity.com', password: 'ManagerPass123!' });
    managerToken = mRes.body.token;

    const isoRes = await request(app).post('/api/auth/login').send({ email: 'isolated@integrity.com', password: 'IsoPass123!' });
    isolatedUserToken = isoRes.body.token;

    const sRes = await request(app).post('/api/auth/login').send({ email: 'store@integrity.com', password: 'StorePass123!' });
    storekeeperToken = sRes.body.token;

    // Create project and sites
    testProject = await Project.create({
      name: 'Integrity Metro Project',
      code: 'IMP-01',
      status: 'Active',
      budget: 5000000
    });

    siteAlpha = await Site.create({
      name: 'Site Alpha',
      code: 'SA-01',
      project: testProject._id,
      status: 'Active'
    });

    siteBeta = await Site.create({
      name: 'Site Beta',
      code: 'SB-01',
      project: testProject._id,
      status: 'Active'
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('1. Inventory Ledger Integrity & Opening Balance', () => {
    let createdItemId;

    it('Automatically logs opening balance in StockMovement when item created with qty > 0', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemName: 'Structural Steel I-Beams',
          category: 'Material',
          quantity: 80,
          unit: 'tonne',
          unitCost: 65000,
          supplier: 'ABC Suppliers Ltd',
          site: 'Site Alpha',
          project: testProject._id.toString()
        });

      assert.equal(res.status, 201);
      createdItemId = res.body.item._id;

      const movement = await StockMovement.findOne({ material: createdItemId, reference: 'OPENING-BALANCE' });
      assert.ok(movement, 'Opening balance stock movement must be recorded');
      assert.equal(movement.movementType, 'receipt');
      assert.equal(movement.direction, 'inbound');
      assert.equal(movement.quantity, 80);
      assert.equal(movement.site, 'Site Alpha');
    });

    it('Strictly rejects direct PUT quantity modification (400)', async () => {
      const res = await request(app)
        .put(`/api/inventory/${createdItemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          quantity: 999
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Direct quantity modification.*prohibited/i);

      // Verify item quantity remains unchanged in DB
      const item = await InventoryItem.findById(createdItemId);
      assert.equal(item.quantity, 80);
    });

    it('Allows PUT modification of non-quantity fields like unitCost and minThreshold', async () => {
      const res = await request(app)
        .put(`/api/inventory/${createdItemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          unitCost: 67000,
          minThreshold: 15
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.item.unitCost, 67000);
      assert.equal(res.body.item.minThreshold, 15);
      assert.equal(res.body.item.quantity, 80);
    });
  });

  describe('2. Dual Opposite Ledger Entries for Inter-Site Transfers', () => {
    let transferItemId;

    before(async () => {
      const item = await InventoryItem.create({
        itemName: 'Portland Pozzolana Cement',
        category: 'Material',
        quantity: 200,
        unit: 'bags',
        unitCost: 380,
        supplier: 'UltraTech Cement Ltd',
        site: 'Site Alpha',
        project: testProject._id
      });
      transferItemId = item._id;
    });

    it('Creates outbound entry for source site and inbound entry for destination with matching transferGroupId', async () => {
      const res = await request(app)
        .post('/api/movements/transfer')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          materialId: transferItemId.toString(),
          destinationSite: 'Site Beta',
          quantity: 60,
          reason: 'Urgent foundation pour requirement'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.sourceBalance, 140);
      assert.equal(res.body.destBalance, 60);

      const transferGroupId = res.body.transferGroupId;
      assert.ok(transferGroupId, 'Must return a transferGroupId');

      // Verify both entries in ledger
      const movements = await StockMovement.find({ transferGroupId });
      assert.equal(movements.length, 2, 'Must have exactly 2 movements for a transfer');

      const outbound = movements.find((m) => m.direction === 'outbound');
      const inbound = movements.find((m) => m.direction === 'inbound');

      assert.ok(outbound, 'Must have outbound movement');
      assert.equal(outbound.site, 'Site Alpha');
      assert.equal(outbound.quantity, 60);

      assert.ok(inbound, 'Must have inbound movement');
      assert.equal(inbound.site, 'Site Beta');
      assert.equal(inbound.quantity, 60);
    });
  });

  describe('3. Requisition Concurrency & All-or-Nothing Rollback', () => {
    let matA, matB;
    let requisitionId;

    before(async () => {
      matA = await InventoryItem.create({
        itemName: 'Ready-Mix Concrete M30',
        category: 'Material',
        quantity: 50,
        unit: 'cubic metres',
        unitCost: 4500,
        supplier: 'RMC Readymix Ltd',
        site: 'Site Alpha',
        project: testProject._id
      });

      matB = await InventoryItem.create({
        itemName: 'TMT Steel Bars 16mm',
        category: 'Material',
        quantity: 10, // Only 10 available
        unit: 'tonne',
        unitCost: 62000,
        supplier: 'Tata Tiscon Ltd',
        site: 'Site Alpha',
        project: testProject._id
      });

      // Site Alpha requisition requesting 20 m3 of matA (available) and 25 tonnes of matB (exceeds 10)
      const req = await Requisition.create({
        requisitionNumber: 'REQ-ROLLBACK-01',
        project: testProject._id,
        site: 'Site Alpha',
        activity: 'Column Casting Block B',
        priority: 'High',
        requestedBy: testProject._id, // placeholder
        requestedByName: 'Test Requester',
        requestedByRole: 'Site Engineer',
        status: 'Approved',
        items: [
          {
            material: matA._id,
            materialName: matA.itemName,
            quantityRequested: 20,
            quantityIssued: 0,
            unit: matA.unit
          },
          {
            material: matB._id,
            materialName: matB.itemName,
            quantityRequested: 25, // More than the 10 available
            quantityIssued: 0,
            unit: matB.unit
          }
        ]
      });
      requisitionId = req._id;
    });

    it('Fails fulfillment and rolls back: matA is not deducted, and status remains Approved', async () => {
      const res = await request(app)
        .post(`/api/requisitions/${requisitionId}/fulfill`)
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send();

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Insufficient stock/i);

      // Verify matA was not permanently decremented
      const checkA = await InventoryItem.findById(matA._id);
      assert.equal(checkA.quantity, 50, 'matA stock must be completely preserved');

      // Verify requisition status reverted from Processing back to Approved
      const checkReq = await Requisition.findById(requisitionId);
      assert.equal(checkReq.status, 'Approved');
    });
  });

  describe('4. Safe Archiving / Soft Delete on Inventory Items', () => {
    let itemWithHistoryId;

    before(async () => {
      const item = await InventoryItem.create({
        itemName: 'High-Tensile Wire 4mm',
        category: 'Material',
        quantity: 100,
        unit: 'kg',
        unitCost: 95,
        supplier: 'Wire Corp Ltd',
        site: 'Site Alpha'
      });
      itemWithHistoryId = item._id;

      // Add a stock movement referencing it
      await StockMovement.create({
        material: item._id,
        materialName: item.itemName,
        site: 'Site Alpha',
        movementType: 'receipt',
        direction: 'inbound',
        quantity: 100,
        unit: 'kg',
        unitCost: 95,
        totalValue: 9500,
        reference: 'INITIAL',
        reason: 'Opening',
        recordedBy: testProject._id,
        recordedByName: 'Admin',
        recordedByRole: 'Owner',
        status: 'completed'
      });
    });

    it('Archives item rather than hard-deleting when transactions exist', async () => {
      const res = await request(app)
        .delete(`/api/inventory/${itemWithHistoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.archived, true);
      assert.match(res.body.message, /safely archived/i);

      // Verify item still exists with isArchived: true
      const item = await InventoryItem.findById(itemWithHistoryId);
      assert.ok(item);
      assert.equal(item.isArchived, true);

      // Verify default GET /api/inventory omits archived items
      const listRes = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${ownerToken}`);
      const found = listRes.body.find((i) => i._id.toString() === itemWithHistoryId.toString());
      assert.equal(found, undefined, 'Archived item must not appear in standard inventory list');
    });
  });

  describe('5. Zero Assigned Sites Strict Isolation', () => {
    it('User with 0 assigned sites receives empty array from /api/inventory', async () => {
      const res = await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${isolatedUserToken}`);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it('User with 0 assigned sites receives empty array from /api/movements', async () => {
      const res = await request(app)
        .get('/api/movements')
        .set('Authorization', `Bearer ${isolatedUserToken}`);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it('User with 0 assigned sites receives empty array from /api/requisitions', async () => {
      const res = await request(app)
        .get('/api/requisitions')
        .set('Authorization', `Bearer ${isolatedUserToken}`);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it('User with 0 assigned sites receives empty array from /api/sites', async () => {
      const res = await request(app)
        .get('/api/sites')
        .set('Authorization', `Bearer ${isolatedUserToken}`);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    it('User with 0 assigned sites receives empty array from /api/projects', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${isolatedUserToken}`);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });
  });

  describe('6. Zero Minimum Threshold Evaluation', () => {
    it('Item with minThreshold: 0 and quantity: 5 is NOT marked low-stock in dashboard', async () => {
      await InventoryItem.create({
        itemName: 'Surplus Scrap Wire',
        category: 'Material',
        quantity: 5,
        minThreshold: 0,
        unit: 'metres',
        unitCost: 10,
        supplier: 'Havells India Ltd',
        site: 'Site Alpha'
      });

      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      const lowStockItems = res.body.inventory.lowStockItems;
      const found = lowStockItems.find((i) => i.itemName === 'Surplus Scrap Wire');
      assert.equal(found, undefined, 'Item with quantity 5 and minThreshold 0 must not be low stock');
    });
  });
});
