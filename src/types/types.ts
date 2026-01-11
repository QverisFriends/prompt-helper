// 类型定义
export interface Role {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplate {
  id: string;
  role_id: string | null;
  content: string;
  category: string | null;
  version: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  role_id: string | null;
  title: string;
  is_group: boolean;
  group_id: string | null;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_id: string | null;
  is_judge_summary: boolean;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 群组会话类型
export interface GroupSession {
  id: string;
  name: string;
  judge_id: string;
  created_at: string;
  updated_at: string;
}

// 群组成员类型
export interface GroupMember {
  id: string;
  group_id: string;
  role_id: string;
  created_at: string;
}

// 群组详情类型（包含成员和决断官信息）
export interface GroupSessionDetail extends GroupSession {
  members: Role[];
  judge: Role;
}
