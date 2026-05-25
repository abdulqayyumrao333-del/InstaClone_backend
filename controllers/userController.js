import { supabaseAdmin } from '../config/supabase.js';

// ─── Get Profile ──────────────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !profile) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(profile);

  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const userId   = req.user.id;
    const { username, full_name, bio } = req.body;

    const updates = {};
    if (username)  updates.username  = username.toLowerCase().trim();
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (bio !== undefined)       updates.bio       = bio.trim();

    // Avatar image upload
    if (req.file) {
      const fileName = `${userId}/avatar_${Date.now()}.jpg`;

      const { error: uploadError } = await supabaseAdmin
        .storage
        .from('avatars')
        .upload(fileName, req.file.buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        return res.status(500).json({ message: 'Avatar upload failed' });
      }

      const { data: urlData } = supabaseAdmin
        .storage
        .from('avatars')
        .getPublicUrl(fileName);

      updates.avatar_url = urlData.publicUrl;
    }

    // Username unique check
    if (updates.username) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', updates.username)
        .neq('id', userId)
        .single();

      if (existing) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.json({ message: 'Profile updated successfully', profile });

  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Toggle Follow ────────────────────────────────────────────────────────────
export const toggleFollow = async (req, res) => {
  try {
    const followerId  = req.user.id;
    const followingId = req.params.id;

    if (followerId === followingId) {
      return res.status(400).json({ message: "Can't follow yourself" });
    }

    const { data: existing } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    if (existing) {
      // Unfollow
      await supabaseAdmin
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      const { data: target } = await supabaseAdmin
        .from('profiles')
        .select('followers_count')
        .eq('id', followingId)
        .single();

      return res.json({
        following:      false,
        followersCount: Math.max((target?.followers_count || 1) - 1, 0),
      });

    } else {
      // Follow
      await supabaseAdmin
        .from('follows')
        .insert({ follower_id: followerId, following_id: followingId });

      const { data: target } = await supabaseAdmin
        .from('profiles')
        .select('followers_count')
        .eq('id', followingId)
        .single();

      return res.json({
        following:      true,
        followersCount: (target?.followers_count || 0) + 1,
      });
    }

  } catch (err) {
    console.error('toggleFollow error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Search Users ─────────────────────────────────────────────────────────────
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 1) {
      return res.json([]);
    }

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, avatar_url, followers_count')
      .ilike('username', `%${q}%`)
      .neq('id', req.user.id)
      .limit(20);

    if (error) return res.status(500).json({ message: error.message });

    res.json(users || []);

  } catch (err) {
    console.error('searchUsers error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Get Suggestions ──────────────────────────────────────────────────────────
export const getSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;

    // Jo log follow kar rahe hain unki list
    const { data: following } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = following?.map(f => f.following_id) || [];
    followingIds.push(userId);

    // Jo follow nahi kiye unhe suggest karo
    const { data: suggestions, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, avatar_url, followers_count')
      .not('id', 'in', `(${followingIds.join(',')})`)
      .order('followers_count', { ascending: false })
      .limit(10);

    if (error) return res.status(500).json({ message: error.message });

    res.json(suggestions || []);

  } catch (err) {
    console.error('getSuggestions error:', err);
    res.status(500).json({ message: err.message });
  }
};