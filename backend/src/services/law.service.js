const LawResource = require('../models/LawResource');

/**
 * Retrieves legal resource by category
 */
const getLawByCategory = async (category) => {
  const resource = await LawResource.findOne({ category: category.toLowerCase() });
  if (!resource) {
    throw new Error(`No law resources found for category '${category}'`);
  }
  return resource;
};

/**
 * Retrieves survival instructions specifically for a category
 */
const getSurvivalInstructions = async (category) => {
  const resource = await LawResource.findOne({ category: category.toLowerCase() }).select('category title survivalInstructions');
  if (!resource) {
    throw new Error(`No survival instructions found for category '${category}'`);
  }
  return {
    category: resource.category,
    title: resource.title,
    survivalInstructions: resource.survivalInstructions
  };
};

/**
 * Create or Update LawResource (Admin only)
 */
const upsertLawResource = async (resourceData) => {
  const { category, title, legalDescription, survivalInstructions } = resourceData;
  const normalizedCategory = category.toLowerCase();

  const resource = await LawResource.findOneAndUpdate(
    { category: normalizedCategory },
    {
      category: normalizedCategory,
      title,
      legalDescription,
      survivalInstructions
    },
    { new: true, upsert: true, runValidators: true }
  );

  return resource;
};

/**
 * Delete LawResource (Admin only)
 */
const deleteLawResource = async (category) => {
  const result = await LawResource.findOneAndDelete({ category: category.toLowerCase() });
  if (!result) {
    throw new Error(`No law resource found to delete for category '${category}'`);
  }
  return true;
};

/**
 * Retrieves all law resources
 */
const getAllLaws = async () => {
  return await LawResource.find({}).sort({ category: 1 });
};

module.exports = {
  getLawByCategory,
  getSurvivalInstructions,
  upsertLawResource,
  deleteLawResource,
  getAllLaws
};
