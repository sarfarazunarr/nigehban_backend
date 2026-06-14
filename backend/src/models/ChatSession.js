const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'ai', 'operator'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const ChatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['ai', 'human'],
      default: 'ai',
      index: true
    },
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    messages: [MessageSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ChatSession', ChatSessionSchema);
