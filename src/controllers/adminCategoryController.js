'use strict';

import { createCategory, updateCategory, deleteCategory, getCategoryTree } from '../models/categoryModel.js';

async function createCategoryController(req, res) {
  try {
    const id = await createCategory(req.body);
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create category', error: err.message });
  }
}

async function updateCategoryController(req, res) {
  try {
    await updateCategory(req.params.id, req.body);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update category', error: err.message });
  }
}

async function deleteCategoryController(req, res) {
  try {
    await deleteCategory(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete category', error: err.message });
  }
}

async function getCategoryTreeController(req, res) {
  try {
    const tree = await getCategoryTree();
    return res.json({ tree });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get categories', error: err.message });
  }
}

export { createCategoryController, updateCategoryController, deleteCategoryController, getCategoryTreeController };

