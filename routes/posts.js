import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import {
  createPost,
  getFeed,
  getUserPosts,
  toggleLike,
  addComment,
  getComments,
} from '../controllers/postController.js';

const router = Router();

// All routes are protected
router.use(protect);

router.post('/', uploadImage.single('image'), createPost); // POST /api/posts
router.get('/feed', getFeed);                              // GET  /api/posts/feed
router.get('/user/:userId', getUserPosts);                 // GET  /api/posts/user/:userId
router.put('/:id/like', toggleLike);                      // PUT  /api/posts/:id/like
router.post('/:id/comment', addComment);                  // POST /api/posts/:id/comment
router.get('/:id/comments', getComments);                 // GET  /api/posts/:id/comments

export default router;
