// 应用主布局组件 - 左右分屏布局
import { Outlet } from 'react-router';
import { MessageSquare, Users, FileText, History, UsersRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/lib/utils';

const menuItems = [
  { title: '对话', icon: MessageSquare, path: '/chat' },
  { title: '群聊', icon: UsersRound, path: '/group-chat' },
  { title: '角色管理', icon: Users, path: '/roles' },
  { title: '提示词库', icon: FileText, path: '/prompts' },
  { title: '历史记录', icon: History, path: '/history' },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* 左侧导航栏 - 固定宽度 */}
      <aside className="w-64 flex-shrink-0 bg-sidebar border-r border-border shadow-panel flex flex-col">
        {/* 顶部标题 */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">Prompt-Helper</h1>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                        : "text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部主题切换 */}
        <div className="h-16 flex items-center justify-center border-t border-border">
          <ThemeToggle />
        </div>
      </aside>

      {/* 右侧内容区 - 自适应宽度 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* 顶部工具栏 */}
        <header className="h-16 flex-shrink-0 border-b border-border shadow-panel bg-card px-6 flex items-center">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {menuItems.find(item => item.path === location.pathname)?.title || '对话'}
            </h2>
          </div>
        </header>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
