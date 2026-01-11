// 提示词库页面
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Download, Upload, Copy } from 'lucide-react';
import { rolesApi, promptTemplatesApi } from '@/db/api';
import type { Role, PromptTemplate } from '@/types/types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const promptSchema = z.object({
  role_id: z.string().or(z.null()).optional(),
  content: z.string().min(1, '提示词内容不能为空'),
  category: z.string().or(z.null()).optional(),
  version: z.number().int().positive(),
});

type PromptFormData = z.infer<typeof promptSchema>;

export default function PromptsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);

  const form = useForm<PromptFormData>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      role_id: null,
      content: '',
      category: null,
      version: 1,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesData, promptsData, categoriesData] = await Promise.all([
        rolesApi.getAll(),
        promptTemplatesApi.getAll(),
        promptTemplatesApi.getCategories(),
      ]);
      setRoles(rolesData);
      setPrompts(promptsData);
      setCategories(categoriesData);
    } catch (error) {
      toast.error('加载数据失败');
      console.error(error);
    }
  };

  const handleOpenDialog = (prompt?: PromptTemplate) => {
    if (prompt) {
      setEditingPrompt(prompt);
      form.reset({
        role_id: prompt.role_id || null,
        content: prompt.content,
        category: prompt.category || null,
        version: prompt.version,
      });
    } else {
      setEditingPrompt(null);
      form.reset({
        role_id: null,
        content: '',
        category: null,
        version: 1,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: PromptFormData) => {
    try {
      const submitData = {
        role_id: data.role_id ?? null,
        content: data.content,
        category: data.category ?? null,
        version: data.version,
      };

      if (editingPrompt) {
        await promptTemplatesApi.update(editingPrompt.id, submitData);
        toast.success('提示词更新成功');
      } else {
        await promptTemplatesApi.create(submitData);
        toast.success('提示词创建成功');
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(editingPrompt ? '更新提示词失败' : '创建提示词失败');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await promptTemplatesApi.delete(id);
      toast.success('提示词删除成功');
      loadData();
    } catch (error) {
      toast.error('删除提示词失败');
      console.error(error);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('已复制到剪贴板');
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(prompts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) {
          throw new Error('无效的文件格式');
        }

        for (const item of data) {
          await promptTemplatesApi.create({
            role_id: item.role_id || null,
            content: item.content,
            category: item.category || null,
            version: item.version || 1,
          });
        }

        toast.success('导入成功');
        loadData();
      } catch (error) {
        toast.error('导入失败，请检查文件格式');
        console.error(error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const filteredPrompts = selectedCategory === 'all'
    ? prompts
    : prompts.filter(p => p.category === selectedCategory);

  return (
    <div className="p-4 xl:p-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold">提示词库</h1>
          <p className="text-muted-foreground mt-1">管理和组织您的提示词模板</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleExport}
            className="transition-all duration-200 hover:border-primary hover:text-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" asChild>
            <label className="transition-all duration-200 hover:border-primary hover:text-primary cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              导入
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => handleOpenDialog()}
                className="transition-all duration-200 hover:scale-105"
              >
                <Plus className="w-4 h-4 mr-2" />
                新建提示词
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ zIndex: 9999 }}>
              <DialogHeader>
                <DialogTitle>{editingPrompt ? '编辑提示词' : '新建提示词'}</DialogTitle>
                <DialogDescription>
                  创建可重复使用的提示词模板
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="role_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>关联角色（可选）</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                          value={field.value || 'none'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择角色" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">无</SelectItem>
                            {roles.map(role => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>分类（可选）</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：编程、写作、翻译" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>提示词内容</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="输入提示词内容..."
                            className="min-h-[300px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>版本号</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      取消
                    </Button>
                    <Button type="submit">
                      {editingPrompt ? '保存' : '创建'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
            {filteredPrompts.map((prompt) => {
              const role = roles.find(r => r.id === prompt.role_id);
              return (
                <Card key={prompt.id} className="hover-lift">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {prompt.category || '未分类'} - v{prompt.version}
                        </CardTitle>
                        {role && (
                          <CardDescription className="mt-1">
                            关联角色：{role.name}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(prompt.content)}
                          className="transition-all duration-200 hover:text-primary"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(prompt)}
                          className="transition-all duration-200 hover:text-primary"
                        >
                          <Edit className="w-4 h-4" />
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
                                确定要删除这个提示词吗？此操作无法撤销。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(prompt.id)}>
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                      {prompt.content}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredPrompts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">
                  {selectedCategory === 'all' ? '还没有创建任何提示词' : '该分类下没有提示词'}
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建提示词
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
