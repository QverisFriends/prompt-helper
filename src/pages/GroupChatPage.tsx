// 群聊页面 - 多Agent对话
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Plus, Loader2, Users, Crown } from 'lucide-react';
import { rolesApi, groupSessionsApi, conversationsApi, messagesApi } from '@/db/api';
import type { Role, GroupSessionDetail, Conversation, Message } from '@/types/types';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

interface AgentMessage extends Message {
  agent_name?: string;
}

export default function GroupChatPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<GroupSessionDetail[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupSessionDetail | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // 创建群组表单
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedJudge, setSelectedJudge] = useState<string>('');
  
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // 加载角色和群组列表
  useEffect(() => {
    loadRoles();
    loadGroups();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollViewportRef.current) {
      const viewport = scrollViewportRef.current;
      setTimeout(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [messages]);

  const loadRoles = async () => {
    try {
      const data = await rolesApi.getAll();
      setRoles(data);
    } catch (error) {
      toast.error('加载角色失败');
      console.error(error);
    }
  };

  const loadGroups = async () => {
    try {
      const groupList = await groupSessionsApi.getAll();
      const groupDetails = await Promise.all(
        groupList.map(g => groupSessionsApi.getById(g.id))
      );
      setGroups(groupDetails.filter(g => g !== null) as GroupSessionDetail[]);
    } catch (error) {
      toast.error('加载群组失败');
      console.error(error);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length < 2 || !selectedJudge) {
      toast.error('请填写群组名称、至少选择2个成员和1个决断官');
      return;
    }

    try {
      await groupSessionsApi.create(
        {
          name: groupName,
          judge_id: selectedJudge,
        },
        selectedMembers
      );
      
      toast.success('群组创建成功');
      setIsDialogOpen(false);
      setGroupName('');
      setSelectedMembers([]);
      setSelectedJudge('');
      loadGroups();
    } catch (error) {
      toast.error('创建群组失败');
      console.error(error);
    }
  };

  const handleGroupChange = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      setSelectedGroup(group);
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedGroup || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // 创建或更新对话
      let conversation = currentConversation;
      if (!conversation) {
        conversation = await conversationsApi.create({
          title: userMessage.slice(0, 50),
          is_group: true,
          group_id: selectedGroup.id,
          role_id: null,
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

      // 调用群聊 Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/group-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: userMessage,
          agent_ids: selectedGroup.members.map(m => m.id),
          judge_id: selectedGroup.judge_id,
          conversation_history: messages
            .filter(m => m.role !== 'user')
            .slice(-10) // 只保留最近10条历史
            .map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error('群聊请求失败');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || '群聊失败');
      }

      // 保存所有Agent的回复
      const agentMessages: Omit<Message, 'id' | 'created_at'>[] = [];
      
      // 保存普通Agent的回复
      for (const agentResp of result.agent_responses) {
        if (!agentResp.error && agentResp.content) {
          agentMessages.push({
            conversation_id: conversation.id,
            role: 'assistant',
            content: agentResp.content,
            agent_id: agentResp.agent_id,
            is_judge_summary: false,
          });
        }
      }

      // 保存决断官的总结
      if (result.judge_summary) {
        agentMessages.push({
          conversation_id: conversation.id,
          role: 'assistant',
          content: result.judge_summary,
          agent_id: selectedGroup.judge_id,
          is_judge_summary: true,
        });
      }

      // 批量保存消息
      const savedMessages = await messagesApi.createBatch(agentMessages);
      
      // 添加Agent名称信息
      const messagesWithNames = savedMessages.map(msg => {
        const agent = msg.agent_id === selectedGroup.judge_id
          ? selectedGroup.judge
          : selectedGroup.members.find(m => m.id === msg.agent_id);
        return {
          ...msg,
          agent_name: agent?.name,
        };
      });

      setMessages(prev => [...prev, ...messagesWithNames]);
      setIsLoading(false);

      // 更新对话时间
      await conversationsApi.update(conversation.id, {
        updated_at: new Date().toISOString(),
      });

      toast.success('群聊完成');
    } catch (error) {
      console.error('发送消息失败:', error);
      toast.error(`发送消息失败: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleMember = (roleId: string) => {
    setSelectedMembers(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  return (
    <div className="h-full flex flex-col p-4 xl:p-6 gap-4">
      {/* 顶部工具栏 */}
      <Card className="shadow-panel">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              多Agent群聊
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedGroup?.id} onValueChange={handleGroupChange}>
                <SelectTrigger className="w-48 transition-all duration-200 hover:border-primary">
                  <SelectValue placeholder="选择群组" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.members.length}人)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="transition-all duration-200 hover:border-primary hover:text-primary"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>创建群组</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="group-name">群组名称</Label>
                      <Input
                        id="group-name"
                        placeholder="例如：营销方案评审组"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>选择成员（至少2个）</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
                        {roles.map(role => (
                          <div key={role.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`member-${role.id}`}
                              checked={selectedMembers.includes(role.id)}
                              onCheckedChange={() => toggleMember(role.id)}
                            />
                            <Label
                              htmlFor={`member-${role.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {role.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        已选择 {selectedMembers.length} 个成员
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="judge">决断官</Label>
                      <Select value={selectedJudge} onValueChange={setSelectedJudge}>
                        <SelectTrigger id="judge">
                          <SelectValue placeholder="选择决断官" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        决断官将在所有成员回答后进行总结
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateGroup}>
                      创建群组
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNewConversation}
                className="transition-all duration-200 hover:border-primary hover:text-primary"
                disabled={!selectedGroup}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {selectedGroup && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <span>成员: {selectedGroup.members.map(m => m.name).join(', ')}</span>
              <span>|</span>
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                决断官: {selectedGroup.judge.name}
              </span>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 消息列表 */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-panel">
        <div 
          ref={scrollViewportRef}
          className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.is_judge_summary
                      ? 'bg-accent text-accent-foreground border-2 border-primary'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold">
                      {message.is_judge_summary && <Crown className="w-3 h-3" />}
                      <span>{message.agent_name || 'Agent'}</span>
                      {message.is_judge_summary && <span className="text-primary">(决断官)</span>}
                    </div>
                  )}
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
            
            {/* 加载状态提示 */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted text-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">各位专家正在思考中...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 输入框 */}
        <CardContent className="border-t border-border p-4">
          <div className="flex gap-2">
            <Textarea
              placeholder={selectedGroup ? "输入您的问题，让多位专家为您解答..." : "请先选择一个群组"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !selectedGroup}
              className="min-h-[60px] max-h-[200px] resize-none input-rounded transition-all duration-200 focus:border-primary"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim() || !selectedGroup}
              size="icon"
              className="h-[60px] w-[60px] flex-shrink-0 btn-hover"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
