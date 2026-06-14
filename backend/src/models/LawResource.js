const mongoose = require('mongoose');

const LawResourceSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'Category is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
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
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('LawResource', LawResourceSchema);
