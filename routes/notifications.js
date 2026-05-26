import express from 'express';
import { protect } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// GET /api/notifications
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select(`
        *,
        actor:actor_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ message: error.message });

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/read — sab read mark karo
router.put('/read', protect, async (req, res) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/notifications/count — unread count
router.get('/count', protect, async (req, res) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) return res.status(500).json({ message: error.message });

    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;