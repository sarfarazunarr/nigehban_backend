const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      enum: ['harassment', 'stalking', 'domestic_violence', 'physical_assault', 'kidnapping', 'other'],
      index: true
    },
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
    mediaUrls: [
      {
        type: String
      }
    ],
    description: {
      type: String,
      trim: true
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'dismissed'],
      default: 'pending',
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'resolved', 'dismissed'],
      default: 'pending',
      index: true
    },
    teamReply: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Geo-spatial Index for predictive routing & heatmap calculations
IncidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Incident', IncidentSchema);
