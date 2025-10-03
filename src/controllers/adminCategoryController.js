'use strict';

import { pool } from '../setup/db.js';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
  getCategoryById,
  getCategoryBySlug
} from '../models/categoryModel.js';

export const createCategoryController = async (req, res) => {
  try {
    const { name, slug, parentId, image, description, seoTitle, seoDescription } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    const categoryId = await createCategory({
      name,
      slug,
      parentId,
      image,
      description,
      seoTitle,
      seoDescription
    });

    res.status(201).json({
      message: 'Category created successfully',
      id: categoryId
    });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Category slug already exists' });
    }
    res.status(500).json({ message: 'Failed to create category', error: err.message });
  }
};

export const updateCategoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, parentId, image, description, seoTitle, seoDescription } = req.body;

    await updateCategory(id, {
      name,
      slug,
      parentId,
      image,
      description,
      seoTitle,
      seoDescription
    });

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Category slug already exists' });
    }
    res.status(500).json({ message: 'Failed to update category', error: err.message });
  }
};

export const deleteCategoryController = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCategory(id);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete category', error: err.message });
  }
};

export const getCategoryTreeController = async (req, res) => {
  try {
    const tree = await getCategoryTree();
    res.json({ message: 'Category tree retrieved successfully', tree });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get category tree', error: err.message });
  }
};

export const getCategoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await getCategoryById(id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category retrieved successfully', category });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get category', error: err.message });
  }
};

export const getCategoryBySlugController = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await getCategoryBySlug(slug);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category retrieved successfully', category });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get category', error: err.message });
  }
};

