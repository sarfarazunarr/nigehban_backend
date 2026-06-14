const mongoose = require('mongoose');

const CoordinateSchema = new mongoose.Schema({
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const SosSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    startTime: {
      type: Date,
      default: Date.now,
      index: true
    },
    endTime: {
      type: Date
    },
    coordinates: [CoordinateSchema],
    listeningAuthorities: [
      {
        type: String // Socket ID, Police Dispatch ID, or user reference
      }
    ],
    listeningGuardians: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Geo-spatial index on the nested coordinates path to allow tracking lookup
SosSessionSchema.index({ 'coordinates.location': '2dsphere' });

module.exports = mongoose.model('SosSession', SosSessionSchema);
