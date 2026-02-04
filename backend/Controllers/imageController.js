const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

require('dotenv').config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Helper to compute base URL (prefer env APP_BASE_URL, fallback to request origin in controller)
const getBaseUrl = (req) => {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

// POST /images/upload
const uploadImage = async (req, res) => {

  try {
    if (!req.file) return res.status(400).json({ Status: 0, Message: 'No file provided' });

    const originalName = req.file.originalname;
    const filename = `${Date.now()}_${originalName}`;
    const s3Key = `${filename}`;

    const file = await uploadImageReturnUrl(req.file, s3Key,);
    console.log('Uploaded file info:', file);

    return res.json({ Status: 1, Message: 'Upload successful', Data: { filename, url: file.path } });
  } catch (error) {
    console.error('uploadImage error:', error);
    return res.status(500).json({ Status: 0, Message: 'Upload failed', error: error.message });
  }
};


const uploadImageReturnUrl = async (file, originalName, options = {}) => {
  if (!file) throw new Error('file is required');

  try {
    const s3Key = `${process.env.AWS_IMAGE_FOLDER}/${originalName}`;
    const putParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };
    await s3.send(new PutObjectCommand(putParams));
    const pathOnly = `${s3Key}`;
    return { filename: originalName, path: pathOnly };
  } catch (err) {
    console.error('uploadImageReturnUrl error:', err && err.message ? err.message : err);
    throw new Error(`Failed to upload image to S3: ${err && err.message ? err.message : String(err)}`);
  }
};

// GET /image/:filename
const getImage = async (req, res) => {
  console.log('getImage called');
  try {
    const filename = req.params.filename;
    if (!filename) return res.status(400).send('filename required');

    const s3Key = `${filename}`;

    const getParams = { Bucket: process.env.AWS_BUCKET_NAME, Key: s3Key };
    const command = new GetObjectCommand(getParams);
    const response = await s3.send(command);

    // Set content-type if available
    if (response.ContentType) res.setHeader('Content-Type', response.ContentType);

    // Stream body to response
    const stream = response.Body;
    if (stream && typeof stream.pipe === 'function') {
      stream.pipe(res);
    } else {
      // If Body is a Buffer-like or unexpected, consume and send
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    }
  } catch (error) {
    console.error('getImage error:', error);
    if (error.name === 'NoSuchKey' || (error.$metadata && error.$metadata.httpStatusCode === 404)) {
      return res.status(404).send('Image not found');
    }
    return res.status(500).send('Error fetching image');
  }
};

// helper to delete object(s) from S3. Accepts a key (e.g. "folder/name.jpg") or a filename.
const deleteFromS3 = async (key) => {
  if (!key) throw new Error('key is required');
  const candidates = [];
  candidates.push(key);
  if (process.env.AWS_IMAGE_FOLDER && !key.startsWith(process.env.AWS_IMAGE_FOLDER)) {
    candidates.push(`${process.env.AWS_IMAGE_FOLDER}/${key}`);
  }
  console.log('deleteFromS3 candidates:', candidates);
  for (const candidate of candidates) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: candidate }));
      return { success: true, key: candidate };
    } catch (err) {
      // log and continue to next candidate
      console.error('deleteFromS3 attempt failed for', candidate, err && err.message ? err.message : err);
    }
  }

  // if we reach here, none of the deletions succeeded
  throw new Error('Failed to delete object from S3');
};

// DELETE /images/:filename or DELETE /images (body.key)
const removeImage = async (req, res) => {
  console.log('removeImage called', req.params.filename);
  console.log('removeImage called', req.query.filename);
  try {
    const filename = req.params.filename;
    if (!filename) return res.status(400).json({ Status: 0, Message: 'filename/key required' });

    const result = await deleteFromS3(filename);
    return res.status(200).json({ Status: 1, Message: 'Image deleted', key: result.key });
  } catch (error) {
    console.error('removeImage error:', error);
    return res.status(500).json({ Status: 0, Message: 'Delete failed', error: error.message });
  }
};

module.exports = { uploadImage, getImage, uploadImageReturnUrl, deleteFromS3, removeImage };