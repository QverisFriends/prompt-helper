// 历史记录页面
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Trash2, MessageSquare, Download } from 'lucide-react';
import { rolesApi, conversationsApi, messagesApi } from '@/db/api';
import type { Role, Conversation, Message } from '@/types/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Streamdown } from 'streamdown';

export default function HistoryPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedRoleId]);

  const loadData = async () => {
    try {
      const rolesData = await rolesApi.getAll();
      setRoles(rolesData);

      const roleFilter = selectedRoleId === 'all' ? undefined : selectedRoleId;
      const conversationsData = await conversationsApi.getAll(roleFilter);
      setConversations(conversationsData);
    } catch (error) {
      toast.error('加载数据失败');
      console.error(error);
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      loadData();
      return;
    }

    try {
      const results = await conversationsApi.search(searchKeyword);
      setConversations(results);
    } catch (error) {
      toast.error('搜索失败');
      console.error(error);
    }
  };

  const handleViewConversation = async (conversation: Conversation) => {
    try {
      const messagesData = await messagesApi.getByConversationId(conversation.id);
      setMessages(messagesData);
      setSelectedConversation(conversation);
      setIsDialogOpen(true);
    } catch (error) {
      toast.error('加载对话失败');
      console.error(error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await conversationsApi.delete(id);
      toast.success('对话删除成功');
      loadData();
    } catch (error) {
      toast.error('删除对话失败');
      console.error(error);
    }
  };

  const handleExportConversation = (conversation: Conversation) => {
    const exportData = {
      title: conversation.title,
      role: conversation.role?.name,
      created_at: conversation.created_at,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversation-${conversation.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  return (
    <div className="p-4 xl:p-6">
      <div className="mb-6">
        <h1 className="text-2xl xl:text-3xl font-bold">历史记录</h1>
        <p className="text-muted-foreground mt-1">查看和管理您的对话历史</p>
      </div>

      {/* 搜索和筛选 */}
      <Card className="mb-6 shadow-panel">
        <CardContent className="pt-6">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="搜索对话标题..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="transition-all duration-200 focus:border-primary"
              />
              <Button 
                onClick={handleSearch}
                className="transition-all duration-200 hover:scale-105"
              >
                <Search className="w-4 h-4 mr-2" />
                搜索
              </Button>
            </div>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger className="w-full xl:w-48 transition-all duration-200 hover:border-primary">
                <SelectValue placeholder="筛选角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 对话列表 */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        {conversations.map((conversation) => (
          <Card key={conversation.id} className="hover-lift">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base line-clamp-1">
                    {conversation.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {conversation.role?.name || '未知角色'} • {' '}
                    {format(new Date(conversation.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewConversation(conversation)}
                    className="transition-all duration-200 hover:text-primary"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="transition-all duration-200 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent style={{ zIndex: 9999 }}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          确定要删除这个对话吗？此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteConversation(conversation.id)}>
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {conversations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {searchKeyword ? '没有找到匹配的对话' : '还没有任何对话记录'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 对话详情对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedConversation?.title}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedConversation && handleExportConversation(selectedConversation)}
                className="transition-all duration-200 hover:border-primary hover:text-primary"
              >
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
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
                        : message.role === 'assistant'
                        ? 'bg-muted text-foreground'
                        : 'bg-accent text-accent-foreground'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <Streamdown parseIncompleteMarkdown={false}>
                        {message.content}
                      </Streamdown>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    )}
                    <p className="text-xs opacity-70 mt-2">
                      {format(new Date(message.created_at), 'HH:mm:ss')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
