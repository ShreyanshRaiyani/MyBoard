const express = require('express');
const multer = require('multer');
const { uploadImage, getImage, removeImage } = require('../Controllers/imageController');
const { protect } = require('../middelware/auth');

const router = express.Router();

// Use memory storage so we can send buffer directly to S3
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload single image: field name should be 'image'
router.post('/images/upload', upload.single('image'), uploadImage);

// Delete by filename (protected)
// RegExp delete route to capture full path after /images/ (supports slashes in filename)
router.delete(/^\/images\/(.*)$/, protect, (req, res, next) => {
	const captured = (req.params && req.params[0]) || null;
	const filename = captured || req.path.replace(/^\/images\//, '');
	req.params = req.params || {};
	try {
		req.params.filename = decodeURIComponent(filename);
	} catch (e) {
		req.params.filename = filename;
	}
	next();
}, removeImage);

router.get(/^\/image\/(.*)$/, (req, res, next) => {
	// For RegExp routes, Express places captures in req.params as an array-like object.
	const captured = (req.params && req.params[0]) || null;
	// Fallback: derive from req.path if captures are absent
	const filename = captured || req.path.replace(/^\/image\//, '');
	req.params = req.params || {};
	try {
		req.params.filename = decodeURIComponent(filename);
	} catch (e) {
		req.params.filename = filename;
	}
	next();
}, getImage);

module.exports = router;