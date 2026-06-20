const mongoose = require('mongoose');

const LawResourceSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      lowercase: true
    },
    language: {
      type: String,
      enum: ['english', 'urdu', 'sindhi'],
      default: 'english',
      lowercase: true,
      trim: true
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    legalDescription: {
      type: String,
      required: [true, 'Legal description is required']
    },
    survivalInstructions: {
      type: [String],
      required: [true, 'Survival instructions are required'],
      default: []
    },
    precautions: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index for category and language
LawResourceSchema.index({ category: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('LawResource', LawResourceSchema);
