const { z } = require('zod');
const EmergencyContact = require('../models/EmergencyContact');

const upsertContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(3, 'Phone number must be at least 3 characters'),
  description: z.string().optional()
});

/**
 * Get all emergency contacts
 */
const getAll = async (req, res, next) => {
  try {
    const contacts = await EmergencyContact.find({}).sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: contacts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or Update EmergencyContact (Admin only)
 */
const upsert = async (req, res, next) => {
  try {
    const validatedData = upsertContactSchema.parse(req.body);
    const { id, name, phone, description } = validatedData;

    let contact;
    if (id) {
      contact = await EmergencyContact.findByIdAndUpdate(
        id,
        { name, phone, description },
        { new: true, runValidators: true }
      );
      if (!contact) {
        return res.status(404).json({
          success: false,
          error: 'Emergency contact not found to update.'
        });
      }
    } else {
      contact = await EmergencyContact.create({ name, phone, description });
    }

    res.status(200).json({
      success: true,
      message: id ? 'Emergency contact updated successfully' : 'Emergency contact created successfully',
      data: contact
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete EmergencyContact (Admin only)
 */
const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contact = await EmergencyContact.findByIdAndDelete(id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Emergency contact not found to delete.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Emergency contact deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  upsert,
  remove
};
