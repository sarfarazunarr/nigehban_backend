const LawResource = require('../models/LawResource');

/**
 * Retrieves legal resource by category and language
 */
const getLawByCategory = async (category, language = 'english') => {
  const normalizedLanguage = language.toLowerCase();
  const query = { category: category.toLowerCase() };
  if (normalizedLanguage === 'english') {
    query.$or = [{ language: 'english' }, { language: { $exists: false } }, { language: null }];
  } else {
    query.language = normalizedLanguage;
  }
  
  const resource = await LawResource.findOne(query);
  if (!resource) {
    throw new Error(`No law resources found for category '${category}' in ${language}`);
  }
  return resource;
};

/**
 * Retrieves survival instructions specifically for a category and language
 */
const getSurvivalInstructions = async (category, language = 'english') => {
  const normalizedLanguage = language.toLowerCase();
  const query = { category: category.toLowerCase() };
  if (normalizedLanguage === 'english') {
    query.$or = [{ language: 'english' }, { language: { $exists: false } }, { language: null }];
  } else {
    query.language = normalizedLanguage;
  }

  const resource = await LawResource.findOne(query).select('category title language survivalInstructions');
  if (!resource) {
    throw new Error(`No survival instructions found for category '${category}' in ${language}`);
  }
  return {
    category: resource.category,
    title: resource.title,
    language: resource.language || 'english',
    survivalInstructions: resource.survivalInstructions
  };
};

/**
 * Retrieves precautions specifically for a category and language
 */
const getPrecautions = async (category, language = 'english') => {
  const normalizedLanguage = language.toLowerCase();
  const query = { category: category.toLowerCase() };
  if (normalizedLanguage === 'english') {
    query.$or = [{ language: 'english' }, { language: { $exists: false } }, { language: null }];
  } else {
    query.language = normalizedLanguage;
  }

  const resource = await LawResource.findOne(query).select('category title language precautions');
  if (!resource) {
    throw new Error(`No precautions found for category '${category}' in ${language}`);
  }
  return {
    category: resource.category,
    title: resource.title,
    language: resource.language || 'english',
    precautions: resource.precautions || []
  };
};

/**
 * Create or Update LawResource (Admin only)
 */
const upsertLawResource = async (resourceData) => {
  const { category, title, legalDescription, survivalInstructions, precautions, language } = resourceData;
  const normalizedCategory = category.toLowerCase();
  const normalizedLanguage = (language || 'english').toLowerCase();

  const updateFields = {
    category: normalizedCategory,
    language: normalizedLanguage,
    title,
    legalDescription,
    survivalInstructions
  };

  if (precautions !== undefined) {
    updateFields.precautions = precautions;
  }

  const resource = await LawResource.findOneAndUpdate(
    { category: normalizedCategory, language: normalizedLanguage },
    updateFields,
    { new: true, upsert: true, runValidators: true }
  );

  return resource;
};

/**
 * Delete LawResource (Admin only)
 */
const deleteLawResource = async (category, language = 'english') => {
  const normalizedLanguage = language.toLowerCase();
  const query = { category: category.toLowerCase() };
  if (normalizedLanguage === 'english') {
    query.$or = [{ language: 'english' }, { language: { $exists: false } }, { language: null }];
  } else {
    query.language = normalizedLanguage;
  }

  const result = await LawResource.findOneAndDelete(query);
  if (!result) {
    throw new Error(`No law resource found to delete for category '${category}' in ${language}`);
  }
  return true;
};

/**
 * Retrieves all law resources
 */
const getAllLaws = async () => {
  return await LawResource.find({}).sort({ category: 1, language: 1 });
};

module.exports = {
  getLawByCategory,
  getSurvivalInstructions,
  getPrecautions,
  upsertLawResource,
  deleteLawResource,
  getAllLaws
};
