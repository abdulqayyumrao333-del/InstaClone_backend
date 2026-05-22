import { supabaseAdmin } from '../config/supabase.js';

// ── GET /api/users/:username ──────────────────────────────────────────────────
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

    return res.status(200).json(profile);
  } catch (error) {
    console.error('getProfile error:', error.message);
    return res.status(500).json({ message: 'Server error fetching profile' });
  }
};

// ── PUT /api/users/profile ────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, bio, username } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (bio !== undefined) updates.bio = bio;
    if (username !== undefined) updates.username = username;

    // Upload avatar if file was provided
    if (req.file) {
      const fileBuffer = req.file.buffer;
      const filePath = `${userId}/avatar.jpg`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('avatars')
        .upload(filePath, fileBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        return res.status(500).json({ message: 'Failed to upload avatar', error: uploadError.message });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('avatars')
        .getPublicUrl(filePath);

      updates.avatar_url = urlData.publicUrl;
    }

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }

    return res.status(200).json(updatedProfile);
  } catch (error) {
    console.error('updateProfile error:', error.message);
    return res.status(500).json({ message: 'Server error updating profile' });
  }
};

// ── PUT /api/users/:id/follow ─────────────────────────────────────────────────
export const toggleFollow = async (req, res) => {
  try {
    const followingId = req.params.id;
    const followerId = req.user.id;

    if (followerId === followingId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    // Check if follow relationship already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (checkError) {
      return res.status(500).json({ message: 'Error checking follow status' });
    }

    if (existing) {
      // ── Unfollow ──
      await supabaseAdmin
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      // Decrement following_count for the follower
      await supabaseAdmin.rpc('decrement_count', {
        table_name: 'profiles',
        column_name: 'following_count',
        row_id: followerId,
      }).catch(() => {
        // Fallback manual decrement
        supabaseAdmin.from('profiles')
          .select('following_count').eq('id', followerId).single()
          .then(({ data }) => {
            supabaseAdmin.from('profiles')
              .update({ following_count: Math.max(0, (data?.following_count || 1) - 1) })
              .eq('id', followerId);
          });
      });

      // Decrement followers_count for the target
      await supabaseAdmin.from('profiles')
        .select('followers_count').eq('id', followingId).single()
        .then(({ data }) => {
          supabaseAdmin.from('profiles')
            .update({ followers_count: Math.max(0, (data?.followers_count || 1) - 1) })
            .eq('id', followingId);
        });

      // Fetch updated follower count
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('followers_count')
        .eq('id', followingId)
        .single();

      return res.status(200).json({ following: false, followersCount: targetProfile?.followers_count || 0 });
    } else {
      // ── Follow ──
      await supabaseAdmin.from('follows').insert({
        follower_id: followerId,
        following_id: followingId,
      });

      // Increment following_count for follower
      await supabaseAdmin.from('profiles')
        .select('following_count').eq('id', followerId).single()
        .then(({ data }) => {
          supabaseAdmin.from('profiles')
            .update({ following_count: (data?.following_count || 0) + 1 })
            .eq('id', followerId);
        });

      // Increment followers_count for target
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('followers_count')
        .eq('id', followingId)
        .single();

      const newCount = (targetProfile?.followers_count || 0) + 1;

      await supabaseAdmin.from('profiles')
        .update({ followers_count: newCount })
        .eq('id', followingId);

      return res.status(200).json({ following: true, followersCount: newCount });
    }
  } catch (error) {
    console.error('toggleFollow error:', error.message);
    return res.status(500).json({ message: 'Server error toggling follow' });
  }
};

// ── GET /api/users/search?q=username ─────────────────────────────────────────
export const searchUsers = async (req, res) => {
  try {
    const query = req.query.q || '';

    if (!query) {
      return res.status(200).json([]);
    }

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, avatar_url, followers_count')
      .ilike('username', `%${query}%`)
      .limit(20);

    if (error) {
      return res.status(500).json({ message: 'Error searching users', error: error.message });
    }

    return res.status(200).json(users || []);
  } catch (error) {
    console.error('searchUsers error:', error.message);
    return res.status(500).json({ message: 'Server error searching users' });
  }
};
