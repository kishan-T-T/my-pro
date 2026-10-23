import { Router } from 'express';
import {
  createProject,
  deleteProject,
  getAllProjects,
  getProjectById,
  updateProject,
} from '../controllers/projectController.js';

import { checkJwt } from '../middlewares/authMiddleware.js';
import { authorizeMiddleware } from '../middlewares/authorizeMiddleware.js';
import { accessToProjectMiddleware } from '../middlewares/accessToProjectMiddleware.js';
import { isAdminInProject } from '../middlewares/isAdminInProjectMiddleware.js';

import { memberRouter } from './memberRoutes.js';
import { taskRouter } from './tasksRoutes.js';

export const projectRouter = Router();
projectRouter.use(checkJwt);
projectRouter.use(authorizeMiddleware);
projectRouter.use('/:projectId/tasks', taskRouter);
projectRouter.use('/:projectId/members', memberRouter);
projectRouter.route('/').get(getAllProjects).post(createProject);
projectRouter
  .route('/:id')
  .get(accessToProjectMiddleware, getProjectById)
  .patch(isAdminInProject, updateProject)
  .delete(isAdminInProject, deleteProject);
