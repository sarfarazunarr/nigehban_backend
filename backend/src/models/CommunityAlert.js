const mongoose = require('mongoose');

const CommunityAlertSchema = new mongoose.Schema(
  {
    seeker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    message: {
      type: String,
      required: true,
      trim: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere index for nearby geospatial searches
CommunityAlertSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('CommunityAlert', CommunityAlertSchema);
