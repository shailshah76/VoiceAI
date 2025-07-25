import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { files: 2, fileSize: 20 * 1024 * 1024 }, // 2 files, 20MB each
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain',
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
    ];
    
    console.log(`📁 File upload filter check: ${file.originalname} (${file.mimetype})`);
    
    if (allowed.includes(file.mimetype)) {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      console.log(`✅ File accepted: ${file.originalname} (${fileExtension})`);
      cb(null, true);
    } else {
      console.log(`❌ File rejected: ${file.originalname} - Unsupported type: ${file.mimetype}`);
      console.log(`Supported types: ${allowed.join(', ')}`);
      cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: PPT, PPTX, PDF, Images, Text`));
    }
  }
});

router.post('/', upload.array('files', 2), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  res.json({
    files: req.files.map(f => ({
      filename: f.filename,
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      path: f.path
    }))
  });
});

export default router; 