import { supabaseAdmin } from '../config/supabase.js';

// ── POST /api/reels ───────────────────────────────────────────────────────────
export const uploadReel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    const userId = req.user.id;
    const caption = req.body.caption || '';
    const fileBuffer = req.file.buffer;
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.mp4`;

    // Upload video to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('reels')
      .upload(filePath, fileBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ message: 'Failed to upload video', error: uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('reels').getPublicUrl(filePath);

    // Insert reel record
    const { data: reel, error: insertError } = await supabaseAdmin
      .from('reels')
      .insert({ user_id: userId, video_url: urlData.publicUrl, caption })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ message: 'Failed to create reel', error: insertError.message });
    }

    return res.status(201).json(reel);
  } catch (error) {
    console.error('uploadReel error:', error.message);
    return res.status(500).json({ message: 'Server error uploading reel' });
  }
};

// ── GET /api/reels/feed ───────────────────────────────────────────────────────
export const getReelsFeed = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: reels, error } = await supabaseAdmin
      .from('reels')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      return res.status(500).json({ message: 'Failed to fetch reels', error: error.message });
    }

    // Check which reels the user has liked
    const reelIds = (reels || []).map((r) => r.id);
    let likedReelIds = new Set();

    if (reelIds.length > 0) {
      const { data: likes } = await supabaseAdmin
        .from('reel_likes')
        .select('reel_id')
        .eq('user_id', userId)
        .in('reel_id', reelIds);

      likedReelIds = new Set((likes || []).map((l) => l.reel_id));
    }

    const enrichedReels = (reels || []).map((reel) => ({
      ...reel,
      is_liked: likedReelIds.has(reel.id),
    }));

    return res.status(200).json(enrichedReels);
  } catch (error) {
    console.error('getReelsFeed error:', error.message);
    return res.status(500).json({ message: 'Server error fetching reels' });
  }
};

// ── PUT /api/reels/:id/like ───────────────────────────────────────────────────
export const toggleReelLike = async (req, res) => {
  try {
    const reelId = req.params.id;
    const userId = req.user.id;

    const { data: existing } = await supabaseAdmin
      .from('reel_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('reel_id', reelId)
      .maybeSingle();

    const { data: reelData } = await supabaseAdmin
      .from('reels')
      .select('likes_count')
      .eq('id', reelId)
      .single();

    const currentLikes = reelData?.likes_count || 0;

    if (existing) {
      await supabaseAdmin.from('reel_likes').delete().eq('user_id', userId).eq('reel_id', reelId);
      const newCount = Math.max(0, currentLikes - 1);
      await supabaseAdmin.from('reels').update({ likes_count: newCount }).eq('id', reelId);
      return res.status(200).json({ liked: false, likes: newCount });
    } else {
      await supabaseAdmin.from('reel_likes').insert({ user_id: userId, reel_id: reelId });
      const newCount = currentLikes + 1;
      await supabaseAdmin.from('reels').update({ likes_count: newCount }).eq('id', reelId);
      return res.status(200).json({ liked: true, likes: newCount });
    }
  } catch (error) {
    console.error('toggleReelLike error:', error.message);
    return res.status(500).json({ message: 'Server error toggling reel like' });
  }
};

// ── PUT /api/reels/:id/view ───────────────────────────────────────────────────
export const incrementView = async (req, res) => {
  try {
    const reelId = req.params.id;

    const { data: reelData } = await supabaseAdmin
      .from('reels')
      .select('views_count')
      .eq('id', reelId)
      .single();

    await supabaseAdmin
      .from('reels')
      .update({ views_count: (reelData?.views_count || 0) + 1 })
      .eq('id', reelId);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('incrementView error:', error.message);
    return res.status(500).json({ message: 'Server error incrementing view' });
  }
};
