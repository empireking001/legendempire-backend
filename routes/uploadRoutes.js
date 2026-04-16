const express    = require('express');
const multer     = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const { protect, adminOnly } = require('../middleware/auth');

// Use memory storage — no temp files on disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, GIF, WebP images allowed.'), false);
  },
});

const r = express.Router();

// POST /api/upload  — upload image to Cloudinary via stream
r.post('/', protect, adminOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    // Upload buffer to Cloudinary using upload_stream
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:         'legendempire',
          transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else       resolve(result);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    res.json({
      success:   true,
      url:       result.secure_url,
      public_id: result.public_id,
      message:   'Image uploaded successfully.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/upload  — delete image from Cloudinary
r.delete('/', protect, adminOnly, async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ success: false, message: 'public_id required.' });
    await cloudinary.uploader.destroy(public_id);
    res.json({ success: true, message: 'Image deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = r;
