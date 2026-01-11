-- 创建角色表
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建提示词模板表
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建对话会话表
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建消息表
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prompt_templates_role_id ON prompt_templates(role_id);
CREATE INDEX IF NOT EXISTS idx_conversations_role_id ON conversations(role_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 插入默认角色
INSERT INTO roles (name, description, system_prompt) VALUES
('通用助手', '一个友好的AI助手，可以回答各种问题', '你是一个友好、专业的AI助手。请用清晰、准确的语言回答用户的问题，并在必要时提供详细的解释。'),
('代码助手', '专注于编程和技术问题的助手', '你是一个专业的编程助手，精通多种编程语言和技术栈。请提供清晰的代码示例和技术解释，帮助用户解决编程问题。'),
('写作助手', '帮助用户进行创意写作和文案创作', '你是一个富有创意的写作助手，擅长各种文体的创作。请根据用户需求提供优质的文案、故事或文章内容。')
ON CONFLICT DO NOTHING;