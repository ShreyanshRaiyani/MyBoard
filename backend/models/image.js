const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true },
  s3Key: { type: String, required: true },
  url: { type: String, required: true },
  contentType: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Image', ImageSchema);