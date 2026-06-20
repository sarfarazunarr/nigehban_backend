const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nigehbaan');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Auto migrations & Index synchronization
    try {
      const LawResource = require('../models/LawResource');
      const User = require('../models/User');
      const Incident = require('../models/Incident');
      const SosSession = require('../models/SosSession');

      // 1. Check and drop the legacy unique category index if it exists in MongoDB
      const db = conn.connection.db;
      try {
        const indexes = await db.collection('lawresources').indexes();
        const obsoleteCategoryIndex = indexes.find(idx => idx.name === 'category_1');
        if (obsoleteCategoryIndex) {
          console.log('🔄 [Migration] Found legacy `category_1` index on lawresources. Checking if it needs drop...');
          await db.collection('lawresources').dropIndex('category_1');
          console.log('✅ [Migration] Successfully dropped legacy `category_1` index.');
        }
      } catch (colErr) {
        // Collection doesn't exist yet, safe to ignore
      }

      // 2. Update existing laws missing language field to default to 'english'
      const updatedCount = await LawResource.updateMany(
        { language: { $exists: false } },
        { $set: { language: 'english' } }
      );
      if (updatedCount.modifiedCount > 0) {
        console.log(`✅ [Migration] Updated ${updatedCount.modifiedCount} legacy law resources to 'english' language.`);
      }

      // 3. Synchronize all model indexes with schemas
      await Promise.all([
        LawResource.syncIndexes(),
        User.syncIndexes(),
        Incident.syncIndexes(),
        SosSession.syncIndexes()
      ]);
      console.log('✅ [Migration] Successfully synchronized all database collection indexes.');
    } catch (migErr) {
      console.warn('⚠️ [Migration] Database migration/synchronization warning:', migErr.message);
    }

    return conn;
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
