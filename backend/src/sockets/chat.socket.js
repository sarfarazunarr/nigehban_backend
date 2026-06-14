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
};
