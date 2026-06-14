const { z } = require('zod');
const User = require('../models/User');

const addContactSchema = z.object({
  contactInfo: z.string().min(1, 'Contact info (phone, email, or CNIC) is required')
});

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('trustedContacts', '_id phone cnic email role')
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
 * Add a family member / guardian to trusted contacts
 */
const addTrustedContact = async (req, res, next) => {
  try {
    const validatedData = addContactSchema.parse(req.body);
    const { contactInfo } = validatedData;

    // Search contact by phone, email, or CNIC
    const contactUser = await User.findOne({
      $or: [
        { phone: contactInfo },
        { email: contactInfo.toLowerCase() },
        { cnic: contactInfo }
      ]
    });

    if (!contactUser) {
      return res.status(404).json({
        success: false,
        error: 'No user registered with this phone, email, or CNIC.'
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
      .populate('trustedContacts', '_id phone cnic email role')
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
      .populate('trustedContacts', '_id phone cnic email role')
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

module.exports = {
  getProfile,
  addTrustedContact,
  removeTrustedContact
};
