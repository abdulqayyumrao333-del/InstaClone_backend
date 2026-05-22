import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadStory, getStoriesFeed, viewStory } from '../controllers/storyController.js';

const router = Router();

// All routes are protected
router.use(protect);

router.post('/', uploadImage.single('image'), uploadStory); // POST /api/stories
router.get('/feed', getStoriesFeed);                       // GET  /api/stories/feed
router.put('/:id/view', viewStory);                        // PUT  /api/stories/:id/view

export default router;
