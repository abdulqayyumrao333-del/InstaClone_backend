import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { generatePostCaption, getAISuggestions, aiChat } from '../controllers/aiController.js';

const router = Router();

// All routes are protected
router.use(protect);

router.post('/generate-caption', generatePostCaption); // POST /api/ai/generate-caption
router.post('/suggestions', getAISuggestions);         // POST /api/ai/suggestions
router.post('/chat', aiChat);                          // POST /api/ai/chat

export default router;
