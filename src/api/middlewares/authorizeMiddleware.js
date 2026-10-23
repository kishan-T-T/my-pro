import jwt_decode from 'jwt-decode';
import { AppError } from '../../utils/AppError.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { User } from '../../models/User.js';

export const authorizeMiddleware = catchAsync(async (req, res, next) => {
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith('Bearer')
  ) {
    return next(new AppError('Authorization Token was not found!', 401));
  }

  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
    return next(new AppError('Authorization Token was not found!', 401));
  }

  try {
    const decoded = jwt_decode(token);
    if (!decoded || typeof decoded !== 'object') {
      return next(new AppError('Authorization Error', 401));
    }

    req.user = { ...decoded };

    // Support both Auth0 format ("auth0|<id>") and Supabase Auth UUID ("<uuid>")
    let userId = req.authUser?.id || null;
    if (!userId && typeof decoded.sub === 'string') {
      userId = decoded.sub.includes('|')
        ? decoded.sub.split('|')[1]
        : decoded.sub;
    }
    if (!userId) {
      userId = decoded.userId || decoded.id;
    }

    if (!userId) {
      return next(new AppError('Authorization Error: Missing user ID', 401));
    }

    req.user.userId = userId;

    // Ensure authenticated user record exists in public.users if email is present in JWT/Auth
    const email = req.authUser?.email || decoded.email;
    const meta = req.authUser?.user_metadata || decoded.user_metadata || {};
    if (email) {
      await User.ensureExists({
        id: userId,
        email,
        firstName: meta.firstName || meta.first_name || decoded.given_name,
        lastName: meta.lastName || meta.last_name || decoded.family_name,
        username: meta.username || decoded.nickname,
        photo: meta.avatar_url || meta.photo || decoded.picture,
        email_verified: Boolean(
          req.authUser?.email_confirmed_at || decoded.email_verified
        ),
      });
    }

    return next();
  } catch (error) {
    return next(new AppError('Authorization Error', 401));
  }
});
