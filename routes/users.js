import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { getProfile, updateProfile, toggleFollow, searchUsers } from '../controllers/userController.js';

const router = Router();

// All routes are protected
router.use(protect);

router.get('/search', searchUsers);                                // GET  /api/users/search?q=username
router.get('/:username', getProfile);                             // GET  /api/users/:username
router.put('/profile', uploadImage.single('image'), updateProfile); // PUT  /api/users/profile
router.put('/:id/follow', toggleFollow);                          // PUT  /api/users/:id/follow

export default router;
