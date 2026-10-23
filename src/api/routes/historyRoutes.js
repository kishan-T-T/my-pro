import { Router } from 'express';
import {
  getProjectHistory,
  getTaskHistory,
} from '../controllers/historyController.js';

import { checkJwt } from '../middlewares/authMiddleware.js';
import { authorizeMiddleware } from '../middlewares/authorizeMiddleware.js';
import { accessToProjectMiddleware } from '../middlewares/accessToProjectMiddleware.js';

export const historyRouter = Router();
historyRouter.use(checkJwt);
historyRouter.use(authorizeMiddleware);
historyRouter
  .route('/projects/:projectId')
  .get(accessToProjectMiddleware, getProjectHistory);
historyRouter
  .route('/projects/:projectId/tasks/:taskId')
  .get(accessToProjectMiddleware, getTaskHistory);
