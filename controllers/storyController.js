import { supabaseAdmin } from '../config/supabase.js';

// ── POST /api/stories ─────────────────────────────────────────────────────────
export const uploadStory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const userId = req.user.id;
    const fileBuffer = req.file.buffer;
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('stories')
      .upload(filePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ message: 'Failed to upload story', error: uploadError.message });
    }

    const { data: urlData } = supabaseAdmin.storage.from('stories').getPublicUrl(filePath);

    // Set expiry to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: story, error: insertError } = await supabaseAdmin
      .from('stories')
      .insert({
        user_id: userId,
        media_url: urlData.publicUrl,
        media_type: 'image',
        viewers: [],
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ message: 'Failed to create story', error: insertError.message });
    }

    return res.status(201).json(story);
  } catch (error) {
    console.error('uploadStory error:', error.message);
    return res.status(500).json({ message: 'Server error uploading story' });
  }
};

// ── GET /api/stories/feed ─────────────────────────────────────────────────────
export const getStoriesFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();

    // Get following IDs
    const { data: follows } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = (follows || []).map((f) => f.following_id);
    const feedUserIds = [...followingIds, userId];

    // Fetch active (non-expired) stories
    const { data: stories, error } = await supabaseAdmin
      .from('stories')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .in('user_id', feedUserIds)
      .gt('expires_at', now)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ message: 'Failed to fetch stories', error: error.message });
    }

    // Group stories by user
    const grouped = {};
    for (const story of stories || []) {
      const uid = story.user_id;
      if (!grouped[uid]) {
        grouped[uid] = {
          user: story.profiles,
          stories: [],
        };
      }
      grouped[uid].stories.push(story);
    }

    return res.status(200).json(Object.values(grouped));
  } catch (error) {
    console.error('getStoriesFeed error:', error.message);
    return res.status(500).json({ message: 'Server error fetching stories' });
  }
};

// ── PUT /api/stories/:id/view ─────────────────────────────────────────────────
export const viewStory = async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user.id;

    // Fetch current viewers
    const { data: story, error: fetchError } = await supabaseAdmin
      .from('stories')
      .select('viewers')
      .eq('id', storyId)
      .single();

    if (fetchError || !story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    const currentViewers = story.viewers || [];

    // Add userId only if not already in array
    if (!currentViewers.includes(userId)) {
      const updatedViewers = [...currentViewers, userId];

      await supabaseAdmin
        .from('stories')
        .update({ viewers: updatedViewers })
        .eq('id', storyId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('viewStory error:', error.message);
    return res.status(500).json({ message: 'Server error viewing story' });
  }
};

// ── DELETE /api/stories/expired (admin utility) ───────────────────────────────
export const deleteExpiredStories = async (req, res) => {
  try {
    const now = new Date().toISOString();

    const { data: deleted, error } = await supabaseAdmin
      .from('stories')
      .delete()
      .lt('expires_at', now)
      .select();

    if (error) {
      return res.status(500).json({ message: 'Failed to delete expired stories', error: error.message });
    }

    return res.status(200).json({ deletedCount: (deleted || []).length });
  } catch (error) {
    console.error('deleteExpiredStories error:', error.message);
    return res.status(500).json({ message: 'Server error deleting expired stories' });
  }
};
