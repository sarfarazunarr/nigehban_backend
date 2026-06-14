const ChatSession = require('../models/ChatSession');
const CommunityHelpChat = require('../models/CommunityHelpChat');
const openaiService = require('../services/openai.service');

module.exports = (io, socket) => {
  /**
   * Handle raw low-latency audio chunk streaming from user's device
   * Pipes the raw audio chunks (PCM, MP3, etc.) directly to anyone subscribed in the SOS room
   */
  socket.on('audio_chunk', (data) => {
    try {
      const { targetUserId, chunk } = data;
      if (!targetUserId || !chunk) return;

      const roomName = `sos:room:${targetUserId}`;
      
      // Broadcast audio chunk to all listeners (guardians, police dispatchers) in the room
      // Exclude sender to avoid echo issues
      socket.to(roomName).emit('audio_chunk_receive', {
        userId: socket.user._id,
        chunk,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Socket audio_chunk error:', error.message);
    }
  });

  /**
   * WebRTC peer signaling events (Offer, Answer, ICE Candidates)
   * Essential for setting up encrypted direct audio/video calls between user and dispatch operator
   */
  socket.on('webrtc_signal', (data) => {
    try {
      const { targetSocketId, signal } = data;
      if (!targetSocketId || !signal) return;

      // Direct message/signal relay to specific socket ID
      io.to(targetSocketId).emit('webrtc_signal_receive', {
        senderSocketId: socket.id,
        senderUserId: socket.user._id,
        senderPhone: socket.user.phone,
        signal
      });
    } catch (error) {
      console.error('Socket webrtc_signal error:', error.message);
    }
  });

  /**
   * Register listener socket mapping (e.g., let dispatchers register their operator details)
   */
  socket.on('register_operator', (callback) => {
    try {
      if (['SuperAdmin', 'B2G'].includes(socket.user.role)) {
        socket.join('operators');
        console.log(`[Socket Operator] Registered dispatch operator: ${socket.user.phone}`);
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ success: false, error: 'Forbidden. Operator role required.' });
      }
    } catch (error) {
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * User sends a chat message (processed by AI or routed to human operator)
   */
  socket.on('chat_message', async (data, callback) => {
    try {
      const { text } = data;
      if (!text || typeof text !== 'string') {
        throw new Error('Message text is required.');
      }

      // 1. Fetch or create user chat session
      let session = await ChatSession.findOne({ user: socket.user._id });
      if (!session) {
        session = await ChatSession.create({ user: socket.user._id, messages: [] });
      }

      if (session.status === 'ai') {
        // Run AI response pipeline
        const { reply, handoffTriggered } = await openaiService.processUserMessage(
          socket.user._id,
          text
        );

        // Emit response back to user
        socket.emit('chat_message_receive', {
          sender: 'ai',
          content: reply,
          timestamp: new Date()
        });

        // Handle human operator handoff trigger
        if (handoffTriggered) {
          io.to('operators').to('role:B2G').emit('handoff_request', {
            userId: socket.user._id,
            phone: socket.user.phone,
            cnic: socket.user.cnic,
            message: 'User requested live emergency operator takeover.'
          });

          socket.emit('chat_status_update', {
            status: 'human',
            message: 'Connecting to a live emergency agent...'
          });
        }
      } else {
        // Human operator mode: Save and relay user message to operators
        session.messages.push({ sender: 'user', content: text });
        await session.save();

        io.to('operators').to('role:B2G').emit('operator_receive_message', {
          userId: socket.user._id,
          phone: socket.user.phone,
          content: text,
          timestamp: new Date()
        });
      }

      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Socket chat_message error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Operator replies to a user session (takes over operator field)
   */
  socket.on('operator_reply', async (data, callback) => {
    try {
      // Auth verification: must be Admin or B2G dispatcher
      if (!['SuperAdmin', 'B2G'].includes(socket.user.role)) {
        throw new Error('Unauthorized. Operator role required.');
      }

      const { targetUserId, text } = data;
      if (!targetUserId || !text) {
        throw new Error('targetUserId and message text are required.');
      }

      // Update Chat Session status & operator fields
      const session = await ChatSession.findOne({ user: targetUserId });
      if (!session) {
        throw new Error('User chat session not found.');
      }

      // Save reply
      session.messages.push({ sender: 'operator', content: text });
      session.status = 'human';
      session.operator = socket.user._id;
      await session.save();

      // Emit operator message to target user notifications room
      io.to(`user:notifications:${targetUserId}`).emit('chat_message_receive', {
        sender: 'operator',
        content: text,
        operatorPhone: socket.user.phone,
        timestamp: new Date()
      });

      // Sync message event back to all operators for dashboard tracking
      io.to('operators').to('role:B2G').emit('operator_message_sync', {
        userId: targetUserId,
        sender: 'operator',
        content: text,
        operatorPhone: socket.user.phone,
        timestamp: new Date()
      });

      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Socket operator_reply error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Join a community user-to-user help chat room
   */
  socket.on('join_community_chat', async (data, callback) => {
    try {
      const { chatId } = data;
      if (!chatId) {
        throw new Error('Chat ID is required.');
      }

      // Verify chat existence and access permissions
      const chat = await CommunityHelpChat.findById(chatId);
      if (!chat) {
        throw new Error('Chat session not found.');
      }

      const isParticipant = [chat.seeker.toString(), chat.helper.toString()].includes(socket.user._id.toString());
      if (!isParticipant) {
        throw new Error('Unauthorized. You are not a participant in this chat session.');
      }

      const roomName = `community:chat:${chatId}`;
      socket.join(roomName);
      console.log(`[Socket Community Chat] User ${socket.user.phone} joined room ${roomName}`);

      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Socket join_community_chat error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Send a real-time message inside a community help chat room
   */
  socket.on('send_community_message', async (data, callback) => {
    try {
      const { chatId, content } = data;
      if (!chatId || !content) {
        throw new Error('chatId and content are required.');
      }

      const chat = await CommunityHelpChat.findById(chatId);
      if (!chat) {
        throw new Error('Chat session not found.');
      }

      // Access check
      const isParticipant = [chat.seeker.toString(), chat.helper.toString()].includes(socket.user._id.toString());
      if (!isParticipant) {
        throw new Error('Unauthorized. You are not a participant in this chat.');
      }

      // Save message in DB
      chat.messages.push({
        sender: socket.user._id,
        content
      });
      await chat.save();

      // Broadcast message to room (notifying other participant)
      const roomName = `community:chat:${chatId}`;
      socket.to(roomName).emit('community_message_receive', {
        chatId,
        senderId: socket.user._id,
        senderPhone: socket.user.phone,
        content,
        timestamp: new Date()
      });

      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Socket send_community_message error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  });
};
