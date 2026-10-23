import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { projectRouter, userRouter } from '../api/index.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { globalErrorHandler } from '../api/controllers/errorController.js';
import { historyRouter } from '../api/routes/historyRoutes.js';

export const initExpress = ({ app }) => {
  app.use(helmet());
  app.enable('trust proxy');

  if (process.env.NODE_ENV === 'production') {
    app.use(
      cors({
        origin: config.clientOriginUrl || 'https://projectboard.vercel.app',
      })
    );
  } else {
    app.use(cors());
  }

  // Development Logging
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // Middleware that transforms the raw string of req.body into json
  app.use(express.json());

  // Load API routes
  app.get('/', (req, res) => res.send('API is running'));
  app.use(`${config.api.prefix}/projects`, projectRouter);
  app.use(`${config.api.prefix}/users`, userRouter);
  app.use(`${config.api.prefix}/history`, historyRouter);

  // Catch-all for unmatched routes
  app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on the server!`, 404));
  });

  app.use(globalErrorHandler);
};
