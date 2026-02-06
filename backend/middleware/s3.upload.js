const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
require("dotenv").config();

const s3 = new S3Client({
  region: process.env.CLOUDINARY_CLOUD_NAME,
  credentials: {
    accessKeyId: process.env.CLOUDINARY_API_KEY,
    secretAccessKey: process.env.CLOUDINARY_API_SECRET
  },
});

const uploadFileToS3 = async (file, folder) => {
  const fileStream = fs.createReadStream(file.path);
  const s3Key = `useruploads/${folder}/${file.filename}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ACL: "public-read",
    ContentType: file.mimetype,
  };

  await s3.send(new PutObjectCommand(params));
  fs.unlinkSync(file.path);

  return `https://${process.env.CLOUDINARY_CLOUD_NAME}.s3.amazonaws.com/${s3Key}`;
};

module.exports = { uploadFileToS3 };
 