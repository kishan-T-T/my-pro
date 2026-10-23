import { getSupabase } from '../loaders/initDB.js';
import {
  createChainableQuery,
  handleSupabaseError,
  populateByPath,
} from '../utils/supabaseHelpers.js';

export const formatUser = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    username: row.username ?? undefined,
    email: row.email,
    email_verified: row.email_verified ?? false,
    photo: row.photo ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const User = {
  findById(id) {
    return createChainableQuery(async () => {
      if (!id) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) handleSupabaseError(error);
      return formatUser(data);
    });
  },

  async findByIdAndUpdate(id, updateData) {
    if (!id) return null;
    const supabase = getSupabase();
    const payload = { updated_at: new Date().toISOString() };
    if (updateData.username !== undefined) payload.username = updateData.username;
    if (updateData.firstName !== undefined) payload.first_name = updateData.firstName;
    if (updateData.lastName !== undefined) payload.last_name = updateData.lastName;
    if (updateData.photo !== undefined) payload.photo = updateData.photo;
    if (updateData.email !== undefined) payload.email = updateData.email;

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) handleSupabaseError(error);
    return formatUser(data);
  },

  async countDocuments(filter = {}) {
    const supabase = getSupabase();
    let query = supabase.from('users').select('id', { count: 'exact', head: true });

    const keyword =
      filter.keyword ||
      filter?.$or?.[0]?.email?.$regex ||
      filter?.$or?.[1]?.username?.$regex;

    if (keyword) {
      query = query.or(`email.ilike.%${keyword}%,username.ilike.%${keyword}%`);
    }

    const { count, error } = await query;
    if (error) handleSupabaseError(error);
    return count || 0;
  },

  find(filter = {}) {
    return createChainableQuery(async () => {
      const supabase = getSupabase();
      let query = supabase.from('users').select('*');

      const keyword =
        filter.keyword ||
        filter?.$or?.[0]?.email?.$regex ||
        filter?.$or?.[1]?.username?.$regex;

      if (keyword) {
        query = query.or(`email.ilike.%${keyword}%,username.ilike.%${keyword}%`);
      }

      const { data, error } = await query;
      if (error) handleSupabaseError(error);
      return (data || []).map(formatUser);
    });
  },

  async create(userData) {
    const supabase = getSupabase();
    const payload = {
      ...(userData.id || userData._id ? { id: userData.id || userData._id } : {}),
      first_name: userData.firstName ?? null,
      last_name: userData.lastName ?? null,
      username: userData.username ?? null,
      email: userData.email,
      password: userData.password ?? null,
      email_verified: userData.email_verified ?? false,
      photo: userData.photo ?? null,
    };

    const { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select('*')
      .single();

    if (error) handleSupabaseError(error);
    return formatUser(data);
  },

  async ensureExists({ id, email, firstName, lastName, username, photo, email_verified }) {
    if (!id) return null;
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existing) return formatUser(existing);
    if (!email) return null;

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          id,
          email,
          first_name: firstName ?? null,
          last_name: lastName ?? null,
          username: username ?? null,
          photo: photo ?? null,
          email_verified: Boolean(email_verified),
        },
        { onConflict: 'id' }
      )
      .select('*')
      .maybeSingle();

    if (error) return null;
    return formatUser(data);
  },

  async populate(docs, optionsOrPath) {
    return populateByPath(docs, optionsOrPath, async (ids) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('id', ids);
      if (error) handleSupabaseError(error);
      const map = new Map();
      (data || []).forEach((row) => {
        map.set(row.id, formatUser(row));
      });
      return map;
    });
  },
};
