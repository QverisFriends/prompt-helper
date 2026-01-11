// 角色管理页面
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { rolesApi } from '@/db/api';
import type { Role } from '@/types/types';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const roleSchema = z.object({
  name: z.string().min(1, '角色名称不能为空'),
  description: z.string().or(z.null()).optional(),
  system_prompt: z.string().min(1, '系统提示词不能为空'),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: null,
      system_prompt: '',
    },
  });

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const data = await rolesApi.getAll();
      setRoles(data);
    } catch (error) {
      toast.error('加载角色失败');
      console.error(error);
    }
  };

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      form.reset({
        name: role.name,
        description: role.description || null,
        system_prompt: role.system_prompt,
      });
    } else {
      setEditingRole(null);
      form.reset({
        name: '',
        description: null,
        system_prompt: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: RoleFormData) => {
    try {
      const submitData = {
        name: data.name,
        description: data.description ?? null,
        system_prompt: data.system_prompt,
      };

      if (editingRole) {
        await rolesApi.update(editingRole.id, submitData);
        toast.success('角色更新成功');
      } else {
        await rolesApi.create(submitData);
        toast.success('角色创建成功');
      }
      setIsDialogOpen(false);
      loadRoles();
    } catch (error) {
      toast.error(editingRole ? '更新角色失败' : '创建角色失败');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await rolesApi.delete(id);
      toast.success('角色删除成功');
      loadRoles();
    } catch (error) {
      toast.error('删除角色失败');
      console.error(error);
    }
  };

  return (
    <div className="p-4 xl:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl xl:text-3xl font-bold">角色管理</h1>
          <p className="text-muted-foreground mt-1">管理您的 AI 角色和系统提示词</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => handleOpenDialog()}
              className="transition-all duration-200 hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建角色
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ zIndex: 9999 }}>
            <DialogHeader>
              <DialogTitle>{editingRole ? '编辑角色' : '新建角色'}</DialogTitle>
              <DialogDescription>
                设置角色的名称、描述和系统提示词
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>角色名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：编程助手" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>角色描述（可选）</FormLabel>
                      <FormControl>
                        <Input placeholder="简短描述这个角色的用途" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="system_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>系统提示词</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="定义 AI 的行为和角色..."
                          className="min-h-[200px]"
                          {...field}
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
                    {editingRole ? '保存' : '创建'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.id} className="hover-lift">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>{role.name}</CardTitle>
                  {role.description && (
                    <CardDescription className="mt-1">{role.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(role)}
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
                          确定要删除角色 "{role.name}" 吗？此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(role.id)}>
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">系统提示词：</p>
                <p className="line-clamp-3 whitespace-pre-wrap">{role.system_prompt}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {roles.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">还没有创建任何角色</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              创建第一个角色
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
