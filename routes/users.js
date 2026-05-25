import express from 'express';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import {
  getProfile, updateProfile,
  toggleFollow, searchUsers, getSuggestions
} from '../controllers/userController.js';

const router = express.Router();

router.get('/suggestions',              protect, getSuggestions);
router.get('/search',                   protect, searchUsers);
router.get('/:username',                protect, getProfile);
router.put('/profile/update', protect, uploadImage.single('image'), updateProfile);
router.put('/:id/follow',               protect, toggleFollow);

export default router;