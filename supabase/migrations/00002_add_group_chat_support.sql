-- 创建群组会话表
CREATE TABLE IF NOT EXISTS group_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  judge_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建群组成员关系表
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, role_id)
);

-- 扩展 conversations 表，添加群聊支持
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES group_sessions(id) ON DELETE CASCADE;

-- 扩展 messages 表，添加 agent_id 字段用于标识是哪个 Agent 的回复
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES roles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_judge_summary BOOLEAN DEFAULT FALSE;

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role_id ON group_members(role_id);
CREATE INDEX IF NOT EXISTS idx_conversations_group_id ON conversations(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);

-- 添加注释
COMMENT ON TABLE group_sessions IS '群组会话表';
COMMENT ON TABLE group_members IS '群组成员关系表';
COMMENT ON COLUMN conversations.is_group IS '是否为群聊对话';
COMMENT ON COLUMN conversations.group_id IS '关联的群组ID';
COMMENT ON COLUMN messages.agent_id IS '回复该消息的Agent ID';
COMMENT ON COLUMN messages.is_judge_summary IS '是否为决断官的总结';