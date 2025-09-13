'use strict';

import { listUsers, setUserBlocked, getUserOrders, createProduct, updateProduct, deleteProduct, createVoucher, listVouchers, updateVoucher, deleteVoucher, getProductById } from '../models/adminModel.js';

// Users
const listAllUsers = (params) => listUsers(params);
const blockUser = (userId) => setUserBlocked(userId, true);
const unblockUser = (userId) => setUserBlocked(userId, false);
const getOrdersOfUser = (userId) => getUserOrders(userId);

// Products
const createNewProduct = (payload) => createProduct(payload);
const updateExistingProduct = (id, payload) => updateProduct(id, payload);
const deleteExistingProduct = (id) => deleteProduct(id);

// Vouchers
const createNewVoucher = (payload) => createVoucher(payload);
const listAllVouchers = () => listVouchers();
const updateExistingVoucher = (id, payload) => updateVoucher(id, payload);
const deleteExistingVoucher = (id) => deleteVoucher(id);
const getProductDetail = (id) => getProductById(id);


export {
  listAllUsers,
  blockUser,
  unblockUser,
  getOrdersOfUser,
  createNewProduct,
  updateExistingProduct,
  deleteExistingProduct,
  getProductDetail,
  createNewVoucher,
  listAllVouchers,
  updateExistingVoucher,
  deleteExistingVoucher,
};

