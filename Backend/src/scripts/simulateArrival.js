require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'test';
const WORKER_ID = '69abfac8d8e3ba53c5d33cdb'; 
const TARGET_LOCATION = [76.7794, 30.7333]; // Chandigarh Sector 17 [lng, lat]
const START_LOCATION = [76.7000, 30.7000]; // Starting point away from target

async function simulate() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB for simulation...');
    const db = client.db(DB_NAME);
    const workers = db.collection('worker_profiles');

    let current = [...START_LOCATION];
    const steps = 20;
    const lngStep = (TARGET_LOCATION[0] - START_LOCATION[0]) / steps;
    const latStep = (TARGET_LOCATION[1] - START_LOCATION[1]) / steps;

    for (let i = 0; i <= steps; i++) {
      console.log(`Step ${i}/${steps}: Worker at ${current[1].toFixed(4)}, ${current[0].toFixed(4)}`);
      
      await workers.updateOne(
        { _id: new ObjectId(WORKER_ID) },
        { 
          $set: { 
            location: { type: 'Point', coordinates: current },
            lastSeen: new Date(),
            status: 'online'
          } 
        }
      );

      current[0] += lngStep;
      current[1] += latStep;
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('Simulated arrival complete!');
  } catch (err) {
    console.error('Simulation error:', err);
  } finally {
    await client.close();
  }
}

simulate();
