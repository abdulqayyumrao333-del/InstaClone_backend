import express from 'express';  // express import karo, sirf Router nahi
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import {
  createPost,
  getFeed,
  getUserPosts,
  toggleLike,
  addComment,
  getComments,
  deletePost
} from '../controllers/postController.js';

const router = express.Router();  // sirf ek baar declare karo

// Saare routes protected hain - har route mein protect middleware lagao
router.post('/',                protect, uploadImage.single('image'), createPost);
router.get('/feed',             protect, getFeed);
router.get('/user/:userId',     protect, getUserPosts);
router.put('/:id/like',         protect, toggleLike);
router.post('/:id/comment',     protect, addComment);
router.get('/:id/comments',     protect, getComments);
router.delete('/:id',           protect, deletePost);

export default router;