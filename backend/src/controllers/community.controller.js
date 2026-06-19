const { z } = require('zod');
const CommunityAlert = require('../models/CommunityAlert');
const CommunityHelpChat = require('../models/CommunityHelpChat');
const pusher = require('../config/pusher');

const createAlertSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  message: z.string().min(3, 'Message must be at least 3 characters')
});

const nearbyQuerySchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  radius: z.coerce.number().min(100).max(50000).default(2000) // 100m to 50km, default 2km
});

const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty')
});

/**
 * Trigger a new community help request alert
 */
const createAlert = async (req, res, next) => {
  try {
    const validatedData = createAlertSchema.parse(req.body);
    const { longitude, latitude, message } = validatedData;

    // Create the alert
    const alert = await CommunityAlert.create({
      seeker: req.user._id,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      message
    });

    // Broadcast new alert to all connected sockets via Pusher
    try {
      pusher.trigger('community-alerts', 'new_community_alert', {
        alertId: alert._id,
        seekerId: req.user._id,
        seekerPhone: req.user.phone,
        location: [longitude, latitude],
        message
      }).catch(err => console.error('Pusher community alert error:', err.message));
    } catch (err) {
      console.error('Failed to trigger Pusher community alert:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Community help alert broadcasted successfully',
      alert
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Close an active community help request
 */
const closeAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;

    const alert = await CommunityAlert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Help request alert not found.' });
    }

    // Authorization: only seeker can close their alert
    if (alert.seeker.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden. Only the help seeker can close this alert.' });
    }

    alert.active = false;
    await alert.save();

    // Broadcast resolved status via Pusher
    try {
      pusher.trigger('community-alerts', 'community_alert_resolved', {
        alertId: alert._id,
        seekerId: req.user._id
      }).catch(err => console.error('Pusher community alert resolved error:', err.message));
    } catch (err) {
      console.error('Failed to trigger Pusher community alert resolve:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Help request alert closed successfully',
      alert
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active community alerts near a user's location
 */
const getNearbyAlerts = async (req, res, next) => {
  try {
    const validatedQuery = nearbyQuerySchema.parse(req.query);
    const { longitude, latitude, radius } = validatedQuery;

    // Geospatial search using Mongo sphere index
    const alerts = await CommunityAlert.find({
      active: true,
      seeker: { $ne: req.user._id }, // Exclude user's own alerts
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radius
        }
      }
    }).populate('seeker', 'phone cnic role');

    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Respond to a nearby alert (creates a helper-seeker chat session)
 */
const respondToAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;

    const alert = await CommunityAlert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found.' });
    }

    if (!alert.active) {
      return res.status(400).json({ success: false, error: 'This alert is no longer active.' });
    }

    // Prevent responding to self
    if (alert.seeker.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot respond to your own help request.' });
    }

    // Check if chat already exists
    let chat = await CommunityHelpChat.findOne({
      alert: alertId,
      helper: req.user._id
    });

    if (!chat) {
      chat = await CommunityHelpChat.create({
        alert: alertId,
        seeker: alert.seeker,
        helper: req.user._id,
        messages: []
      });
    }

    res.status(200).json({
      success: true,
      message: 'Successfully responded to alert. Chat channel opened.',
      chat
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active help chats for the current user (as helper or seeker)
 */
const getChats = async (req, res, next) => {
  try {
    const chats = await CommunityHelpChat.find({
      $or: [
        { seeker: req.user._id },
        { helper: req.user._id }
      ]
    })
      .populate('seeker', 'phone role')
      .populate('helper', 'phone role')
      .populate('alert', 'message location active')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: chats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific chat session details & messages
 */
const getChatById = async (req, res, next) => {
  try {
    const { chatId } = req.params;

    const chat = await CommunityHelpChat.findById(chatId)
      .populate('seeker', 'phone role')
      .populate('helper', 'phone role')
      .populate('alert', 'message location active');

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat channel not found.' });
    }

    // Access check
    const isParticipant = [chat.seeker._id.toString(), chat.helper._id.toString()].includes(req.user._id.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Forbidden. You are not a participant in this chat.' });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a chat message (REST fallback)
 */
const sendChatMessage = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const validatedData = sendMessageSchema.parse(req.body);
    const { content } = validatedData;

    const chat = await CommunityHelpChat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat channel not found.' });
    }

    // Access check
    const isParticipant = [chat.seeker.toString(), chat.helper.toString()].includes(req.user._id.toString());
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Forbidden. You are not a participant in this chat.' });
    }

    // Save message
    chat.messages.push({
      sender: req.user._id,
      content
    });
    await chat.save();

    // Broadcast message over Pusher to chat channel
    try {
      pusher.trigger(`community-chat-${chatId}`, 'community_message_receive', {
        chatId,
        senderId: req.user._id,
        senderPhone: req.user.phone,
        content,
        timestamp: new Date()
      }).catch(err => console.error('Pusher community message error:', err.message));
    } catch (err) {
      console.error('Failed to trigger Pusher community message:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: chat.messages[chat.messages.length - 1]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAlert,
  closeAlert,
  getNearbyAlerts,
  respondToAlert,
  getChats,
  getChatById,
  sendChatMessage
};
