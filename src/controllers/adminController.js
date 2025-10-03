'use strict';

import {
  listAllUsers,
  blockUser,
  unblockUser,
  getOrdersOfUser,
  createNewProduct,
  updateExistingProduct,
  deleteExistingProduct,
  createNewVoucher,
  listAllVouchers,
  updateExistingVoucher,
  deleteExistingVoucher,
  getProductDetail,
} from '../services/adminService.js';
import { listCatalog } from '../services/productService.js';

async function listUsersController(req, res) {
  try {
    const {
      page = 1,
      pageSize = 20,
      search = '',
      role = '',
      isBlocked = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const result = await listAllUsers({
      page: Number(page),
      pageSize: Number(pageSize),
      search,
      role,
      isBlocked,
      sortBy,
      sortOrder
    });

    return res.json({
      success: true,
      message: 'Users retrieved successfully',
      ...result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to list users',
      error: err.message
    });
  }
}

async function setBlockController(req, res) {
  try {
    const { id } = req.params;
    const { blocked } = req.body;
    if (blocked) await blockUser(id); else await unblockUser(id);
    return res.json({ success: true, message: 'User status updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user', error: err.message });
  }
}

async function userOrdersController(req, res) {
  try {
    const { id } = req.params;
    const orders = await getOrdersOfUser(id);
    return res.json({ success: true, message: 'User orders retrieved successfully', orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get user orders', error: err.message });
  }
}

async function createProductController(req, res) {
  try {
    const id = await createNewProduct(req.body);
    return res.status(201).json({ success: true, message: 'Product created successfully', id });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create product', error: err.message });
  }
}

async function updateProductController(req, res) {
  try {
    const { id } = req.params;
    await updateExistingProduct(id, req.body);
    return res.json({ success: true, message: 'Product updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update product', error: err.message });
  }
}

async function deleteProductController(req, res) {
  try {
    const { id } = req.params;
    await deleteExistingProduct(id);
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete product', error: err.message });
  }
}

async function createVoucherController(req, res) {
  try {
    const id = await createNewVoucher(req.body);
    return res.status(201).json({ success: true, message: 'Voucher created successfully', id });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create voucher', error: err.message });
  }
}

async function listVouchersController(req, res) {
  try {
    const vouchers = await listAllVouchers();
    return res.json({ success: true, message: 'Vouchers retrieved successfully', vouchers });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list vouchers', error: err.message });
  }
}

async function updateVoucherController(req, res) {
  try {
    const { id } = req.params;
    await updateExistingVoucher(id, req.body);
    return res.json({ success: true, message: 'Voucher updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update voucher', error: err.message });
  }
}

async function deleteVoucherController(req, res) {
  try {
    const { id } = req.params;
    await deleteExistingVoucher(id);
    return res.json({ success: true, message: 'Voucher deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete voucher', error: err.message });
  }
}

async function listProductsController(req, res) {
  try {
    const { q, categoryId, minPrice, maxPrice, inStock, page, pageSize } = req.query;
    const result = await listCatalog({
      q: q || undefined,
      categoryId: categoryId || undefined,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      inStock: inStock === 'true' ? true : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.json({ message: 'Products retrieved successfully', ...result });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list products', error: err.message });
  }
}

async function getProductController(req, res) {
  try {
    const { id } = req.params;
    const product = await getProductDetail(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    return res.json({
      success: true,
      message: 'Product retrieved successfully',
      product
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get product',
      error: err.message
    });
  }
}

export {
  listUsersController,
  setBlockController,
  userOrdersController,
  listProductsController,
  createProductController,
  updateProductController,
  deleteProductController,
  createVoucherController,
  listVouchersController,
  updateVoucherController,
  deleteVoucherController,
  getProductController,
};

