/**
 * Safe, Idempotent Backfill Script for Stock Ledger Directions
 * 
 * Inspects all historical StockMovement documents to verify direction labels:
 * - receipts and opening balances => inbound
 * - issues and wastage => outbound
 * - transfers => outbound (at source site) / inbound (at destination site)
 * - returns => inbound
 * - adjustments => variance-based (inbound if count increased, outbound if decreased)
 *
 * Usage:
 *   Dry Run (Default, does not write changes):
 *     node scripts/backfillLedgerDirection.js --dry-run
 * 
 *   Execute Migration (Requires explicit approval):
 *     node scripts/backfillLedgerDirection.js --execute
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const StockMovement = require('../models/StockMovement');

const isDryRun = !process.argv.includes('--execute');

const runBackfill = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI is not set in backend/.env');
      process.exit(1);
    }

    console.log(`\n======================================================`);
    console.log(`🔍 Stock Ledger Direction Backfill Audit`);
    console.log(`   Mode: ${isDryRun ? 'DRY RUN (Read-Only / Simulation)' : 'EXECUTE (Applying changes)'}`);
    console.log(`======================================================\n`);

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`✅ Connected to DB: ${mongoose.connection.name}`);

    const movements = await StockMovement.find().sort({ createdAt: 1 });
    console.log(`Total movements examined: ${movements.length}\n`);

    const discrepancies = [];

    for (const m of movements) {
      let expectedDirection = 'inbound';

      if (m.movementType === 'receipt' || m.movementType === 'return') {
        expectedDirection = 'inbound';
      } else if (m.movementType === 'issue' || m.movementType === 'wastage') {
        expectedDirection = 'outbound';
      } else if (m.movementType === 'transfer') {
        if (m.destinationSite && m.site === m.destinationSite) {
          expectedDirection = 'inbound';
        } else {
          expectedDirection = 'outbound';
        }
      } else if (m.movementType === 'adjustment') {
        // Parse reason string (e.g., 'count changed from X to Y') to determine variance
        const match = (m.reason || '').match(/count changed from (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)/i);
        if (match) {
          const from = parseFloat(match[1]);
          const to = parseFloat(match[2]);
          expectedDirection = to >= from ? 'inbound' : 'outbound';
        } else {
          expectedDirection = m.direction || 'neutral';
        }
      }

      if (!m.direction || m.direction !== expectedDirection) {
        discrepancies.push({
          id: m._id,
          reference: m.reference,
          type: m.movementType,
          material: m.materialName,
          site: m.site,
          currentDirection: m.direction || '(none)',
          targetDirection: expectedDirection
        });
      }
    }

    console.log(`------------------------------------------------------`);
    console.log(`Discrepancies found: ${discrepancies.length}`);
    console.log(`------------------------------------------------------`);

    if (discrepancies.length === 0) {
      console.log(`🎉 All ${movements.length} stock ledger movements have accurate directions! No corrections required.`);
    } else {
      console.log(`Details of records with missing/mismatched direction:`);
      discrepancies.forEach((d, idx) => {
        console.log(` [${idx + 1}] ID: ${d.id} | Type: ${d.type} | Item: ${d.material} (${d.site})`);
        console.log(`     Current: '${d.currentDirection}' -> Target: '${d.targetDirection}' | Ref: ${d.reference}`);
      });

      if (isDryRun) {
        console.log(`\n⚠️  DRY RUN COMPLETE: 0 records modified.`);
        console.log(`   To apply these changes, run with explicit flag: --execute`);
      } else {
        console.log(`\n🔄 Applying ${discrepancies.length} updates directly to collection...`);
        for (const d of discrepancies) {
          await mongoose.connection.collection('stockmovements').updateOne(
            { _id: d.id },
            { $set: { direction: d.targetDirection } }
          );
        }
        console.log(`✅ Successfully updated ${discrepancies.length} stock ledger directions.`);
      }
    }

    console.log(`\n======================================================\n`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Backfill error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

runBackfill();
