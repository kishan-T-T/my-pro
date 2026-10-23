import { getSupabase } from '../loaders/initDB.js';
import { AppError } from '../utils/AppError.js';
import {
  createChainableQuery,
  handleSupabaseError,
  populateByPath,
} from '../utils/supabaseHelpers.js';

export const formatProject = (row) => {
  if (!row) return null;
  const formatted = {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description,
    admin: row.admin ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  Object.defineProperty(formatted, 'remove', {
    enumerable: false,
    value: async () => Project.findByIdAndDelete(row.id),
  });
  return formatted;
};

export const Project = {
  findById(id) {
    return createChainableQuery(async () => {
      if (!id) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) handleSupabaseError(error);
      return formatProject(data);
    });
  },

  async create({ id, _id, title, description, admin }) {
    if (!title || !description) {
      const err = new AppError(
        'Invalid input data. Project title and description are required.',
        400
      );
      err.name = 'ValidationError';
      err.errors = {
        ...(!title ? { title: { message: 'Title is required' } } : {}),
        ...(!description
          ? { description: { message: 'Description is required' } }
          : {}),
      };
      throw err;
    }

    const supabase = getSupabase();
    const payload = {
      ...(id || _id ? { id: id || _id } : {}),
      title,
      description,
      admin: admin ?? null,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select('*')
      .single();

    if (error) handleSupabaseError(error);
    return formatProject(data);
  },

  async findByIdAndUpdate(id, updateData, options = {}) {
    if (!id) return null;
    if (options.runValidators) {
      if (updateData.title === '' || updateData.description === '') {
        const err = new AppError(
          'Invalid input data. Title and description cannot be empty.',
          400
        );
        err.name = 'ValidationError';
        err.errors = {
          project: { message: 'Title and description cannot be empty' },
        };
        throw err;
      }
    }

    const supabase = getSupabase();
    const payload = { updated_at: new Date().toISOString() };
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.description !== undefined)
      payload.description = updateData.description;

    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) handleSupabaseError(error);
    return formatProject(data);
  },

  async findByIdAndDelete(id) {
    if (!id) return null;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) handleSupabaseError(error);
    return formatProject(data);
  },

  async populate(docs, optionsOrPath) {
    return populateByPath(docs, optionsOrPath, async (ids) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('id', ids);
      if (error) handleSupabaseError(error);
      const map = new Map();
      (data || []).forEach((row) => {
        map.set(row.id, formatProject(row));
      });
      return map;
    });
  },
};
