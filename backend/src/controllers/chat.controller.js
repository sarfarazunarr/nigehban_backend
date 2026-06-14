const ChatSession = require('../models/ChatSession');

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

    // Emit event over sockets to let the user know chat reverted to AI
    const io = req.app.get('io');
    if (io) {
      io.to(`user:notifications:${targetUserId}`).emit('chat_status_update', {
        status: 'ai',
        message: 'Live chat ended. Reverting back to Nigehbaan AI assistant.'
      });
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

module.exports = {
  getChatHistory,
  closeHumanSession
};
