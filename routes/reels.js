import express from 'express';
import { protect } from '../middleware/auth.js';
import { uploadVideo } from '../middleware/upload.js';
import {
  uploadReel,
  getReelsFeed,
  toggleReelLike,
  incrementView
} from '../controllers/reelController.js';

const router = express.Router();

router.post('/',          protect, uploadVideo.single('video'), uploadReel);
router.get('/feed',       protect, getReelsFeed);
router.put('/:id/like',   protect, toggleReelLike);
router.put('/:id/view',   protect, incrementView);

export default router;