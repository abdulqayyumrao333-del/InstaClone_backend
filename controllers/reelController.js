import { supabaseAdmin } from '../config/supabase.js';

// ─── Upload Reel ──────────────────────────────────────────────────────────────
export const uploadReel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    const userId   = req.user.id;
    const caption  = req.body.caption || '';
    const buffer   = req.file.buffer;
    const fileName = `${userId}/${Date.now()}.mp4`;

    // Supabase Storage mein upload karo
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('reels')
      .upload(fileName, buffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ message: 'Video upload failed', error: uploadError.message });
    }

    // Public URL lo
    const { data: urlData } = supabaseAdmin
      .storage
      .from('reels')
      .getPublicUrl(fileName);

    const videoUrl = urlData.publicUrl;

    // Database mein save karo
    const { data: reel, error: dbError } = await supabaseAdmin
      .from('reels')
      .insert({
        user_id:    userId,
        video_url:  videoUrl,
        caption:    caption,
        likes_count: 0,
        views_count: 0,
      })
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError);
      return res.status(500).json({ message: 'Could not save reel', error: dbError.message });
    }

    res.status(201).json({ message: 'Reel uploaded successfully', reel });

  } catch (err) {
    console.error('uploadReel error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Get Reels Feed ───────────────────────────────────────────────────────────
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
          avatar_url,
          full_name
        ),
        reel_likes!left (
          user_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    // Har reel pe is_liked field add karo
    const reelsWithLikes = reels.map(reel => ({
      ...reel,
      user: reel.profiles,
      is_liked: reel.reel_likes?.some(like => like.user_id === userId) || false,
    }));

    res.json(reelsWithLikes);

  } catch (err) {
    console.error('getReelsFeed error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Toggle Reel Like ─────────────────────────────────────────────────────────
export const toggleReelLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.id;

    // Like exist karta hai check karo
    const { data: existing } = await supabaseAdmin
      .from('reel_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('reel_id', reelId)
      .single();

    if (existing) {
      // Unlike karo
      await supabaseAdmin
        .from('reel_likes')
        .delete()
        .eq('user_id', userId)
        .eq('reel_id', reelId);

      await supabaseAdmin
        .from('reels')
        .update({ likes_count: supabaseAdmin.rpc('decrement', { x: 1 }) })
        .eq('id', reelId);

      const { data: reel } = await supabaseAdmin
        .from('reels')
        .select('likes_count')
        .eq('id', reelId)
        .single();

      return res.json({ liked: false, likes: reel?.likes_count || 0 });

    } else {
      // Like karo
      await supabaseAdmin
        .from('reel_likes')
        .insert({ user_id: userId, reel_id: reelId });

      await supabaseAdmin.rpc('increment_reel_likes', { reel_id: reelId });

      const { data: reel } = await supabaseAdmin
        .from('reels')
        .select('likes_count')
        .eq('id', reelId)
        .single();

      return res.json({ liked: true, likes: reel?.likes_count || 0 });
    }

  } catch (err) {
    console.error('toggleReelLike error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Increment View ───────────────────────────────────────────────────────────
export const incrementView = async (req, res) => {
  try {
    const reelId = req.params.id;

    const { data: reel } = await supabaseAdmin
      .from('reels')
      .select('views_count')
      .eq('id', reelId)
      .single();

    await supabaseAdmin
      .from('reels')
      .update({ views_count: (reel?.views_count || 0) + 1 })
      .eq('id', reelId);

    res.json({ success: true });

  } catch (err) {
    console.error('incrementView error:', err);
    res.status(500).json({ message: err.message });
  }
};