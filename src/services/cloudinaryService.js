'use strict';

import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Cloudinary folder path
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Upload result
 */
async function uploadBuffer(buffer, folder = process.env.CLOUDINARY_FOLDER || 'uploads', options = {}) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: 'image',
      quality: 'auto:good', // Tự động tối ưu chất lượng
      fetch_format: 'auto', // Tự động chọn format tốt nhất
      ...options
    };

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

/**
 * Upload avatar với transformation
 * @param {Buffer} buffer - File buffer
 * @param {string} userId - User ID để tạo filename unique
 * @returns {Promise<Object>} Upload result
 */
async function uploadAvatar(buffer, userId) {
  const folder = `${process.env.CLOUDINARY_FOLDER || 'muabantainguyen'}/avatars`;
  const options = {
    public_id: `avatar_${userId}`,
    overwrite: true,
    transformation: [
      { width: 200, height: 200, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' },
      { format: 'auto' }
    ]
  };

  return uploadBuffer(buffer, folder, options);
}

/**
 * Upload product image với multiple sizes
 * @param {Buffer} buffer - File buffer
 * @param {string} productId - Product ID
 * @param {number} index - Image index
 * @returns {Promise<Object>} Upload result với multiple URLs
 */
async function uploadProductImage(buffer, productId, index = 0) {
  const folder = `${process.env.CLOUDINARY_FOLDER || 'muabantainguyen'}/products`;
  const publicId = `product_${productId}_${index}`;

  const options = {
    public_id: publicId,
    overwrite: true,
    quality: 'auto:good',
    format: 'auto'
  };

  const result = await uploadBuffer(buffer, folder, options);

  // Tạo các URL với kích thước khác nhau
  const baseUrl = result.secure_url.split('/upload/')[0] + '/upload/';
  const imagePath = result.secure_url.split('/upload/')[1];

  return {
    ...result,
    urls: {
      original: result.secure_url,
      thumbnail: `${baseUrl}c_fill,w_150,h_150/${imagePath}`,
      medium: `${baseUrl}c_fill,w_400,h_400/${imagePath}`,
      large: `${baseUrl}c_fill,w_800,h_800/${imagePath}`
    }
  };
}

/**
 * Delete image by public_id
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<Object>} Delete result
 */
async function deleteByPublicId(publicId) {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Delete multiple images
 * @param {Array<string>} publicIds - Array of public_ids
 * @returns {Promise<Object>} Delete result
 */
async function deleteMultipleImages(publicIds) {
  try {
    return await cloudinary.api.delete_resources(publicIds);
  } catch (error) {
    console.error('Error deleting multiple images:', error);
    throw error;
  }
}

/**
 * Get optimized URL for existing image
 * @param {string} publicId - Cloudinary public_id
 * @param {Object} transformation - Transformation options
 * @returns {string} Optimized URL
 */
function getOptimizedUrl(publicId, transformation = {}) {
  return cloudinary.url(publicId, {
    quality: 'auto:good',
    fetch_format: 'auto',
    ...transformation
  });
}

/**
 * Generate transformation URLs for different sizes
 * @param {string} publicId - Cloudinary public_id
 * @returns {Object} Object with different size URLs
 */
function generateSizeUrls(publicId) {
  return {
    thumbnail: getOptimizedUrl(publicId, { width: 150, height: 150, crop: 'fill' }),
    small: getOptimizedUrl(publicId, { width: 300, height: 300, crop: 'fit' }),
    medium: getOptimizedUrl(publicId, { width: 600, height: 600, crop: 'fit' }),
    large: getOptimizedUrl(publicId, { width: 1200, height: 1200, crop: 'fit' }),
    original: getOptimizedUrl(publicId)
  };
}

export {
  cloudinary,
  uploadBuffer,
  uploadAvatar,
  uploadProductImage,
  deleteByPublicId,
  deleteMultipleImages,
  getOptimizedUrl,
  generateSizeUrls
};