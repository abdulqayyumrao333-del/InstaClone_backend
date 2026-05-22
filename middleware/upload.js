import multer from 'multer';

// Use memory storage — files stored as Buffer in req.file.buffer (no disk writes)
const memoryStorage = multer.memoryStorage();

// ── Image upload ──────────────────────────────────────────────────────────────
export const uploadImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
    }
  },
});

// ── Video upload ──────────────────────────────────────────────────────────────
export const uploadVideo = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/mov', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4 and MOV videos are allowed.'), false);
    }
  },
});
