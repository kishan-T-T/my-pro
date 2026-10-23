import { getSupabase } from '../loaders/initDB.js';
import { AppError } from '../utils/AppError.js';
import {
  createChainableQuery,
  handleSupabaseError,
} from '../utils/supabaseHelpers.js';

const VALID_ACTIONS = [
  'create',
  'update',
  'delete',
  'change',
  'assign',
  'add-member',
  'remove-member',
];

export const formatHistory = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    task: row.task_id ?? undefined,
    project: row.project_id,
    user: row.user_id,
    action: row.action,
    extraDetails: row.extra_details
      ? JSON.parse(JSON.stringify(row.extra_details))
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const History = {
  find(filter = {}) {
    return createChainableQuery(async (state) => {
      const supabase = getSupabase();
      let query = supabase.from('history').select('*');

      if (filter.project !== undefined) {
        query = query.eq('project_id', String(filter.project));
      }
      if (filter.task !== undefined) {
        query = query.eq('task_id', String(filter.task));
      }

      const sortCreatedAtDesc =
        state.sortSpec?.createdAt === -1 || state.sortSpec === '-createdAt';
      query = query.order('created_at', { ascending: !sortCreatedAtDesc });

      const { data, error } = await query;
      if (error) handleSupabaseError(error);
      return (data || []).map(formatHistory);
    });
  },

  async create({ id, _id, task, project, user, action, extraDetails }) {
    if (!project || !user || !VALID_ACTIONS.includes(action)) {
      const err = new AppError('Invalid history entry data.', 400);
      err.name = 'ValidationError';
      err.errors = { history: { message: 'Invalid project, user, or action' } };
      throw err;
    }

    const supabase = getSupabase();
    const payload = {
      ...(id || _id ? { id: id || _id } : {}),
      task_id: task ? String(task) : null,
      project_id: String(project),
      user_id: String(user),
      action,
      extra_details: extraDetails ?? null,
    };

    const { data, error } = await supabase
      .from('history')
      .insert(payload)
      .select('*')
      .single();

    if (error) handleSupabaseError(error);
    return formatHistory(data);
  },

  async deleteMany(filter = {}) {
    const supabase = getSupabase();
    let query = supabase.from('history').delete();
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
