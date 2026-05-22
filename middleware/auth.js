import { supabaseAdmin } from '../config/supabase.js';

/**
 * Protect middleware — verifies Supabase JWT and attaches user + profile to req.
 */
export const protect = async (req, res, next) => {
  try {
    // 1. Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token with Supabase
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !userData?.user) {
      return res.status(401).json({ message: 'Token invalid or expired' });
    }

    // 3. Attach user to request
    req.user = userData.user;

    // 4. Fetch the user's profile from the profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError.message);
      // Don't block the request if profile fetch fails — profile may not exist yet
      req.profile = null;
    } else {
      req.profile = profile;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};
