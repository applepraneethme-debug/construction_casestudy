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
    let scopedProjectFilter = { status: 'Active' };
    let scopedSiteFilter = { status: 'Active' };

    if (req.user.role !== 'Owner') {
      const assigned = req.user.assignedSites || [];
      siteFilter.site = { $in: assigned };
      scopedSiteFilter.name = { $in: assigned };

      // Scope active projects to those containing the user's assigned sites
      const userSites = await Site.find({ name: { $in: assigned } }).select('project');
      const projectIds = userSites.map((s) => s.project).filter(Boolean);
      scopedProjectFilter._id = { $in: projectIds };
    }

    // 1. Inventory Summary & Total Valuation
    const inventoryItems = await InventoryItem.find(siteFilter);
    const totalItems = inventoryItems.length;
    let totalValuation = 0;
    const lowStockItems = [];

    inventoryItems.forEach((item) => {
      totalValuation += (item.quantity || 0) * (item.unitCost || 0);
      const threshold = item.minThreshold !== undefined && item.minThreshold !== null ? item.minThreshold : 10;
      if (item.quantity <= threshold) {
        lowStockItems.push({
          id: item._id,
          itemName: item.itemName,
          site: item.site,
          quantity: item.quantity,
          unit: item.unit,
          minThreshold: threshold
        });
      }
    });

    // 2. Project and Site Counts (Scoped)
    const activeProjectsCount = await Project.countDocuments(scopedProjectFilter);
    const activeSitesCount = await Site.countDocuments(scopedSiteFilter);


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
