import jwt from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { config } from '../../config/index.js';
import { getSupabase } from '../../loaders/initDB.js';
import { AppError } from '../../utils/AppError.js';

const auth0JwtMiddleware =
  config.domain && config.audience
    ? jwt({
        secret: jwksRsa.expressJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: `https://${config.domain}/.well-known/jwks.json`,
        }),
        audience: config.audience,
        issuer: `https://${config.domain}/`,
        algorithms: ['RS256'],
      })
    : null;

export const checkJwt = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authorization Token was not found!', 401));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('Authorization Token was not found!', 401));
    }

    // If Auth0 credentials are configured, validate via Auth0 JWKS
    if (auth0JwtMiddleware) {
      return auth0JwtMiddleware(req, res, next);
    }

    // Otherwise validate against Supabase Auth if auth.getUser is available
    const supabase = getSupabase();
    if (supabase?.auth?.getUser) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return next(new AppError('Invalid Token, Please Login Again', 401));
      }
      req.authUser = data.user;
    }

    return next();
  } catch (err) {
    return next(new AppError('Invalid Token, Please Login Again', 401));
  }
};
