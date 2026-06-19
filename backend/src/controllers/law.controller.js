const { z } = require('zod');
const lawService = require('../services/law.service');

// Zod validations
const upsertLawSchema = z.object({
  category: z.string().min(2, 'Category name must be at least 2 characters'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  legalDescription: z.string().min(10, 'Legal description must be detailed'),
  survivalInstructions: z.array(z.string()).min(1, 'At least one survival instruction is required'),
  precautions: z.array(z.string()).optional(),
  language: z.enum(['english', 'urdu', 'sindhi']).default('english')
});

/**
 * Get all laws
 */
const getAll = async (req, res, next) => {
  try {
    const laws = await lawService.getAllLaws();
    res.status(200).json({
      success: true,
      data: laws
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get law resource by category and language
 */
const getByCategory = async (req, res, next) => {
  try {
    const { category, language } = req.params;
    const law = await lawService.getLawByCategory(category, language || 'english');
    res.status(200).json({
      success: true,
      data: law
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get survival instructions by category and language (Separate Endpoint)
 */
const getInstructions = async (req, res, next) => {
  try {
    const { category, language } = req.params;
    const instructions = await lawService.getSurvivalInstructions(category, language || 'english');
    res.status(200).json({
      success: true,
      data: instructions
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get safety precautions by category and language (Separate Endpoint)
 */
const getPrecautions = async (req, res, next) => {
  try {
    const { category, language } = req.params;
    const precautions = await lawService.getPrecautions(category, language || 'english');
    res.status(200).json({
      success: true,
      data: precautions
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Create or Update LawResource (Admin only)
 */
const upsert = async (req, res, next) => {
  try {
    const validatedData = upsertLawSchema.parse(req.body);
    const law = await lawService.upsertLawResource(validatedData);
    res.status(200).json({
      success: true,
      message: 'Law resource updated successfully',
      data: law
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete LawResource (Admin only)
 */
const remove = async (req, res, next) => {
  try {
    const { category, language } = req.params;
    await lawService.deleteLawResource(category, language || 'english');
    res.status(200).json({
      success: true,
      message: `Law resource for category '${category}' in language '${language || 'english'}' deleted successfully.`
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  getAll,
  getByCategory,
  getInstructions,
  getPrecautions,
  upsert,
  remove
};
