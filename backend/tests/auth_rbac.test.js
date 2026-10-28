const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_for_automated_testing_key_123';

const { app } = require('../server');
const { User } = require('../models/User');
const InventoryItem = require('../models/InventoryItem');
const AuditLog = require('../models/AuditLog');

describe('Phase 2 & Phase 3: Authentication and RBAC Verification Suite', () => {
  let mongoServer;
  let ownerToken;
  let materialManagerToken;
  let siteEngineerToken;
  let storekeeperToken;
  let sampleItemId;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // 1. Seed Owner
    const ownerHash = await User.hashPassword('OwnerPass123!');
    const owner = await User.create({
      name: 'Test Owner',
      email: 'owner@test.com',
      passwordHash: ownerHash,
      role: 'Owner',
      assignedSites: [],
      isActive: true
    });

    // 2. Seed Material Manager (Assigned only to Site Alpha)
    const mmHash = await User.hashPassword('ManagerPass123!');
    const mm = await User.create({
      name: 'Alpha Manager',
      email: 'manager@test.com',
      passwordHash: mmHash,
      role: 'Material Manager',
      assignedSites: ['Site Alpha'],
      isActive: true
    });

    // 3. Seed Site Engineer
    const seHash = await User.hashPassword('EngineerPass123!');
    const se = await User.create({
      name: 'Test Engineer',
      email: 'engineer@test.com',
      passwordHash: seHash,
      role: 'Site Engineer',
      assignedSites: ['Site Alpha'],
      isActive: true
    });

    // 4. Seed Storekeeper
    const skHash = await User.hashPassword('KeeperPass123!');
    const sk = await User.create({
      name: 'Test Storekeeper',
      email: 'keeper@test.com',
      passwordHash: skHash,
      role: 'Storekeeper',
      assignedSites: ['Site Alpha'],
      isActive: true
    });

    // 5. Seed Inactive User
    const inHash = await User.hashPassword('InactivePass123!');
    await User.create({
      name: 'Inactive User',
      email: 'inactive@test.com',
      passwordHash: inHash,
      role: 'Storekeeper',
      assignedSites: ['Site Alpha'],
      isActive: false
    });

    // 6. Seed Legacy Inventory Item (no site specified, defaults to General Site)
    const legacyItem = await InventoryItem.create({
      itemName: 'Portland Cement',
      category: 'Material',
      quantity: 50,
      unit: 'bags',
      supplier: 'UltraTech Supplies',
      site: 'General Site'
    });
    sampleItemId = legacyItem._id.toString();

    // Authenticate users to retrieve Bearer tokens
    const ownerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@test.com', password: 'OwnerPass123!' });
    ownerToken = ownerRes.body.token;

    const mmRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'ManagerPass123!' });
    materialManagerToken = mmRes.body.token;

    const seRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'engineer@test.com', password: 'EngineerPass123!' });
    siteEngineerToken = seRes.body.token;

    const skRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'keeper@test.com', password: 'KeeperPass123!' });
    storekeeperToken = skRes.body.token;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // ----------------------------------------------------
  // TEST GROUP 1: AUTHENTICATION
  // ----------------------------------------------------
  describe('Authentication Tests', () => {
    it('1. Should login successfully with valid credentials and return user info', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'owner@test.com', password: 'OwnerPass123!' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'owner@test.com');
      assert.equal(res.body.user.role, 'Owner');
      assert.equal(res.body.user.passwordHash, undefined); // Password hash must never be exposed
      assert.ok(res.body.token);
    });

    it('2. Should reject login with invalid password (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'owner@test.com', password: 'WrongPassword' });

      assert.equal(res.status, 401);
      assert.match(res.body.message, /invalid email or password/i);
    });

    it('3. Should reject login for non-existent user (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'AnyPassword' });

      assert.equal(res.status, 401);
    });

    it('4. Should reject login for deactivated user (403)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inactive@test.com', password: 'InactivePass123!' });

      assert.equal(res.status, 403);
      assert.match(res.body.message, /deactivated/i);
    });

    it('5. Should reject unauthenticated requests to protected endpoints (401)', async () => {
      const res = await request(app).get('/api/inventory');
      assert.equal(res.status, 401);
      assert.match(res.body.message, /authentication required/i);
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 2: ROLE-BASED ACCESS CONTROL (RBAC)
  // ----------------------------------------------------
  describe('RBAC Permission Tests', () => {
    it('6. Owner can access and list all users via /api/users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 4);
    });

    it('7. Storekeeper is DENIED access to user management /api/users (403)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${storekeeperToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.message, /lacks permission/i);
    });

    it('8. Site Engineer is DENIED deleting an inventory item (403)', async () => {
      const res = await request(app)
        .delete(`/api/inventory/${sampleItemId}`)
        .set('Authorization', `Bearer ${siteEngineerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.message, /lacks permission/i);
    });

    it('9. Material Manager CAN create an inventory item at their assigned site (201)', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${materialManagerToken}`)
        .send({
          itemName: 'Steel Rebars 12mm',
          category: 'Material',
          quantity: 120,
          unit: 'pieces',
          supplier: 'Tata Steel',
          site: 'Site Alpha',
          minThreshold: 20
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.item.itemName, 'Steel Rebars 12mm');
      assert.equal(res.body.item.site, 'Site Alpha');
    });

    it('10. Material Manager CAN update an inventory item at their assigned site (200)', async () => {
      const res = await request(app)
        .put(`/api/inventory/${sampleItemId}`)
        .set('Authorization', `Bearer ${materialManagerToken}`)
        .send({
          unitCost: 85,
          minThreshold: 20
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.item.unitCost, 85);
      assert.equal(res.body.item.minThreshold, 20);
    });

    it('10b. Direct quantity editing via PUT is rejected to protect ledger integrity (400)', async () => {
      const res = await request(app)
        .put(`/api/inventory/${sampleItemId}`)
        .set('Authorization', `Bearer ${materialManagerToken}`)
        .send({
          quantity: 999
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Direct quantity modification/i);
    });
  });

  // ----------------------------------------------------
  // TEST GROUP 3: CROSS-SITE ACCESS & DATA INTEGRITY
  // ----------------------------------------------------
  describe('Cross-Site Access Denial & Input Validation', () => {
    it('11. Material Manager is DENIED adding items to unassigned site (Site Beta) (403)', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${materialManagerToken}`)
        .send({
          itemName: 'Unauthorized Gravel',
          category: 'Material',
          quantity: 10,
          unit: 'tons',
          supplier: 'Quarry Ltd',
          site: 'Site Beta' // Not assigned to Material Manager
        });

      assert.equal(res.status, 403);
      assert.match(res.body.message, /do not have permission to add materials to site 'Site Beta'/i);
    });

    it('12. Rejects invalid and negative inventory quantities (400)', async () => {
      const res = await request(app)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          itemName: 'Safety Helmets',
          category: 'Equipment',
          quantity: -25, // Negative quantity
          unit: 'pieces',
          supplier: 'Safety First',
          site: 'Site Alpha'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /non-negative/i);
    });

    it('13. Rejects invalid MongoDB ObjectId formats (400)', async () => {
      const res = await request(app)
        .delete('/api/inventory/invalid-object-id-123')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 400);
      assert.match(res.body.message, /invalid item id/i);
    });

    it('14. Owner can create user, and action is recorded in AuditLog', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'New Field Engineer',
          email: 'field_eng@test.com',
          password: 'Password123!',
          role: 'Site Engineer / Project Manager',
          assignedSites: ['Site Beta']
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.user.email, 'field_eng@test.com');

      // Verify audit log
      const audit = await AuditLog.findOne({ action: 'USER_CREATED', 'details.createdUserEmail': 'field_eng@test.com' });
      assert.ok(audit, 'Audit log entry should exist');
      assert.equal(audit.performedByEmail, 'owner@test.com');
    });

    it('15. Owner cannot deactivate their own active Owner account (Anti-Lockout Protection)', async () => {
      const ownerUser = await User.findOne({ email: 'owner@test.com' });
      const res = await request(app)
        .patch(`/api/users/${ownerUser._id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isActive: false });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /cannot deactivate your own active owner account/i);
    });

    it('16. Owner can delete inventory item (200)', async () => {
      const res = await request(app)
        .delete(`/api/inventory/${sampleItemId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.match(res.body.message, /removed successfully/i);
    });
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
});

