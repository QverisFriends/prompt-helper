// 数据库 API 封装
import { supabase } from './supabase';
import type { Role, PromptTemplate, Conversation, Message, GroupSession, GroupMember, GroupSessionDetail } from '@/types/types';

// ============ 角色管理 ============
export const rolesApi = {
  // 获取所有角色
  async getAll(): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // 获取单个角色
  async getById(id: string): Promise<Role | null> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  // 创建角色
  async create(role: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .insert(role)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新角色
  async update(id: string, updates: Partial<Omit<Role, 'id' | 'created_at'>>): Promise<Role> {
    const { data, error } = await supabase
      .from('roles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除角色
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============ 提示词模板管理 ============
export const promptTemplatesApi = {
  // 获取所有提示词模板
  async getAll(roleId?: string, category?: string): Promise<PromptTemplate[]> {
    let query = supabase
      .from('prompt_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (roleId) {
      query = query.eq('role_id', roleId);
    }
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // 获取所有分类
  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('category')
      .not('category', 'is', null);
    
    if (error) throw error;
    
    const categories = Array.isArray(data) 
      ? [...new Set(data.map(item => item.category).filter(Boolean))]
      : [];
    
    return categories;
  },

  // 创建提示词模板
  async create(template: Omit<PromptTemplate, 'id' | 'created_at'>): Promise<PromptTemplate> {
    const { data, error } = await supabase
      .from('prompt_templates')
      .insert(template)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新提示词模板
  async update(id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'created_at'>>): Promise<PromptTemplate> {
    const { data, error } = await supabase
      .from('prompt_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除提示词模板
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============ 对话会话管理 ============
export const conversationsApi = {
  // 获取所有对话
  async getAll(roleId?: string, limit = 50, offset = 0): Promise<Conversation[]> {
    let query = supabase
      .from('conversations')
      .select('*, role:roles(*)')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (roleId) {
      query = query.eq('role_id', roleId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // 获取单个对话
  async getById(id: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, role:roles(*)')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  // 创建对话
  async create(conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .insert(conversation)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新对话
  async update(id: string, updates: Partial<Omit<Conversation, 'id' | 'created_at'>>): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除对话
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 搜索对话
  async search(keyword: string, limit = 20): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, role:roles(*)')
      .ilike('title', `%${keyword}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },
};

// ============ 消息管理 ============
export const messagesApi = {
  // 获取对话的所有消息
  async getByConversationId(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // 创建消息
  async create(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 批量创建消息
  async createBatch(messages: Omit<Message, 'id' | 'created_at'>[]): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .insert(messages)
      .select();
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // 删除消息
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 删除对话的所有消息
  async deleteByConversationId(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);
    
    if (error) throw error;
  },
};

// ============ 群组会话管理 ============
export const groupSessionsApi = {
  // 获取所有群组
  async getAll(): Promise<GroupSession[]> {
    const { data, error } = await supabase
      .from('group_sessions')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // 获取群组详情（包含成员和决断官）
  async getById(id: string): Promise<GroupSessionDetail | null> {
    const { data: group, error: groupError } = await supabase
      .from('group_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (groupError) throw groupError;
    if (!group) return null;

    // 获取决断官信息
    const { data: judge, error: judgeError } = await supabase
      .from('roles')
      .select('*')
      .eq('id', group.judge_id)
      .single();
    
    if (judgeError) throw judgeError;

    // 获取群组成员
    const { data: memberRelations, error: membersError } = await supabase
      .from('group_members')
      .select('role_id')
      .eq('group_id', id);
    
    if (membersError) throw membersError;

    // 获取成员详细信息
    const memberIds = memberRelations?.map(m => m.role_id) || [];
    const { data: members, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .in('id', memberIds);
    
    if (rolesError) throw rolesError;

    return {
      ...group,
      judge,
      members: Array.isArray(members) ? members : [],
    };
  },

  // 创建群组
  async create(group: Omit<GroupSession, 'id' | 'created_at' | 'updated_at'>, memberIds: string[]): Promise<GroupSession> {
    const { data, error } = await supabase
      .from('group_sessions')
      .insert(group)
      .select()
      .single();
    
    if (error) throw error;

    // 添加成员
    if (memberIds.length > 0) {
      const members = memberIds.map(roleId => ({
        group_id: data.id,
        role_id: roleId,
      }));

      const { error: membersError } = await supabase
        .from('group_members')
        .insert(members);
      
      if (membersError) throw membersError;
    }

    return data;
  },

  // 更新群组
  async update(id: string, updates: Partial<Omit<GroupSession, 'id' | 'created_at'>>): Promise<GroupSession> {
    const { data, error } = await supabase
      .from('group_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除群组
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('group_sessions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 添加成员
  async addMember(groupId: string, roleId: string): Promise<GroupMember> {
    const { data, error } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, role_id: roleId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 移除成员
  async removeMember(groupId: string, roleId: string): Promise<void> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('role_id', roleId);
    
    if (error) throw error;
  },

  // 获取群组成员列表
  async getMembers(groupId: string): Promise<Role[]> {
    const { data: memberRelations, error: membersError } = await supabase
      .from('group_members')
      .select('role_id')
      .eq('group_id', groupId);
    
    if (membersError) throw membersError;

    const memberIds = memberRelations?.map(m => m.role_id) || [];
    if (memberIds.length === 0) return [];

    const { data: members, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .in('id', memberIds);
    
    if (rolesError) throw rolesError;
    return Array.isArray(members) ? members : [];
  },
};
