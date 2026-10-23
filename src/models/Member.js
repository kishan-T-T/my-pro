import { getSupabase } from '../loaders/initDB.js';
import { AppError } from '../utils/AppError.js';
import {
  createChainableQuery,
  handleSupabaseError,
  populateByPath,
} from '../utils/supabaseHelpers.js';

const VALID_ACCESS = ['admin', 'member'];

export const formatMember = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    project: row.project_id,
    user: row.user_id,
    access: row.access,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const Member = {
  find(filter = {}) {
    return createChainableQuery(async () => {
      const supabase = getSupabase();
      let query = supabase.from('members').select('*');
      if (filter.project !== undefined)
        query = query.eq('project_id', filter.project);
      if (filter.user !== undefined) query = query.eq('user_id', filter.user);
      if (filter.access !== undefined)
        query = query.eq('access', filter.access);

      const { data, error } = await query;
      if (error) handleSupabaseError(error);
      return (data || []).map(formatMember);
    });
  },

  findOne(filter = {}) {
    return createChainableQuery(async () => {
      const supabase = getSupabase();
      let query = supabase.from('members').select('*');
      if (filter.project !== undefined)
        query = query.eq('project_id', filter.project);
      if (filter.user !== undefined) query = query.eq('user_id', filter.user);
      if (filter.access !== undefined)
        query = query.eq('access', filter.access);

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) handleSupabaseError(error);
      return formatMember(data);
    });
  },

  findById(id) {
    return createChainableQuery(async () => {
      if (!id) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) handleSupabaseError(error);
      return formatMember(data);
    });
  },

  async countDocuments(filter = {}) {
    const supabase = getSupabase();
    let query = supabase
      .from('members')
      .select('id', { count: 'exact', head: true });
    if (filter.project !== undefined)
      query = query.eq('project_id', filter.project);
    if (filter.user !== undefined) query = query.eq('user_id', filter.user);
    if (filter.access !== undefined) query = query.eq('access', filter.access);

    const { count, error } = await query;
    if (error) handleSupabaseError(error);
    return count || 0;
  },

  async create({ id, _id, project, user, access = 'member' }) {
    if (!project || !user || !VALID_ACCESS.includes(access)) {
      const err = new AppError('Invalid member data.', 400);
      err.name = 'ValidationError';
      err.errors = { member: { message: 'Invalid project, user, or access role' } };
      throw err;
    }

    const supabase = getSupabase();
    const payload = {
      ...(id || _id ? { id: id || _id } : {}),
      project_id: String(project),
      user_id: String(user),
      access,
    };

    const { data, error } = await supabase
      .from('members')
      .insert(payload)
      .select('*')
      .single();

    if (error) handleSupabaseError(error);
    return formatMember(data);
  },

  async findByIdAndDelete(id) {
    if (!id) return null;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('members')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) handleSupabaseError(error);
    return formatMember(data);
  },

  async deleteMany(filter = {}) {
    const supabase = getSupabase();
    let query = supabase.from('members').delete();
    if (filter.project !== undefined)
      query = query.eq('project_id', String(filter.project));
    if (filter.user !== undefined)
      query = query.eq('user_id', String(filter.user));

    const { error } = await query;
    if (error) handleSupabaseError(error);
  },

  async populate(docs, optionsOrPath) {
    return populateByPath(docs, optionsOrPath, async (ids) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .in('id', ids);
      if (error) handleSupabaseError(error);
      const map = new Map();
      (data || []).forEach((row) => {
        map.set(row.id, formatMember(row));
      });
      return map;
    });
  },
};
