import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import reelRoutes from './routes/reels.js';
import storyRoutes from './routes/stories.js';
import aiRoutes from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Core Middleware ────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' })); // Allow all origins (tighten in production)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'InstaClone API running', version: '1.0.0' });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/ai', aiRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);

  // Handle Multer errors specifically
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large' });
  }
  if (err.message?.includes('Invalid file type')) {
    return res.status(415).json({ message: err.message });
  }

  res.status(500).json({ message: err.message || 'Internal server error' });
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`InstaClone server running on port ${PORT}`);
});

export default app;
