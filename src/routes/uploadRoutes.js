'use strict';

import express from 'express';
import multer from 'multer';
import { uploadBuffer } from '../services/cloudinaryService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Cấu hình multer để hỗ trợ nhiều file
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Tối đa 10 files
  },
  fileFilter: (req, file, cb) => {
    // Chỉ cho phép upload image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// POST /api/uploads/images - Upload single hoặc multiple images
router.post('/images', authMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const { folder = 'general' } = req.body; // Cho phép specify folder
    const cloudinaryFolder = `${process.env.CLOUDINARY_FOLDER || 'muabantainguyen'}/${folder}`;

    // Upload tất cả files song song
    const uploadPromises = req.files.map(async (file) => {
      try {
        const result = await uploadBuffer(file.buffer, cloudinaryFolder);
        return {
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          originalName: file.originalname
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          originalName: file.originalname
        };
      }
    });

    const results = await Promise.all(uploadPromises);

    // Phân loại thành công và thất bại
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return res.status(successful.length > 0 ? 201 : 400).json({
      success: successful.length > 0,
      message: `Uploaded ${successful.length}/${req.files.length} files successfully`,
      data: {
        successful,
        failed,
        total: req.files.length,
        successCount: successful.length,
        failCount: failed.length
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: err.message
    });
  }
});

// POST /api/uploads/avatar - Upload avatar riêng (single file)
router.post('/avatar', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No avatar file provided'
      });
    }

    const cloudinaryFolder = `${process.env.CLOUDINARY_FOLDER || 'muabantainguyen'}/avatars`;
    const result = await uploadBuffer(req.file.buffer, cloudinaryFolder);

    return res.status(201).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Avatar upload failed',
      error: err.message
    });
  }
});

// POST /api/uploads/product - Upload product images (multiple)
router.post('/product', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No product images provided'
      });
    }

    const cloudinaryFolder = `${process.env.CLOUDINARY_FOLDER || 'muabantainguyen'}/products`;

    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadBuffer(file.buffer, cloudinaryFolder);
      return {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        originalName: file.originalname
      };
    });

    const results = await Promise.all(uploadPromises);

    return res.status(201).json({
      success: true,
      message: `Uploaded ${results.length} product images successfully`,
      data: {
        images: results,
        count: results.length
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Product images upload failed',
      error: err.message
    });
  }
});

// POST /api/uploads/announcement - Upload announcement image (single file)
router.post('/announcement', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No announcement image provided'
      });
    }

    const cloudinaryFolder = `${process.env.CLOUDINARY_FOLDER || 'muabantainguyen'}/announcements`;
    const result = await uploadBuffer(req.file.buffer, cloudinaryFolder);

    return res.status(201).json({
      success: true,
      message: 'Announcement image uploaded successfully',
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Announcement image upload failed',
      error: err.message
    });
  }
});

export default router;