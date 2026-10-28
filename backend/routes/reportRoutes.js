const express = require('express');
const InventoryItem = require('../models/InventoryItem');
const StockMovement = require('../models/StockMovement');
const Requisition = require('../models/Requisition');
const ConsumptionRecord = require('../models/ConsumptionRecord');
const WastageRecord = require('../models/WastageRecord');
const Project = require('../models/Project');
const Site = require('../models/Site');
const { authenticate, requirePermission, verifyCsrf } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);
router.use(verifyCsrf);

/**
 * GET /api/reports/dashboard - Aggregated real-time metrics directly from MongoDB
 */
router.get('/dashboard', requirePermission(PERMISSIONS.REPORTS_READ), async (req, res) => {
  try {
    const siteFilter = {};
    if (req.user.role !== 'Owner') {
      const assigned = req.user.assignedSites || [];
      if (assigned.length > 0) {
        siteFilter.$or = [{ site: { $in: assigned } }, { site: 'General Site' }];
      }
    }

    // 1. Inventory Summary & Total Valuation
    const inventoryItems = await InventoryItem.find(siteFilter);
    const totalItems = inventoryItems.length;
    let totalValuation = 0;
    const lowStockItems = [];

    inventoryItems.forEach((item) => {
      totalValuation += (item.quantity || 0) * (item.unitCost || 0);
      if (item.quantity <= (item.minThreshold || 10)) {
        lowStockItems.push({
          id: item._id,
          itemName: item.itemName,
          site: item.site,
          quantity: item.quantity,
          unit: item.unit,
          minThreshold: item.minThreshold || 10
        });
      }
    });

    // 2. Project and Site Counts
    const activeProjectsCount = await Project.countDocuments({ status: 'Active' });
    const activeSitesCount = await Site.countDocuments({ status: 'Active' });

    // 3. Physical Wastage Metrics
    const wastageRecords = await WastageRecord.find(siteFilter);
    let totalWastageCost = 0;
    let totalWastageQuantity = 0;
    const wastageByReason = {};

    wastageRecords.forEach((w) => {
      totalWastageCost += w.financialImpact || 0;
      totalWastageQuantity += w.quantity || 0;
      if (!wastageByReason[w.reason]) {
        wastageByReason[w.reason] = { count: 0, totalQty: 0, totalCost: 0 };
      }
      wastageByReason[w.reason].count += 1;
      wastageByReason[w.reason].totalQty += w.quantity;
      wastageByReason[w.reason].totalCost += w.financialImpact || 0;
    });

    // 4. Consumption Variance Alerts
    const excessConsumptions = await ConsumptionRecord.find({
      ...siteFilter,
      excessQty: { $gt: 0 }
    }).sort({ excessPercentage: -1 }).limit(10);

    // 5. Pending Requisitions
    const pendingRequisitions = await Requisition.find({
      ...siteFilter,
      status: 'Pending'
    }).sort({ createdAt: -1 });

    // 6. Recent Stock Movements
    const recentMovements = await StockMovement.find(siteFilter)
      .sort({ createdAt: -1 })
      .limit(8);

    res.status(200).json({
      inventory: {
        totalItems,
        totalValuation: Number(totalValuation.toFixed(2)),
        lowStockCount: lowStockItems.length,
        lowStockItems
      },
      projects: {
        activeProjects: activeProjectsCount,
        activeSites: activeSitesCount
      },
      wastage: {
        totalWastageRecords: wastageRecords.length,
        totalWastageCost: Number(totalWastageCost.toFixed(2)),
        totalWastageQuantity: Number(totalWastageQuantity.toFixed(2)),
        byReason: wastageByReason
      },
      consumption: {
        excessCount: excessConsumptions.length,
        topVariances: excessConsumptions
      },
      requisitions: {
        pendingCount: pendingRequisitions.length,
        pendingList: pendingRequisitions
      },
      recentMovements
    });
  } catch (error) {
    res.status(500).json({ message: 'Error compiling dashboard reports: ' + error.message });
  }
});

module.exports = router;
