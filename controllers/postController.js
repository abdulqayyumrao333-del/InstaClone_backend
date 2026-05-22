import { supabaseAdmin } from '../config/supabase.js';

// ── POST /api/posts ───────────────────────────────────────────────────────────
export const createPost = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const userId = req.user.id;
    const caption = req.body.caption || '';
    const fileBuffer = req.file.buffer;
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;

    // Upload image to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('posts')
      .upload(filePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ message: 'Failed to upload image', error: uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('posts').getPublicUrl(filePath);
    const imageUrl = urlData.publicUrl;

    // Insert post record
    const { data: post, error: insertError } = await supabaseAdmin
      .from('posts')
      .insert({ user_id: userId, image_url: imageUrl, caption })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ message: 'Failed to create post', error: insertError.message });
    }

    // Increment posts_count in profiles
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('posts_count')
      .eq('id', userId)
      .single();

    await supabaseAdmin
      .from('profiles')
      .update({ posts_count: (profileData?.posts_count || 0) + 1 })
      .eq('id', userId);

    return res.status(201).json(post);
  } catch (error) {
    console.error('createPost error:', error.message);
    return res.status(500).json({ message: 'Server error creating post' });
  }
};

// ── GET /api/posts/feed ───────────────────────────────────────────────────────
export const getFeed = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get IDs of users this user follows
    const { data: follows } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = (follows || []).map((f) => f.following_id);
    const feedUserIds = [...followingIds, userId]; // include own posts

    // Fetch posts with profile info
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .in('user_id', feedUserIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({ message: 'Failed to fetch feed', error: error.message });
    }

    // Check which posts the logged-in user has liked
    const postIds = (posts || []).map((p) => p.id);
    let likedPostIds = new Set();

    if (postIds.length > 0) {
      const { data: likes } = await supabaseAdmin
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      likedPostIds = new Set((likes || []).map((l) => l.post_id));
    }

    const enrichedPosts = (posts || []).map((post) => ({
      ...post,
      is_liked: likedPostIds.has(post.id),
    }));

    return res.status(200).json(enrichedPosts);
  } catch (error) {
    console.error('getFeed error:', error.message);
    return res.status(500).json({ message: 'Server error fetching feed' });
  }
};

// ── GET /api/posts/user/:userId ───────────────────────────────────────────────
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: 'Failed to fetch user posts', error: error.message });
    }

    return res.status(200).json(posts || []);
  } catch (error) {
    console.error('getUserPosts error:', error.message);
    return res.status(500).json({ message: 'Server error fetching user posts' });
  }
};

// ── PUT /api/posts/:id/like ───────────────────────────────────────────────────
export const toggleLike = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    // Check if like exists
    const { data: existing } = await supabaseAdmin
      .from('post_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();

    const { data: postData } = await supabaseAdmin
      .from('posts')
      .select('likes_count')
      .eq('id', postId)
      .single();

    const currentLikes = postData?.likes_count || 0;

    if (existing) {
      // Unlike
      await supabaseAdmin.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId);
      const newCount = Math.max(0, currentLikes - 1);
      await supabaseAdmin.from('posts').update({ likes_count: newCount }).eq('id', postId);
      return res.status(200).json({ liked: false, likes: newCount });
    } else {
      // Like
      await supabaseAdmin.from('post_likes').insert({ user_id: userId, post_id: postId });
      const newCount = currentLikes + 1;
      await supabaseAdmin.from('posts').update({ likes_count: newCount }).eq('id', postId);
      return res.status(200).json({ liked: true, likes: newCount });
    }
  } catch (error) {
    console.error('toggleLike error:', error.message);
    return res.status(500).json({ message: 'Server error toggling like' });
  }
};

// ── POST /api/posts/:id/comment ───────────────────────────────────────────────
export const addComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    // Insert comment
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('comments')
      .insert({ user_id: userId, post_id: postId, text: text.trim() })
      .select()
      .single();

    if (commentError) {
      return res.status(500).json({ message: 'Failed to add comment', error: commentError.message });
    }

    // Increment comments_count
    const { data: postData } = await supabaseAdmin
      .from('posts')
      .select('comments_count')
      .eq('id', postId)
      .single();

    await supabaseAdmin
      .from('posts')
      .update({ comments_count: (postData?.comments_count || 0) + 1 })
      .eq('id', postId);

    // Return comment with user profile info
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', userId)
      .single();

    return res.status(201).json({ ...comment, profiles: profile });
  } catch (error) {
    console.error('addComment error:', error.message);
    return res.status(500).json({ message: 'Server error adding comment' });
  }
};

// ── GET /api/posts/:id/comments ───────────────────────────────────────────────
export const getComments = async (req, res) => {
  try {
    const postId = req.params.id;

    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ message: 'Failed to fetch comments', error: error.message });
    }

    return res.status(200).json(comments || []);
  } catch (error) {
    console.error('getComments error:', error.message);
    return res.status(500).json({ message: 'Server error fetching comments' });
  }
};
