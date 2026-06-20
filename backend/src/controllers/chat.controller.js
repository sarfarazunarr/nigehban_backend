const ChatSession = require('../models/ChatSession');
const openaiService = require('../services/openai.service');
const pusher = require('../config/pusher');
const { uploadMediaStream } = require('../services/cloudinary.service');

/**
 * Retrieve user chat session history
 */
const getChatHistory = async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({ user: req.user._id })
      .populate('user', 'phone cnic role')
      .populate('operator', 'phone role');

    if (!session) {
      return res.status(200).json({
        success: true,
        status: 'ai',
        messages: []
      });
    }

    res.status(200).json({
      success: true,
      status: session.status,
      operator: session.operator,
      messages: session.messages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a chat message (processed by AI or routed to human operator)
 */
const sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    let messageContent = text;

    if (req.file) {
      console.log('Uploading chat media to Cloudinary...');
      const uploadResult = await uploadMediaStream(req.file.buffer, 'nigehbaan_chat_media');
      const fileUrl = uploadResult.secure_url;
      const isAudio = req.file.mimetype.startsWith('audio/') || req.file.originalname.match(/\.(mp3|wav|ogg|m4a|aac|mp4)$/i);
      if (isAudio) {
        messageContent = `<audio src="${fileUrl}" controls style="width: 100%; max-width: 250px; height: 35px; margin-top: 4px; display: block;"></audio>`;
      } else {
        messageContent = `<a href="${fileUrl}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline;">Attachment: ${req.file.originalname}</a>`;
      }
    }

    if (!messageContent || typeof messageContent !== 'string') {
      return res.status(400).json({ success: false, error: 'Message text or media file is required.' });
    }

    const userId = req.user._id;

    // Fetch or create user chat session
    let session = await ChatSession.findOne({ user: userId });
    if (!session) {
      session = await ChatSession.create({ user: userId, messages: [] });
    }

    if (session.status === 'ai') {
      // Run AI response pipeline
      const aiInputText = req.file ? "[User sent a voice clip]" : messageContent;
      const { reply, handoffTriggered } = await openaiService.processUserMessage(
        userId,
        aiInputText
      );

      // Emit response back to user via Pusher
      pusher.trigger(`user-notifications-${userId}`, 'chat_message_receive', {
        sender: 'ai',
        content: reply,
        timestamp: new Date()
      }).catch(err => console.error('Pusher chat receive error:', err.message));

      // Handle human operator handoff trigger
      if (handoffTriggered) {
        pusher.trigger('operators', 'handoff_request', {
          userId: userId,
          phone: req.user.phone,
          cnic: req.user.cnic,
          message: 'User requested live emergency operator takeover.'
        }).catch(err => console.error('Pusher handoff request error:', err.message));

        pusher.trigger(`user-notifications-${userId}`, 'chat_status_update', {
          status: 'human',
          message: 'Connecting to a live emergency agent...'
        }).catch(err => console.error('Pusher status update error:', err.message));
      }
    } else {
      // Human operator mode: Save and relay user message to operators
      session.messages.push({ sender: 'user', content: messageContent });
      await session.save();

      pusher.trigger('operators', 'operator_receive_message', {
        userId: userId,
        phone: req.user.phone,
        content: messageContent,
        timestamp: new Date()
      }).catch(err => console.error('Pusher operator message receive error:', err.message));
    }

    res.status(200).json({
      success: true,
      message: 'Message processed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Operator replies to a user session (takes over operator field)
 */
const replyMessage = async (req, res, next) => {
  try {
    const { targetUserId, text } = req.body;
    if (!targetUserId || !text) {
      return res.status(400).json({ success: false, error: 'targetUserId and message text are required.' });
    }

    // Update Chat Session status & operator fields
    const session = await ChatSession.findOne({ user: targetUserId });
    if (!session) {
      return res.status(404).json({ success: false, error: 'User chat session not found.' });
    }

    // Save reply
    session.messages.push({ sender: 'operator', content: text });
    session.status = 'human';
    session.operator = req.user._id;
    await session.save();

    // Emit operator message to target user notifications channel
    pusher.trigger(`user-notifications-${targetUserId}`, 'chat_message_receive', {
      sender: 'operator',
      content: text,
      operatorPhone: req.user.phone,
      timestamp: new Date()
    }).catch(err => console.error('Pusher operator reply error:', err.message));

    // Sync message event back to all operators for dashboard tracking
    pusher.trigger('operators', 'operator_message_sync', {
      userId: targetUserId,
      sender: 'operator',
      content: text,
      operatorPhone: req.user.phone,
      timestamp: new Date()
    }).catch(err => console.error('Pusher sync message error:', err.message));

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Close live operator session and revert back to AI mode (Admin/B2G only)
 */
const closeHumanSession = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Target User ID is required.' });
    }

    const session = await ChatSession.findOneAndUpdate(
      { user: targetUserId },
      {
        status: 'ai',
        $unset: { operator: 1 }
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, error: 'No chat session found for this user.' });
    }

    // Emit status update over Pusher
    try {
      pusher.trigger(`user-notifications-${targetUserId}`, 'chat_status_update', {
        status: 'ai',
        message: 'Live chat ended. Reverting back to Nigehbaan AI assistant.'
      }).catch(err => console.error('Pusher chat close status error:', err.message));
    } catch (err) {
      console.error('Failed to trigger Pusher alert for chat close:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Chat session closed and reverted to AI successfully.',
      session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active human operator chats (Admin/B2G only)
 */
const getActiveChats = async (req, res, next) => {
  try {
    const sessions = await ChatSession.find({ status: 'human' })
      .populate('user', 'phone cnic role')
      .populate('operator', 'phone role')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatHistory,
  sendMessage,
  replyMessage,
  closeHumanSession,
  getActiveChats
};
