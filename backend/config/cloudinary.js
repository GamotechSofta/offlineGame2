import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer from multer memory storage
 * @param {string} folder - The folder name in Cloudinary (e.g., 'payments', 'help-desk')
 * @returns {Promise<object>} - Cloudinary upload result with secure_url, public_id, etc.
 */
export const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'image',
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        stream.end(fileBuffer);
    });
};

/**
 * Delete an image from Cloudinary by its public_id
 * @param {string} publicId - The public_id of the image to delete
 * @returns {Promise<object>}
 */
export const deleteFromCloudinary = (publicId) => {
    return cloudinary.uploader.destroy(publicId);
};

export default cloudinary;
