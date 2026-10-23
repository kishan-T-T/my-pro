import { getSupabase } from '../loaders/initDB.js';
import { AppError } from '../utils/AppError.js';
import {
  createChainableQuery,
  handleSupabaseError,
} from '../utils/supabaseHelpers.js';
import { Member } from './Member.js';
import { Project } from './Project.js';
import { User } from './User.js';

const VALID_LABELS = ['Bug', 'Feature', 'Improvement', 'No Label'];
const VALID_PRIORITIES = ['no_priority', 'low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'done', 'cancelled'];

const validateTaskFields = (data, isPartial = false) => {
  const errors = {};
  if (!isPartial) {
    if (!data.title) errors.title = { message: 'Task title is required' };
    if (!data.project) errors.project = { message: 'Task project is required' };
    if (!data.author) errors.author = { message: 'Task author is required' };
    if (data.order === undefined || data.order === null) {
      errors.order = { message: 'Task order is required' };
    }
  } else if (data.title === '') {
    errors.title = { message: 'Task title cannot be empty' };
  }

  if (data.label !== undefined && !VALID_LABELS.includes(data.label)) {
    errors.label = { message: `Invalid label: ${data.label}` };
  }
  if (data.priority !== undefined && !VALID_PRIORITIES.includes(data.priority)) {
    errors.priority = { message: `Invalid priority: ${data.priority}` };
  }
  if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
    errors.status = { message: `Invalid status: ${data.status}` };
  }

  if (Object.keys(errors).length > 0) {
    const messages = Object.values(errors)
      .map((e) => e.message)
      .join('. ');
    const err = new AppError(`Invalid input data. ${messages}`, 400);
    err.name = 'ValidationError';
    err.errors = errors;
    throw err;
  }
};

export const formatTask = (row) => {
  if (!row) return null;
  const taskObj = {
    _id: row.id,
    id: row.id,
    order: row.order_index,
    project: row.project_id,
    author: row.author_id,
    title: row.title,
    description: row.description ?? 'No Description',
    label: row.label ?? 'No Label',
    priority: row.priority ?? 'no_priority',
    status: row.status ?? 'backlog',
    assignee: row.assignee_id ?? undefined,
    startDate: row.start_date,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  Object.defineProperty(taskObj, 'save', {
    enumerable: false,
    value: async () => {
      const supabase = getSupabase();
      const payload = {
        order_index: taskObj.order,
        title: taskObj.title,
        description: taskObj.description,
        label: taskObj.label,
        priority: taskObj.priority,
        status: taskObj.status,
        assignee_id:
          taskObj.assignee && typeof taskObj.assignee === 'object'
            ? taskObj.assignee._id || taskObj.assignee.id
            : taskObj.assignee ?? null,
        start_date: taskObj.startDate,
        due_date: taskObj.dueDate ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', taskObj.id)
        .select('*')
        .single();
      if (error) handleSupabaseError(error);
      taskObj.updatedAt = data.updated_at;
      return taskObj;
    },
  });

  Object.defineProperty(taskObj, 'remove', {
    enumerable: false,
    value: async () => Task.findByIdAndDelete(taskObj.id),
  });

  return taskObj;
};

export const Task = {
  find(filter = {}) {
    return createChainableQuery(async (state) => {
      const supabase = getSupabase();
      let query = supabase.from('tasks').select('*');
      if (filter.project !== undefined) {
        query = query.eq('project_id', String(filter.project));
      }
      if (filter.status !== undefined) {
        query = query.eq('status', filter.status);
      }

      if (state.sortSpec) {
        const sortStr =
          typeof state.sortSpec === 'string' ? state.sortSpec : 'order';
        const descending = sortStr.startsWith('-');
        const field = sortStr.replace(/^-/, '');
        const col = field === 'order' ? 'order_index' : field;
        query = query.order(col, { ascending: !descending });
      } else {
        query = query.order('order_index', { ascending: true });
      }

      const { data, error } = await query;
      if (error) handleSupabaseError(error);
      return (data || []).map(formatTask);
    });
  },

  findById(id) {
    return createChainableQuery(async (state) => {
      if (!id) return null;
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) handleSupabaseError(error);
      const task = formatTask(data);
      if (!task) return null;

      if (state.populateSpecs.length > 0) {
        for (const spec of state.populateSpecs) {
          const pathStr = typeof spec === 'string' ? spec : spec?.path || '';
          if (pathStr.includes('project')) {
            await Project.populate(task, 'project');
          }
          if (pathStr.includes('author')) {
            await Member.populate(task, 'author');
            await User.populate(task, 'author.user');
          }
          if (pathStr.includes('assignee')) {
            await Member.populate(task, 'assignee');
            await User.populate(task, 'assignee.user');
          }
        }
      }

      return task;
    });
  },

  async create(taskData) {
    const normalized = {
      ...taskData,
      description: taskData.description ?? 'No Description',
      label: taskData.label ?? 'No Label',
      priority: taskData.priority ?? 'no_priority',
      status: taskData.status ?? 'backlog',
    };
    validateTaskFields(normalized, false);

    const supabase = getSupabase();
    const payload = {
      ...(normalized.id || normalized._id
        ? { id: normalized.id || normalized._id }
        : {}),
      order_index: normalized.order,
      project_id: String(normalized.project),
      author_id: String(normalized.author),
      title: normalized.title,
      description: normalized.description,
      label: normalized.label,
      priority: normalized.priority,
      status: normalized.status,
      assignee_id: normalized.assignee ? String(normalized.assignee) : null,
      start_date: normalized.startDate
        ? new Date(normalized.startDate).toISOString()
        : new Date().toISOString(),
      due_date: normalized.dueDate
        ? new Date(normalized.dueDate).toISOString()
        : null,
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('*')
      .single();

    if (error) handleSupabaseError(error);
    return formatTask(data);
  },

  async findByIdAndUpdate(id, updateData, options = {}) {
    if (!id) return null;
    if (options.runValidators) {
      validateTaskFields(updateData, true);
    }

    const supabase = getSupabase();
    const payload = { updated_at: new Date().toISOString() };
    if (updateData.order !== undefined) payload.order_index = updateData.order;
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.description !== undefined)
      payload.description = updateData.description;
    if (updateData.label !== undefined) payload.label = updateData.label;
    if (updateData.priority !== undefined) payload.priority = updateData.priority;
    if (updateData.status !== undefined) payload.status = updateData.status;
    if (updateData.assignee !== undefined) {
      payload.assignee_id = updateData.assignee
        ? String(updateData.assignee)
        : null;
    }
    if (updateData.startDate !== undefined) {
      payload.start_date = updateData.startDate
        ? new Date(updateData.startDate).toISOString()
        : null;
    }
    if (updateData.dueDate !== undefined) {
      payload.due_date = updateData.dueDate
        ? new Date(updateData.dueDate).toISOString()
        : null;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) handleSupabaseError(error);
    return formatTask(data);
  },

  async findByIdAndDelete(id) {
    if (!id) return null;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) handleSupabaseError(error);
    return formatTask(data);
  },

  async deleteMany(filter = {}) {
    const supabase = getSupabase();
    let query = supabase.from('tasks').delete();
    if (filter.project !== undefined) {
      query = query.eq('project_id', String(filter.project));
    }
    if (filter.status !== undefined) {
      query = query.eq('status', filter.status);
    }
    const { error } = await query;
    if (error) handleSupabaseError(error);
  },

  async countDocuments(filter = {}) {
    const supabase = getSupabase();
    let query = supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true });
    if (filter.project !== undefined) {
      query = query.eq('project_id', String(filter.project));
    }
    if (filter.status !== undefined) {
      query = query.eq('status', filter.status);
    }
    const { count, error } = await query;
    if (error) handleSupabaseError(error);
    return count || 0;
  },

  async updateMany(filter = {}, update = {}) {
    const supabase = getSupabase();
    let query = supabase.from('tasks').select('id, order_index');

    if (filter.project !== undefined) {
      query = query.eq('project_id', String(filter.project));
    }
    if (filter.status !== undefined) {
      query = query.eq('status', filter.status);
    }
    if (filter._id?.$ne !== undefined) {
      query = query.neq('id', String(filter._id.$ne));
    }
    if (filter.order && typeof filter.order === 'object') {
      if (filter.order.$gt !== undefined)
        query = query.gt('order_index', filter.order.$gt);
      if (filter.order.$gte !== undefined)
        query = query.gte('order_index', filter.order.$gte);
      if (filter.order.$lt !== undefined)
        query = query.lt('order_index', filter.order.$lt);
      if (filter.order.$lte !== undefined)
        query = query.lte('order_index', filter.order.$lte);
    }

    const { data: rows, error } = await query;
    if (error) handleSupabaseError(error);
    if (!rows || !rows.length) return { modifiedCount: 0 };

    const incDelta = update?.$inc?.order ?? 0;
    if (incDelta !== 0) {
      await Promise.all(
        rows.map((row) =>
          supabase
            .from('tasks')
            .update({
              order_index: row.order_index + incDelta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
        )
      );
    }

    return { modifiedCount: rows.length };
  },
};
