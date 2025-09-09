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
} from '../services/adminService.js';

async function listUsersController(req, res) {
  try {
    const { page, pageSize } = req.query;
    const users = await listAllUsers({ page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list users', error: err.message });
  }
}

async function setBlockController(req, res) {
  try {
    const { id } = req.params;
    const { blocked } = req.body;
    if (blocked) await blockUser(id); else await unblockUser(id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update user', error: err.message });
  }
}

async function userOrdersController(req, res) {
  try {
    const { id } = req.params;
    const orders = await getOrdersOfUser(id);
    return res.json({ orders });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get user orders', error: err.message });
  }
}

async function createProductController(req, res) {
  try {
    const id = await createNewProduct(req.body);
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create product', error: err.message });
  }
}

async function updateProductController(req, res) {
  try {
    const { id } = req.params;
    await updateExistingProduct(id, req.body);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update product', error: err.message });
  }
}

async function deleteProductController(req, res) {
  try {
    const { id } = req.params;
    await deleteExistingProduct(id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete product', error: err.message });
  }
}

async function createVoucherController(req, res) {
  try {
    const id = await createNewVoucher(req.body);
    return res.status(201).json({ id });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create voucher', error: err.message });
  }
}

async function listVouchersController(req, res) {
  try {
    const vouchers = await listAllVouchers();
    return res.json({ vouchers });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list vouchers', error: err.message });
  }
}

async function updateVoucherController(req, res) {
  try {
    const { id } = req.params;
    await updateExistingVoucher(id, req.body);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update voucher', error: err.message });
  }
}

async function deleteVoucherController(req, res) {
  try {
    const { id } = req.params;
    await deleteExistingVoucher(id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete voucher', error: err.message });
  }
}

export {
  listUsersController,
  setBlockController,
  userOrdersController,
  createProductController,
  updateProductController,
  deleteProductController,
  createVoucherController,
  listVouchersController,
  updateVoucherController,
  deleteVoucherController,
};

