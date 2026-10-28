require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function inspectAtlas() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    console.log('Connected to MongoDB Atlas:', mongoose.connection.name);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\nCollections on Atlas:');
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`- ${c.name}: ${count} documents`);
    }

    console.log('\nIndexes on inventoryitems:');
    const invIndexes = await db.collection('inventoryitems').indexes();
    console.log(JSON.stringify(invIndexes, null, 2));

    console.log('\nIndexes on stockmovements:');
    const smIndexes = await db.collection('stockmovements').indexes();
    console.log(JSON.stringify(smIndexes, null, 2));

    console.log('\nIndexes on users:');
    const userIndexes = await db.collection('users').indexes();
    console.log(JSON.stringify(userIndexes, null, 2));

    await mongoose.disconnect();
    console.log('\nAtlas inspection complete.');
  } catch (err) {
    console.error('Atlas inspection error:', err);
    process.exit(1);
  }
}

inspectAtlas();
