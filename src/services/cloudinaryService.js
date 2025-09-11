'use strict';

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBuffer(buffer, folder = process.env.CLOUDINARY_FOLDER || 'uploads', filename = '') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: filename || undefined, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function deleteByPublicId(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

export { cloudinary, uploadBuffer, deleteByPublicId };
