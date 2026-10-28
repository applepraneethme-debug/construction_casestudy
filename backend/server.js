const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const projectRoutes = require('./routes/projectRoutes');
const siteRoutes = require('./routes/siteRoutes');
const movementRoutes = require('./routes/movementRoutes');
const requisitionRoutes = require('./routes/requisitionRoutes');
const consumptionRoutes = require('./routes/consumptionRoutes');
const wastageRoutes = require('./routes/wastageRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser()); // Parses incoming cookies (HttpOnly auth tokens)
app.use(express.json()); // Parses incoming JSON data in request bodies


// Database Connection function
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error('❌ FATAL: MONGO_URI is not defined in backend/.env');
    console.error('👉 Please configure MONGO_URI in backend/.env to connect to MongoDB Atlas.');
    process.exit(1);
  }

  // Explicitly isolate in-memory database strictly for automated test environments
  if (process.env.NODE_ENV === 'test' && mongoURI === 'memory') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    console.log('✅ Connected to In-Memory MongoDB Database for tests');
    return;
  }

  try {
    const dbName = process.env.DB_NAME || 'constructionDB';
    await mongoose.connect(mongoURI, {
      dbName,
      serverSelectionTimeoutMS: 5000
    });
    console.log(`✅ Connected to MongoDB Atlas successfully! [Database: ${mongoose.connection.name}]`);
  } catch (err) {
    console.error('❌ Could not connect to MongoDB Atlas:', err.message);
    console.error('👉 Server cannot start without a working database connection. Exiting...');
    process.exit(1);
  }
};

// Root route
app.get('/', (req, res) => {
  res.send('🏗️ Construction Inventory API is running!');
});

// Health check endpoint with database state
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? 'healthy' : 'unhealthy',
    database: isConnected ? 'connected' : 'disconnected',
    dbName: mongoose.connection.name || null
  });
});

// Mount Application API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/requisitions', requisitionRoutes);
app.use('/api/consumption', consumptionRoutes);
app.use('/api/wastage', wastageRoutes);
app.use('/api/reports', reportRoutes);


// Start Express Server only after database connection succeeds
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, connectDB, startServer };

