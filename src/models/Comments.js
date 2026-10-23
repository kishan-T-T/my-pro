import { getSupabase } from '../loaders/initDB.js';
import { AppError } from '../utils/AppError.js';
import {
  createChainableQuery,
  handleSupabaseError,
} from '../utils/supabaseHelpers.js';

export const formatComment = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    project: row.project_id,
    user: row.user_id,
    task: row.task_id,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const Comment = {
  find(filter = {}) {
    return createChainableQuery(async () => {
      const supabase = getSupabase();
      let query = supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true });
      if (filter.project !== undefined) {
        query = query.eq('project_id', String(filter.project));
      }
      if (filter.task !== undefined) {
        query = query.eq('task_id', String(filter.task));
      }
      if (filter.user !== undefined) {
        query = query.eq('user_id', String(filter.user));
      }
      const { data, error } = await query;
      if (error) handleSupabaseError(error);
      return (data || []).map(formatComment);
    });
  },

  async create({ id, _id, project, user, task, comment }) {
    if (!project || !user || !task || !comment) {
      const err = new AppError('Invalid comment data.', 400);
      err.name = 'ValidationError';
      err.errors = {
        comment: { message: 'project, user, task, and comment are required' },
      };
      throw err;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('comments')
      .insert({
        ...(id || _id ? { id: id || _id } : {}),
        project_id: String(project),
        user_id: String(user),
        task_id: String(task),
        comment,
      })
      .select('*')
      .single();

    if (error) handleSupabaseError(error);
    return formatComment(data);
  },

  async deleteMany(filter = {}) {
    const supabase = getSupabase();
    let query = supabase.from('comments').delete();
    if (filter.project !== undefined) {
      query = query.eq('project_id', String(filter.project));
    }
    if (filter.task !== undefined) {
      query = query.eq('task_id', String(filter.task));
    }
    const { error } = await query;
    if (error) handleSupabaseError(error);
  },
};
