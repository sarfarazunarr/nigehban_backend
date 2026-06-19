const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nigehbaan');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Auto migration: update existing laws that are missing language field to default to 'english'
    try {
      const LawResource = require('../models/LawResource');
      const updatedCount = await LawResource.updateMany(
        { language: { $exists: false } },
        { $set: { language: 'english' } }
      );
      if (updatedCount.modifiedCount > 0) {
        console.log(`✅ [Migration] Updated ${updatedCount.modifiedCount} legacy law resources to 'english' language.`);
      }
    } catch (migErr) {
      console.warn('⚠️ [Migration] Law language field migration warning:', migErr.message);
    }

    return conn;
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
