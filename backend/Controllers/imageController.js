const cloudinary = require("cloudinary").v2;

require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /images/upload
const uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ Status: 0, Message: "No file provided" });

    const originalName = req.file.originalname;
    const filename = `${Date.now()}_${originalName}`;

    const file = await uploadImageReturnUrl(req.file, filename);
    console.log("Uploaded file info:", file);

    return res.json({ Status: 1, Message: "Upload successful", Data: { filename, url: file.path } });
  } catch (error) {
    console.error("uploadImage error:", error);
    return res.status(500).json({ Status: 0, Message: "Upload failed", error: error.message });
  }
};

const uploadImageReturnUrl = async (file, originalName, options = {}) => {
  if (!file) throw new Error("file is required");

  try {
    const publicId = originalName.replace(/^\/+/, "");
    const uploadOptions = {
      public_id: publicId,
      resource_type: "image",
      overwrite: true,
    };

    if (options.folder) {
      uploadOptions.folder = options.folder;
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploadResult) => {
        if (error) return reject(error);
        resolve(uploadResult);
      });
      stream.end(file.buffer);
    });

    return { filename: result.original_filename, path: result.secure_url, publicId: result.public_id };
  } catch (err) {
    console.error("uploadImageReturnUrl error:", err && err.message ? err.message : err);
    throw new Error(`Failed to upload image to Cloudinary: ${err && err.message ? err.message : String(err)}`);
  }
};

// GET /image/:filename
const getImage = async (req, res) => {
  console.log("getImage called");
  try {
    const filename = req.params.filename;
    if (!filename) return res.status(400).send("filename required");

    const publicId = filename.replace(/^\/+/, "");
    const url = cloudinary.url(publicId, { secure: true });

    return res.redirect(url);
  } catch (error) {
    console.error("getImage error:", error);
    return res.status(500).send("Error fetching image");
  }
};

const normalizePublicId = (key) => {
  if (!key) return null;

  if (key.startsWith("http")) {
    const parts = key.split("/upload/");
    if (parts.length < 2) return null;

    let remainder = parts[1];
    remainder = remainder.replace(/^v\d+\//, "");
    remainder = remainder.replace(/\.[^/.]+$/, "");
    return remainder;
  }

  return key.replace(/^\/+/, "");
};

// helper to delete object(s) from Cloudinary. Accepts a public id or a URL.
const deleteFromS3 = async (key) => {
  const publicId = normalizePublicId(key);
  if (!publicId) throw new Error("key is required");

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary delete failed: ${result.result}`);
    }
    return { status: 1, key: publicId };
  } catch (err) {
    console.error("deleteFromS3 error:", err && err.message ? err.message : err);
    throw new Error("Failed to delete object from Cloudinary");
  }
};

// DELETE /images/:filename or DELETE /images (body.key)
const removeImage = async (req, res) => {
  console.log("removeImage called", req.params.filename);
  console.log("removeImage called", req.query.filename);
  try {
    const filename = req.params.filename;
    if (!filename) return res.status(400).json({ Status: 0, Message: "filename/key required" });

    const result = await deleteFromS3(filename);
    return res.status(200).json({ Status: 1, Message: "Image deleted", key: result.key });
  } catch (error) {
    console.error("removeImage error:", error);
    return res.status(500).json({ Status: 0, Message: "Delete failed", error: error.message });
  }
};

module.exports = { uploadImage, getImage, uploadImageReturnUrl, deleteFromS3, removeImage };
