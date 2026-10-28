/**
 * Safe Demo / Seed Data Script for College FSD Lab Presentation
 * Populates realistic construction projects, sites, materials (with INR currency),
 * verified role users, stock movements, requisitions, consumption records, and wastage.
 *
 * Usage:
 *   node scripts/seedDemoData.js
 *
 * Note: Preserves existing records; does NOT drop collections.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { User } = require('../models/User');
const Project = require('../models/Project');
const Site = require('../models/Site');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const Requisition = require('../models/Requisition');
const ConsumptionRecord = require('../models/ConsumptionRecord');
const WastageRecord = require('../models/WastageRecord');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not set in backend/.env');
  process.exit(1);
}

const seed = async () => {
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB Atlas:', mongoose.connection.name);

    // 1. Projects
    console.log('\n📁 Ensuring Projects exist...');
    let metroProject = await Project.findOne({ code: 'MRV-01' });
    if (!metroProject) {
      metroProject = await Project.create({
        name: 'Metro Rail Viaduct Package A',
        code: 'MRV-01',
        description: 'Elevated viaduct and station piers construction (Ch. 12+400 to 18+200)',
        location: 'North Corridor, Metro Sector 4',
        status: 'Active',
        budget: 15000000 // ₹1.5 Crore
      });
      console.log('   + Created Project:', metroProject.name);
    } else {
      console.log('   ✓ Project already exists:', metroProject.name);
    }

    let commercialProject = await Project.findOne({ code: 'CTA-02' });
    if (!commercialProject) {
      commercialProject = await Project.create({
        name: 'Commercial Tech Park Alpha',
        code: 'CTA-02',
        description: 'G+14 Commercial IT Office Complex with Double Basement Parking',
        location: 'Phase 2 Tech Zone',
        status: 'Active',
        budget: 8500000 // ₹85 Lakhs
      });
      console.log('   + Created Project:', commercialProject.name);
    } else {
      console.log('   ✓ Project already exists:', commercialProject.name);
    }

    // 2. Sites
    console.log('\n🏗️ Ensuring Sites exist...');
    const siteNames = {
      central: 'Site Central - Station Yard',
      west: 'Site West - Pier Construction'
    };

    let siteCentral = await Site.findOne({ name: siteNames.central });
    if (!siteCentral) {
      siteCentral = await Site.create({
        name: siteNames.central,
        code: 'SC-01',
        project: metroProject._id,
        address: 'Plot 14, Metro Casting Yard, Industrial Area',
        status: 'Active'
      });
      console.log('   + Created Site:', siteCentral.name);
    } else {
      console.log('   ✓ Site already exists:', siteCentral.name);
    }

    let siteWest = await Site.findOne({ name: siteNames.west });
    if (!siteWest) {
      siteWest = await Site.create({
        name: siteNames.west,
        code: 'SW-02',
        project: metroProject._id,
        address: 'Pier Location P12-P30, West Corridor Bypass',
        status: 'Active'
      });
      console.log('   + Created Site:', siteWest.name);
    } else {
      console.log('   ✓ Site already exists:', siteWest.name);
    }

    // 3. Demo Users (4 Roles)
    console.log('\n👥 Ensuring Demo Accounts for all 4 Roles exist...');
    const demoUsers = [
      {
        email: 'owner@construction.com',
        name: 'Rajesh Sharma (Owner)',
        role: 'Owner',
        assignedSites: [],
        password: 'OwnerPass123!'
      },
      {
        email: 'manager@construction.com',
        name: 'Priya Nair (Material Manager)',
        role: 'Material Manager',
        assignedSites: [siteNames.central, siteNames.west],
        password: 'ManagerPass123!'
      },
      {
        email: 'engineer@construction.com',
        name: 'Amit Patel (Site Engineer)',
        role: 'Site Engineer',
        assignedSites: [siteNames.central],
        password: 'EngineerPass123!'
      },
      {
        email: 'storekeeper@construction.com',
        name: 'Suresh Kumar (Storekeeper)',
        role: 'Storekeeper',
        assignedSites: [siteNames.central, siteNames.west],
        password: 'StorePass123!'
      }
    ];

    const seededUsers = {};
    for (const u of demoUsers) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        const passwordHash = await User.hashPassword(u.password);
        user = await User.create({
          email: u.email,
          name: u.name,
          role: u.role,
          assignedSites: u.assignedSites,
          passwordHash,
          isActive: true
        });
        console.log(`   + Created ${u.role}: ${u.email} (Password: ${u.password})`);
      } else {
        // Ensure assigned sites are updated
        user.assignedSites = u.assignedSites;
        await user.save();
        console.log(`   ✓ User already exists: ${u.email} [${u.role}]`);
      }
      seededUsers[u.role] = user;
    }

    // 4. Sample Materials with INR Costs
    console.log('\n📦 Ensuring Sample Inventory Items exist with Opening Balances...');
    const demoMaterials = [
      {
        itemName: 'TMT Steel Rebars 16mm (Fe500D)',
        category: 'Material',
        sku: 'STL-TMT-16',
        quantity: 45,
        unit: 'tonne',
        unitCost: 62500, // ₹62,500 / tonne
        minThreshold: 10,
        supplier: 'Tata Tiscon Steel Ltd',
        site: siteNames.central,
        project: metroProject._id,
        storageLocation: 'Yard Bay 3 - Rebar Shed'
      },
      {
        itemName: 'Ordinary Portland Cement 53 Grade',
        category: 'Material',
        sku: 'CEM-OPC-53',
        quantity: 400,
        unit: 'bags',
        unitCost: 410, // ₹410 / bag
        minThreshold: 80,
        supplier: 'UltraTech Cement Ltd',
        site: siteNames.central,
        project: metroProject._id,
        storageLocation: 'Covered Godown A'
      },
      {
        itemName: 'River Sand (Coarse Zone II)',
        category: 'Material',
        sku: 'AGG-SND-02',
        quantity: 85,
        unit: 'cubic metres',
        unitCost: 1850, // ₹1,850 / m3
        minThreshold: 20,
        supplier: 'Krishna River Aggregates',
        site: siteNames.central,
        project: metroProject._id,
        storageLocation: 'Bulk Storage Bay 1'
      },
      {
        itemName: 'Crushed Granite Aggregate 20mm',
        category: 'Material',
        sku: 'AGG-GRN-20',
        quantity: 130,
        unit: 'cubic metres',
        unitCost: 1450, // ₹1,450 / m3
        minThreshold: 25,
        supplier: 'Deccan Quarry Works',
        site: siteNames.central,
        project: metroProject._id,
        storageLocation: 'Bulk Storage Bay 2'
      },
      {
        itemName: 'PVC Electrical Conduits 25mm Heavy Duty',
        category: 'Material',
        sku: 'ELE-PVC-25',
        quantity: 450,
        unit: 'metres',
        unitCost: 65, // ₹65 / m
        minThreshold: 100,
        supplier: 'Finolex Pipes & Cables Ltd',
        site: siteNames.west,
        project: metroProject._id,
        storageLocation: 'Electrical Store Room 1'
      }
    ];

    const seededItems = [];
    for (const mat of demoMaterials) {
      let item = await InventoryItem.findOne({ itemName: mat.itemName, site: mat.site });
      if (!item) {
        item = await InventoryItem.create(mat);
        console.log(`   + Created Item: ${mat.itemName} (${mat.quantity} ${mat.unit} @ ₹${mat.unitCost})`);

        // Record opening balance in stock ledger
        await StockMovement.create({
          material: item._id,
          materialName: item.itemName,
          site: item.site,
          project: item.project,
          movementType: 'receipt',
          direction: 'inbound',
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          totalValue: Number((item.quantity * item.unitCost).toFixed(2)),
          reference: 'OPENING-BALANCE',
          reason: 'Initial demo opening stock registered',
          recordedBy: seededUsers['Owner']._id,
          recordedByName: seededUsers['Owner'].name,
          recordedByRole: 'Owner',
          status: 'completed',
          notes: 'Opening stock balance for lab presentation'
        });
      } else {
        console.log(`   ✓ Item already exists: ${mat.itemName}`);
      }
      seededItems.push(item);
    }

    // 5. Sample Requisition (Fulfilled)
    console.log('\n📋 Ensuring Sample Requisition exists...');
    const cementItem = seededItems.find((i) => i.sku === 'CEM-OPC-53');
    if (cementItem) {
      let req = await Requisition.findOne({ requisitionNumber: 'REQ-DEMO-2026-001' });
      if (!req) {
        req = await Requisition.create({
          requisitionNumber: 'REQ-DEMO-2026-001',
          project: metroProject._id,
          site: siteNames.central,
          activity: 'Pier Cap Concrete Batching (Pier P-14)',
          priority: 'High',
          requestedBy: seededUsers['Site Engineer']._id,
          requestedByName: seededUsers['Site Engineer'].name,
          requestedByRole: 'Site Engineer',
          status: 'Fulfilled',
          approvedBy: seededUsers['Material Manager']._id,
          approvedByName: seededUsers['Material Manager'].name,
          approvalDate: new Date(Date.now() - 3600000 * 24),
          fulfilledDate: new Date(),
          items: [
            {
              material: cementItem._id,
              materialName: cementItem.itemName,
              quantityRequested: 50,
              quantityIssued: 50,
              unit: cementItem.unit
            }
          ],
          notes: 'Batching plant requisition for pier cap grade M40'
        });
        console.log('   + Created Fulfilled Requisition:', req.requisitionNumber);
      } else {
        console.log('   ✓ Requisition already exists:', req.requisitionNumber);
      }
    }

    // 6. Sample Planned vs Actual Consumption
    console.log('\n📊 Ensuring Consumption Variance Record exists...');
    if (cementItem) {
      let cons = await ConsumptionRecord.findOne({ site: siteNames.central, activity: 'Pier Cap P-14 Pour' });
      if (!cons) {
        const expected = 48;
        const actual = 50;
        const excess = actual - expected;
        const percentage = Number(((excess / expected) * 100).toFixed(2));
        cons = await ConsumptionRecord.create({
          project: metroProject._id,
          projectName: metroProject.name,
          site: siteNames.central,
          activity: 'Pier Cap P-14 Pour',
          material: cementItem._id,
          materialName: cementItem.itemName,
          unit: cementItem.unit,
          expectedQty: expected,
          actualQty: actual,
          excessQty: excess,
          excessPercentage: percentage,
          varianceReason: 'Slump adjustment and minor pump pipeline waste during hot weather pour',
          reportingUser: seededUsers['Site Engineer']._id,
          reportingUserName: seededUsers['Site Engineer'].name
        });
        console.log(`   + Created Consumption Record: Expected ${expected} ${cementItem.unit}, Actual ${actual} ${cementItem.unit} (Variance: +${excess} ${cementItem.unit}, ${percentage}%)`);
      } else {
        console.log('   ✓ Consumption record already exists');
      }
    }

    // 7. Sample Physical Wastage Record
    console.log('\n🗑️ Ensuring Physical Wastage Record exists...');
    if (cementItem) {
      let waste = await WastageRecord.findOne({ site: siteNames.central, reason: 'Breakage' });
      if (!waste) {
        const wasteQty = 3;
        const cost = wasteQty * cementItem.unitCost;

        // Deduct 3 bags from stock
        await InventoryItem.findByIdAndUpdate(cementItem._id, { $inc: { quantity: -wasteQty } });

        // Create linked stock movement
        const wasteMovement = await StockMovement.create({
          material: cementItem._id,
          materialName: cementItem.itemName,
          site: siteNames.central,
          project: metroProject._id,
          movementType: 'wastage',
          direction: 'outbound',
          quantity: wasteQty,
          unit: cementItem.unit,
          unitCost: cementItem.unitCost,
          totalValue: cost,
          reference: 'WASTE-BREAKAGE-01',
          reason: 'Bags torn during forklift pallet offloading',
          recordedBy: seededUsers['Storekeeper']._id,
          recordedByName: seededUsers['Storekeeper'].name,
          recordedByRole: 'Storekeeper',
          status: 'completed'
        });

        waste = await WastageRecord.create({
          material: cementItem._id,
          materialName: cementItem.itemName,
          site: siteNames.central,
          project: metroProject._id,
          quantity: wasteQty,
          unit: cementItem.unit,
          unitCost: cementItem.unitCost,
          financialImpact: cost,
          reason: 'Breakage',
          location: 'Godown unloading ramp',
          notes: 'Bags torn during forklift pallet offloading by vendor delivery team',
          reportingUser: seededUsers['Storekeeper']._id,
          reportingUserName: seededUsers['Storekeeper'].name,
          stockMovement: wasteMovement._id
        });
        console.log(`   + Created Physical Wastage: ${wasteQty} ${cementItem.unit} @ ₹${cementItem.unitCost} (Loss: ₹${cost})`);
      } else {
        console.log('   ✓ Wastage record already exists');
      }
    }

    console.log('\n======================================================');
    console.log('🎉 DEMO DATA SEEDING COMPLETE FOR LAB PRESENTATION!');
    console.log('======================================================');
    console.log('Demo Credentials for College Viva Evaluation:');
    console.log('  1. Owner:            owner@construction.com       / OwnerPass123!');
    console.log('  2. Material Manager: manager@construction.com     / ManagerPass123!');
    console.log('  3. Site Engineer:    engineer@construction.com    / EngineerPass123!');
    console.log('  4. Storekeeper:      storekeeper@construction.com / StorePass123!');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
