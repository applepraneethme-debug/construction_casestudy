const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_for_automated_testing_phase4_5';

const { app } = require('../server');
const { User } = require('../models/User');
const Project = require('../models/Project');
const Site = require('../models/Site');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const Requisition = require('../models/Requisition');
const ConsumptionRecord = require('../models/ConsumptionRecord');
const WastageRecord = require('../models/WastageRecord');

describe('Phase 4 & Phase 5: Stock Ledger, Requisitions, Wastage & Reports Verification', () => {
  let mongoServer;
  let ownerToken;
  let managerToken;
  let engineerToken;
  let storekeeperToken;

  let testProjectId;
  let testSiteId;
  let testItemId;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // 1. Seed Owner
    const oHash = await User.hashPassword('OwnerPass123!');
    await User.create({
      name: 'Owner User',
      email: 'owner@ledger.com',
      passwordHash: oHash,
      role: 'Owner',
      assignedSites: [],
      isActive: true
    });

    // 2. Seed Material Manager (Site Central)
    const mHash = await User.hashPassword('ManagerPass123!');
    await User.create({
      name: 'Central Manager',
      email: 'manager@ledger.com',
      passwordHash: mHash,
      role: 'Material Manager',
      assignedSites: ['Site Central', 'Site West'],
      isActive: true
    });

    // 3. Seed Site Engineer (Site Central)
    const eHash = await User.hashPassword('EngineerPass123!');
    await User.create({
      name: 'Central Engineer',
      email: 'engineer@ledger.com',
      passwordHash: eHash,
      role: 'Site Engineer / Project Manager',
      assignedSites: ['Site Central'],
      isActive: true
    });

    // 4. Seed Storekeeper (Site Central)
    const sHash = await User.hashPassword('KeeperPass123!');
    await User.create({
      name: 'Central Keeper',
      email: 'keeper@ledger.com',
      passwordHash: sHash,
      role: 'Storekeeper',
      assignedSites: ['Site Central'],
      isActive: true
    });

    // Obtain tokens
    const oRes = await request(app).post('/api/auth/login').send({ email: 'owner@ledger.com', password: 'OwnerPass123!' });
    ownerToken = oRes.body.token;

    const mRes = await request(app).post('/api/auth/login').send({ email: 'manager@ledger.com', password: 'ManagerPass123!' });
    managerToken = mRes.body.token;

    const eRes = await request(app).post('/api/auth/login').send({ email: 'engineer@ledger.com', password: 'EngineerPass123!' });
    engineerToken = eRes.body.token;

    const sRes = await request(app).post('/api/auth/login').send({ email: 'keeper@ledger.com', password: 'KeeperPass123!' });
    storekeeperToken = sRes.body.token;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // ----------------------------------------------------
  // TEST GROUP 1: PROJECTS & SITES
  // ----------------------------------------------------
  describe('1. Projects and Sites Management', () => {
    it('Owner can create a construction project (201)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Metro Line Extension',
          code: 'MLX-01',
          description: 'Underground tunnel and station work',
          location: 'Downtown Corridor',
          budget: 5000000
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.project.code, 'MLX-01');
      testProjectId = res.body.project._id;
    });

    it('Duplicate project code is rejected (400)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Duplicate Project',
          code: 'MLX-01'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /already in use/i);
    });

    it('Storekeeper is DENIED creating projects (403)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          name: 'Unauthorized Project',
          code: 'UNAUTH-01'
        });

      assert.equal(res.status, 403);
    });

    it('Owner can create a site linked to the project (201)', async () => {
      const res = await request(app)
        .post('/api/sites')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Site Central',
          code: 'STE-CEN',
          project: testProjectId,
          address: 'Station Plaza, Sector 4'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.site.name, 'Site Central');
      testSiteId = res.body.site._id;
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 2: INVENTORY CRUD WITH SEARCH & SKU
  // ----------------------------------------------------
  describe('2. Inventory Management with SKU, Search, and Filtering', () => {
    it('Creates an inventory item with SKU, unitCost, and site (201)', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          itemName: 'Structural Steel Rebars 16mm',
          sku: 'STEEL-16MM-001',
          category: 'Material',
          quantity: 100,
          unit: 'pieces',
          supplier: 'ArcelorMittal',
          site: 'Site Central',
          minThreshold: 25,
          unitCost: 45
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.item.sku, 'STEEL-16MM-001');
      assert.equal(res.body.item.unitCost, 45);
      testItemId = res.body.item._id;
    });

    it('Search returns item matching SKU', async () => {
      const res = await request(app)
        .get('/api/inventory?search=STEEL-16MM')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.length >= 1);
      assert.equal(res.body[0].sku, 'STEEL-16MM-001');
    });

    it('Update (PUT) modifies unit cost and minimum threshold (200)', async () => {
      const res = await request(app)
        .put(`/api/inventory/${testItemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          unitCost: 48,
          minThreshold: 30
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.item.unitCost, 48);
      assert.equal(res.body.item.minThreshold, 30);
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 3: STOCK MOVEMENT LEDGER
  // ----------------------------------------------------
  describe('3. Stock Movement Ledger & Atomic Operations', () => {
    it('Stock receipt increases quantity atomically and logs movement (201)', async () => {
      const res = await request(app)
        .post('/api/movements/receipt')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          materialId: testItemId,
          quantity: 50,
          reference: 'PO-2026-991',
          reason: 'Supplier delivery'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.updatedBalance, 150); // 100 + 50

      const movement = await StockMovement.findOne({ material: testItemId, reference: 'PO-2026-991' });
      assert.ok(movement);
      assert.equal(movement.quantity, 50);
      assert.equal(movement.direction, 'inbound');
      assert.equal(movement.recordedByName, 'Central Keeper');
    });

    it('Stock issue decreases quantity atomically and logs movement (201)', async () => {
      const res = await request(app)
        .post('/api/movements/issue')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          materialId: testItemId,
          quantity: 20,
          activity: 'Pier Foundation 4',
          reference: 'ISS-001'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.remainingBalance, 130); // 150 - 20
    });

    it('Stock issue rejecting insufficient stock (Prevents negative stock) (400)', async () => {
      const res = await request(app)
        .post('/api/movements/issue')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          materialId: testItemId,
          quantity: 9999, // Exceeds 130
          activity: 'Over-request'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /insufficient stock/i);

      // Verify stock did not drop into negative
      const item = await InventoryItem.findById(testItemId);
      assert.equal(item.quantity, 130);
    });

    it('Stock return increases stock balance (201)', async () => {
      const res = await request(app)
        .post('/api/movements/return')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          materialId: testItemId,
          quantity: 5,
          reason: 'Unused bars returned from site'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.updatedBalance, 135); // 130 + 5
    });

    it('Stock transfer moves quantity from Site Central to Site West (201)', async () => {
      const res = await request(app)
        .post('/api/movements/transfer')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          materialId: testItemId,
          destinationSite: 'Site West',
          quantity: 15,
          reason: 'Urgent transfer for retaining wall'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.sourceBalance, 120); // 135 - 15 = 120

      // Verify destination item was created/updated at Site West
      const destItem = await InventoryItem.findOne({ itemName: 'Structural Steel Rebars 16mm', site: 'Site West' });
      assert.ok(destItem);
      assert.equal(destItem.quantity, 15);
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 4: MATERIAL REQUISITIONS & APPROVAL WORKFLOW
  // ----------------------------------------------------
  describe('4. Material Requisitions and Approvals', () => {
    let requisitionId;

    it('Site Engineer creates a requisition for construction activity (201)', async () => {
      const res = await request(app)
        .post('/api/requisitions')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          site: 'Site Central',
          activity: 'Bridge Deck Concreting',
          priority: 'High',
          items: [
            {
              material: testItemId,
              quantityRequested: 10
            }
          ],
          notes: 'Required for Monday pour'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.requisition.status, 'Pending');
      requisitionId = res.body.requisition._id;
    });

    it('Site Engineer CANNOT approve their own requisition (Separation of Duties - 403)', async () => {
      const res = await request(app)
        .patch(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${engineerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.message, /(separation of duties|lacks permission)/i);
    });

    it('Material Manager approves the requisition (200)', async () => {
      const res = await request(app)
        .patch(`/api/requisitions/${requisitionId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.requisition.status, 'Approved');
    });

    it('Storekeeper fulfills requisition: stock is deducted atomically (200)', async () => {
      const res = await request(app)
        .post(`/api/requisitions/${requisitionId}/fulfill`)
        .set('Authorization', `Bearer ${storekeeperToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.requisition.status, 'Fulfilled');

      // Verify stock was deducted: 120 - 10 = 110
      const item = await InventoryItem.findById(testItemId);
      assert.equal(item.quantity, 110);
    });

    it('Requisition cannot be fulfilled twice (Prevents duplicate issue) (400)', async () => {
      const res = await request(app)
        .post(`/api/requisitions/${requisitionId}/fulfill`)
        .set('Authorization', `Bearer ${storekeeperToken}`);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /already been fulfilled/i);

      // Verify stock remains exactly 110
      const item = await InventoryItem.findById(testItemId);
      assert.equal(item.quantity, 110);
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 5: PLANNED VS ACTUAL CONSUMPTION
  // ----------------------------------------------------
  describe('5. Planned vs Actual Consumption Control', () => {
    it('Records consumption and calculates excess quantity and percentage', async () => {
      const res = await request(app)
        .post('/api/consumption')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          site: 'Site Central',
          activity: 'Bridge Pier 4 Concreting',
          materialId: testItemId,
          expectedQty: 50,
          actualQty: 60,
          varianceReason: 'Over-excavation required larger foundation footing'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.excessQty, 10); // 60 - 50 = 10
      assert.equal(res.body.excessPercentage, 20); // (10 / 50) * 100 = 20%
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 6: PHYSICAL WASTAGE REGISTER
  // ----------------------------------------------------
  describe('6. Physical Wastage Register & Financial Loss Tracking', () => {
    it('Records physical wastage, deducts stock once, and calculates financial loss (201)', async () => {
      const res = await request(app)
        .post('/api/wastage')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          materialId: testItemId,
          quantity: 4,
          reason: 'Cutting Loss',
          notes: 'Excess cut-offs from irregular slab rebar spacing'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.remainingStock, 106); // 110 - 4 = 106
      assert.equal(res.body.wastage.financialImpact, 4 * 48); // 192 (unitCost was updated to 48)

      // Verify a corresponding StockMovement was created with movementType 'wastage'
      const movement = await StockMovement.findById(res.body.stockMovement._id);
      assert.ok(movement);
      assert.equal(movement.movementType, 'wastage');
      assert.equal(movement.quantity, 4);
    });

    it('Rejects wastage quantity exceeding available stock (400)', async () => {
      const res = await request(app)
        .post('/api/wastage')
        .set('Authorization', `Bearer ${storekeeperToken}`)
        .send({
          materialId: testItemId,
          quantity: 500, // Available is only 106
          reason: 'Breakage'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /insufficient stock/i);
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 7: AGGREGATED REPORTS & REAL METRICS
  // ----------------------------------------------------
  describe('7. Aggregated Real-Time Dashboard Reports', () => {
    it('Returns accurate real-time metrics computed directly from database', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.inventory.totalItems >= 2);
      assert.ok(res.body.inventory.totalValuation > 0);
      assert.equal(res.body.wastage.totalWastageRecords, 1);
      assert.equal(res.body.wastage.totalWastageQuantity, 4);
      assert.equal(res.body.wastage.totalWastageCost, 192);
      assert.ok(res.body.consumption.excessCount >= 1);
      assert.ok(res.body.projects.activeProjects >= 1);
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
});

