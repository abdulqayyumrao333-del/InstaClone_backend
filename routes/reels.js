import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { uploadVideo } from '../middleware/upload.js';
import { uploadReel, getReelsFeed, toggleReelLike, incrementView } from '../controllers/reelController.js';

const router = Router();

// All routes are protected
router.use(protect);

router.post('/', uploadVideo.single('video'), uploadReel); // POST /api/reels
router.get('/feed', getReelsFeed);                        // GET  /api/reels/feed
router.put('/:id/like', toggleReelLike);                  // PUT  /api/reels/:id/like
router.put('/:id/view', incrementView);                   // PUT  /api/reels/:id/view

export default router;
