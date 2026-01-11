// 对话页面
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Plus, Loader2 } from 'lucide-react';
import { rolesApi, conversationsApi, messagesApi } from '@/db/api';
import { sendStreamRequest } from '@/lib/stream';
import type { Role, Conversation, Message, ChatMessage } from '@/types/types';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

export default function ChatPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef<string>(''); // 使用 ref 保存流式内容

  // 加载角色列表
  useEffect(() => {
    loadRoles();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollViewportRef.current) {
      const viewport = scrollViewportRef.current;
      // 使用 setTimeout 确保 DOM 更新后再滚动
      setTimeout(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [messages, streamingContent]);

  const loadRoles = async () => {
    try {
      const data = await rolesApi.getAll();
      setRoles(data);
      if (data.length > 0 && !selectedRole) {
        setSelectedRole(data[0]);
      }
    } catch (error) {
      toast.error('加载角色失败');
      console.error(error);
    }
  };

  const handleRoleChange = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setSelectedRole(role);
      setCurrentConversation(null);
      setMessages([]);
      setStreamingContent('');
    }
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
    setStreamingContent('');
    streamingContentRef.current = '';
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedRole || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // 创建或更新对话
      let conversation = currentConversation;
      if (!conversation) {
        conversation = await conversationsApi.create({
          role_id: selectedRole.id,
          title: userMessage.slice(0, 50),
          is_group: false,
          group_id: null,
        });
        setCurrentConversation(conversation);
      }

      // 保存用户消息
      const userMsg = await messagesApi.create({
        conversation_id: conversation.id,
        role: 'user',
        content: userMessage,
        agent_id: null,
        is_judge_summary: false,
      });
      setMessages(prev => [...prev, userMsg]);

      // 准备聊天消息
      const chatMessages: ChatMessage[] = [
        { role: 'system', content: selectedRole.system_prompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ];

      // 发送流式请求
      setStreamingContent('');
      streamingContentRef.current = '';
      abortControllerRef.current = new AbortController();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      await sendStreamRequest({
        functionUrl: `${supabaseUrl}/functions/v1/chat`,
        requestBody: { messages: chatMessages },
        supabaseAnonKey,
        onData: (data) => {
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.content || '';
            streamingContentRef.current += chunk;
            setStreamingContent(streamingContentRef.current);
          } catch (e) {
            console.warn('解析数据失败:', e, '原始数据:', data);
          }
        },
        onComplete: async () => {
          try {
            // 使用 ref 中保存的完整内容
            const fullContent = streamingContentRef.current;
            
            if (!fullContent) {
              console.error('流式内容为空');
              toast.error('AI 回复为空，请重试');
              setIsLoading(false);
              setStreamingContent('');
              streamingContentRef.current = '';
              return;
            }

            // 保存助手消息
            const assistantMsg = await messagesApi.create({
              conversation_id: conversation!.id,
              role: 'assistant',
              content: fullContent,
              agent_id: null,
              is_judge_summary: false,
            });
            
            setMessages(prev => [...prev, assistantMsg]);
            setStreamingContent('');
            streamingContentRef.current = '';
            setIsLoading(false);

            // 更新对话时间
            await conversationsApi.update(conversation!.id, {
              updated_at: new Date().toISOString(),
            });
            
            toast.success('消息发送成功');
          } catch (error) {
            console.error('保存消息失败:', error);
            toast.error('保存消息失败');
            setIsLoading(false);
          }
        },
        onError: (error) => {
          console.error('发送消息失败:', error);
          toast.error(`发送消息失败: ${error.message}`);
          setStreamingContent('');
          streamingContentRef.current = '';
          setIsLoading(false);
        },
        signal: abortControllerRef.current.signal,
      });
    } catch (error) {
      console.error('发送消息失败:', error);
      toast.error('发送消息失败');
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col p-4 xl:p-6 gap-4">
      {/* 顶部工具栏 */}
      <Card className="shadow-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">AI 对话助手</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedRole?.id} onValueChange={handleRoleChange}>
                <SelectTrigger className="w-40 transition-all duration-200 hover:border-primary">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNewConversation}
                className="transition-all duration-200 hover:border-primary hover:text-primary"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 消息列表 */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-panel">
        <div 
          ref={scrollViewportRef}
          className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        >
          <div className="space-y-4" ref={scrollRef}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Streamdown parseIncompleteMarkdown={false}>
                      {message.content}
                    </Streamdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            
            {/* 流式输出中的消息 */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-foreground">
                  <Streamdown parseIncompleteMarkdown={true} isAnimating={true}>
                    {streamingContent}
                  </Streamdown>
                </div>
              </div>
            )}
            
            {/* 加载状态提示 */}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI 正在思考...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 输入框 - 增加圆角和边距 */}
        <CardContent className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
              className="min-h-[60px] max-h-[200px] resize-none input-rounded transition-all duration-200 focus:border-primary"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="shrink-0 transition-all duration-200 hover:scale-105"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
