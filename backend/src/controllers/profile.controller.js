const mongoose = require('mongoose');
const { z } = require('zod');
const User = require('../models/User');
const SosSession = require('../models/SosSession');

const addContactSchema = z.object({
  contactInfo: z.string().min(1, 'Contact info (phone, email, CNIC, or User ID) is required')
});

const updateProfileSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional()
});

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('trustedContacts', '_id phone cnic email role name address')
      .select('-password');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile name/address
 */
const updateProfile = async (req, res, next) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    const { name, address } = validatedData;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (name !== undefined) user.name = name;
    if (address !== undefined) user.address = address;

    await user.save();

    const updatedUser = await User.findById(req.user._id)
      .populate('trustedContacts', '_id phone cnic email role name address')
      .select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a family member / guardian to trusted contacts
 */
const addTrustedContact = async (req, res, next) => {
  try {
    const validatedData = addContactSchema.parse(req.body);
    const { contactInfo } = validatedData;

    // Search contact by ID, phone, email, or CNIC
    const isObjectId = mongoose.Types.ObjectId.isValid(contactInfo);
    const contactQuery = isObjectId
      ? { _id: contactInfo }
      : {
          $or: [
            { phone: contactInfo },
            { email: contactInfo.toLowerCase() },
            { cnic: contactInfo }
          ]
        };

    const contactUser = await User.findOne(contactQuery);

    if (!contactUser) {
      return res.status(404).json({
        success: false,
        error: 'No user registered with this ID, phone, email, or CNIC.'
      });
    }

    // Check if adding self
    if (contactUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot add yourself as a trusted contact.'
      });
    }

    const user = await User.findById(req.user._id);

    // Check if already exists in trustedContacts
    const alreadyExists = user.trustedContacts.some(
      (contactId) => contactId.toString() === contactUser._id.toString()
    );

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        error: 'This user is already in your trusted contacts.'
      });
    }

    // Add to list
    user.trustedContacts.push(contactUser._id);
    await user.save();

    const updatedUser = await User.findById(req.user._id)
      .populate('trustedContacts', '_id phone cnic email role name address')
      .select('-password');

    res.status(200).json({
      success: true,
      message: 'Trusted contact added successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a family member / guardian from trusted contacts
 */
const removeTrustedContact = async (req, res, next) => {
  try {
    const { contactId } = req.params;

    const user = await User.findById(req.user._id);
    
    // Check if contact exists in list (resilient to populated or unpopulated arrays)
    const contactIndex = user.trustedContacts.findIndex((contact) => {
      const contactIdStr = contact._id ? contact._id.toString() : contact.toString();
      return contactIdStr === contactId;
    });
    if (contactIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Trusted contact not found in your list.'
      });
    }

    // Remove from array
    user.trustedContacts.splice(contactIndex, 1);
    await user.save();

    const updatedUser = await User.findById(req.user._id)
      .populate('trustedContacts', '_id phone cnic email role name address')
      .select('-password');

    res.status(200).json({
      success: true,
      message: 'Trusted contact removed successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch all registered users (Admin/B2G only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch a single user details with guardian info (Admin/B2G only)
 */
const getUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate('trustedContacts', '_id phone cnic email role name address')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active alerts of users linked to this guardian
 */
const getGuardianAlerts = async (req, res, next) => {
  try {
    const guardianId = req.user._id;

    // Find all users who have listed this guardian in their trustedContacts
    const users = await User.find({ trustedContacts: guardianId }).select('_id');
    const userIds = users.map(u => u._id);

    // Find active SOS sessions for these users
    const activeSessions = await SosSession.find({
      user: { $in: userIds },
      active: true
    }).populate('user', 'phone cnic email name address lastLocation');

    res.status(200).json({
      success: true,
      data: activeSessions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current/last known locations of users linked to this guardian
 */
const getGuardianLocations = async (req, res, next) => {
  try {
    const guardianId = req.user._id;

    // Find users who have listed this guardian
    const users = await User.find({ trustedContacts: guardianId })
      .select('_id phone cnic email role name address lastLocation')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send request location alert/notification and return user's last known location
 */
const requestLocationFromUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const guardianId = req.user._id;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    // Check authorization
    const isLinked = targetUser.trustedContacts.some(
      (contactId) => contactId.toString() === guardianId.toString()
    );
    if (!isLinked && !['SuperAdmin', 'B2G'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized to request location for this user.' });
    }

    // Emit Pusher notification `location_request_received` to user
    try {
      const pusher = require('../config/pusher');
      pusher.trigger(`user-notifications-${userId}`, 'location_request_received', {
        requestedBy: {
          _id: req.user._id,
          phone: req.user.phone,
          name: req.user.name || 'Guardian'
        }
      }).catch(err => console.error('Pusher location request error:', err.message));
    } catch (err) {
      console.error('Failed to trigger Pusher alert for location request:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Location request sent successfully.',
      lastLocation: targetUser.lastLocation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger alert/SOS on behalf of the user
 */
const triggerAlertForUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const guardianId = req.user._id;

    const targetUser = await User.findById(userId).populate('trustedContacts', '_id phone');
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    // Check authorization
    const isLinked = targetUser.trustedContacts.some(
      (contactId) => contactId.toString() === guardianId.toString()
    );
    if (!isLinked && !['SuperAdmin', 'B2G'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Unauthorized to trigger alert for this user.' });
    }

    const sosService = require('../services/sos.service');
    const initialCoords = targetUser.lastLocation && targetUser.lastLocation.coordinates
      ? targetUser.lastLocation.coordinates
      : [0, 0];

    // Trigger SOS session (Pusher triggers are handled internally in startSosSession)
    const session = await sosService.startSosSession(userId, initialCoords);

    res.status(200).json({
      success: true,
      message: 'SOS session successfully triggered on behalf of user.',
      session
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  addTrustedContact,
  removeTrustedContact,
  getAllUsers,
  getUserDetails,
  getGuardianAlerts,
  getGuardianLocations,
  requestLocationFromUser,
  triggerAlertForUser
};
