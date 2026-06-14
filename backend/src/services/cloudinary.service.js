const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');

/**
 * Converts a file buffer into a readable stream
 * @param {Buffer} buffer 
 */
const bufferToStream = (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
};

/**
 * Uploads a file buffer directly to Cloudinary using streams
 * @param {Buffer} fileBuffer - File raw buffer from multer
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<object>} Upload result metadata from Cloudinary
 */
const uploadMediaStream = (fileBuffer, folder = 'nigehbaan_incidents') => {
  return new Promise((resolve, reject) => {
    // If running in mock mode, return mock upload result immediately
    if (process.env.CLOUDINARY_CLOUD_NAME === 'mock_cloudinary') {
      console.log('CLOUDINARY MOCK: Simulating media upload...');
      return setTimeout(() => {
        resolve({
          secure_url: `https://res.cloudinary.com/mock_cloudinary/image/upload/v1700000000/nigehbaan_mock_media_${Date.now()}.jpg`,
          public_id: `nigehbaan_mock_media_${Date.now()}`,
          format: 'jpg',
          resource_type: 'image'
        });
      }, 300);
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto', // Detect image, video, audio automatically
        transformation: [
          { quality: 'auto:good' } // Optimize file size on fly
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary stream upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    bufferToStream(fileBuffer).pipe(uploadStream);
  });
};

module.exports = {
  uploadMediaStream
};
