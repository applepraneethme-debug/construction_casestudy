const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const inventoryRoutes = require('./routes/inventoryRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows Frontend (React) to communicate with Backend (Express)
app.use(express.json()); // Parses incoming JSON data in request bodies

// Database Connection function
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/studentDB';
  
  try {
    // Attempt standard MongoDB connection
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2000 // Quick timeout if local mongod is off
    });
    console.log('✅ Connected to MongoDB Database successfully!');
  } catch (err) {
    console.log('⚠️ Local MongoDB server not active on port 27017.');
    console.log('🔄 Launching automatic In-Memory MongoDB Server for testing...');
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log('✅ Connected to In-Memory MongoDB Database at:', uri);
    } catch (memErr) {
      console.error('❌ Could not connect to MongoDB:', memErr.message);
    }
  }
};

// Connect to Database
connectDB();

// Test Route to check server health
app.get('/', (req, res) => {
  res.send('🏗️ Construction Inventory API is running!');
});

// Mount Inventory API Routes
app.use('/api/inventory', inventoryRoutes);

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
