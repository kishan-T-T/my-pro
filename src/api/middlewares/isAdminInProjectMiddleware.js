import { Member } from '../../models/Member.js';
import { AppError } from '../../utils/AppError.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const isAdminInProject = catchAsync(async (req, res, next) => {
  const projectId = req.params.projectId || req.params.id;
  const isAdmin = await Member.findOne({
    user: req.user.userId,
    project: projectId,
    access: 'admin',
  });
  if (!isAdmin) {
    req.user.isAdmin = false;
    return next(
      new AppError('You need to be admin inorder to perform this action.', 403)
    );
  }
  req.user.isAdmin = true;
  req.user.memberId = isAdmin._id;
  return next();
});
