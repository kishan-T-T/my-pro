import { AppError } from '../../utils/AppError.js';

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const raw = err.errmsg || err.message || '';
  const match = raw.match(/(["'])(?:(?=(\\?))\2.)*?\1/);
  const value = match ? match[0] : 'field';
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors || {}).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid Token, Please Login Again', 401);

const handleTokenExpiredError = () =>
  new AppError('Your Token has expired, Please Login Again', 401);

const sendErrorDev = (err, req, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, req, res) => {
  // 1. Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  // 2. Log unexpected error and send generic message
  console.error('Error', err);
  return res.status(500).json({
    status: 'error',
    message: 'Something went very wrong',
  });
};

export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = {
      ...err,
      name: err.name,
      message: err.message,
      code: err.code,
      errmsg: err.errmsg,
      errors: err.errors,
      statusCode: err.statusCode,
      status: err.status,
      isOperational: err.isOperational,
    };

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000 || error.code === '23505')
      error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError' || error.name === 'UnauthorizedError')
      error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleTokenExpiredError();

    sendErrorProd(error, req, res);
  }
};
