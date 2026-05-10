/**
 * upload.js — local disk file storage via multer
 * Files saved to  /uploads/<category>/  under the project root
 * Served as static at  GET /uploads/<category>/<filename>
 */
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

function makeStorage(category) {
  const dir = path.join(UPLOAD_ROOT, category);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename:    (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  });
}

const ALLOWED = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|jpg|jpeg|png|gif|mp4|mp3)$/i;

function fileFilter(_req, file, cb) {
  if (ALLOWED.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
}

/** Returns a multer instance for the given category folder */
function uploader(category, field = 'file', maxMB = 20) {
  return multer({
    storage:  makeStorage(category),
    fileFilter,
    limits: { fileSize: maxMB * 1024 * 1024 },
  }).single(field);
}

/** Middleware wrapper that calls next() even if no file was uploaded */
function optionalUpload(category, field = 'file') {
  const upload = uploader(category, field);
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  };
}

/** Build the public URL for an uploaded file */
function fileUrl(req, filename, category) {
  const base = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${category}/${filename}`;
}

module.exports = { optionalUpload, fileUrl, UPLOAD_ROOT };
