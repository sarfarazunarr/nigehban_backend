const { z } = require('zod');
const User = require('../models/User');
const sosService = require('../services/sos.service');

// Zod validations
const startSosSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional()
});

const pingLocationSchema = z.object({
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90)
});

const aiWebhookSchema = z.object({
  phone: z.string().min(10).max(15).optional(),
  cnic: z.string().min(13).max(15).optional(),
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  triggerReason: z.string().default('Autonomous trigger by local AI model (screaming, high heart rate, impact detection)'),
  confidenceScore: z.number().min(0).max(1).default(0.85)
});

/**
 * Manually trigger SOS
 */
const startSos = async (req, res, next) => {
  try {
    const validatedBody = startSosSchema.parse(req.body);
    const coordinates = validatedBody.longitude && validatedBody.latitude
      ? [validatedBody.longitude, validatedBody.latitude]
      : null;

    const session = await sosService.startSosSession(req.user._id, coordinates);

    res.status(201).json({
      success: true,
      message: 'SOS session initiated',
      session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Backup REST location ping
 */
const pingLocation = async (req, res, next) => {
  try {
    const validatedBody = pingLocationSchema.parse(req.body);
    const session = await sosService.pingSosLocation(req.user._id, [
      validatedBody.longitude,
      validatedBody.latitude
    ]);

    res.status(200).json({
      success: true,
      message: 'Location updated',
      session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Close SOS session
 */
const closeSos = async (req, res, next) => {
  try {
    const isAdmin = ['SuperAdmin', 'B2G'].includes(req.user.role);
    const targetUserId = (isAdmin && req.body.targetUserId) ? req.body.targetUserId : req.user._id;

    const session = await sosService.closeSosSession(targetUserId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'No active SOS session found.' });
    }

    // Emit socket notification to let other listeners/dispatchers know the SOS is resolved
    const io = req.app.get('io');
    if (io) {
      const roomName = `sos:room:${targetUserId}`;
      io.to(roomName).emit('sos_resolved', {
        userId: targetUserId,
        resolvedAt: new Date()
      });
    }

    res.status(200).json({
      success: true,
      message: 'SOS session closed successfully',
      session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active SOS sessions for dispatcher dashboard (B2G role)
 */
const getActiveSessions = async (req, res, next) => {
  try {
    const sessions = await sosService.getActiveSosSessions();
    res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Autonomous AI Webhook trigger
 * Decodes header credential, looks up user, and triggers high-priority SOS
 */
const handleAiWebhook = async (req, res, next) => {
  try {
    // Auth Check
    const token = req.headers['x-ai-model-key'];
    const expectedToken = process.env.AI_WEBHOOK_SECRET || 'ai_model_secret_nigehbaan_123';
    if (!token || token !== expectedToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized AI webhook source.' });
    }

    const validatedData = aiWebhookSchema.parse(req.body);
    const { phone, cnic, longitude, latitude, triggerReason, confidenceScore } = validatedData;

    if (!phone && !cnic) {
      return res.status(400).json({ success: false, error: 'Either phone or cnic is required to identify user.' });
    }

    // Lookup user
    const user = await User.findOne({
      $or: [
        ...(phone ? [{ phone }] : []),
        ...(cnic ? [{ cnic }] : [])
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found for provided credentials.' });
    }

    // Initialize SOS Session (syncs to both Redis & DB for dispatchers and guardians)
    console.log(`[AI Webhook SOS] Triggered for ${user.phone}. Reason: ${triggerReason} (Conf: ${confidenceScore * 100}%)`);
    const session = await sosService.startSosSession(user._id, [longitude, latitude]);

    // We can also trigger notifications / socket broadcasts here (handled by socket connection logic)

    res.status(201).json({
      success: true,
      message: 'Autonomous AI SOS session initiated successfully and stored in DB',
      session,
      triggerDetails: {
        reason: triggerReason,
        confidence: confidenceScore,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startSos,
  pingLocation,
  closeSos,
  getActiveSessions,
  handleAiWebhook
};
