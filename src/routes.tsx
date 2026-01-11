import ChatPage from './pages/ChatPage';
import GroupChatPage from './pages/GroupChatPage';
import RolesPage from './pages/RolesPage';
import PromptsPage from './pages/PromptsPage';
import HistoryPage from './pages/HistoryPage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '对话',
    path: '/chat',
    element: <ChatPage />
  },
  {
    name: '群聊',
    path: '/group-chat',
    element: <GroupChatPage />
  },
  {
    name: '角色管理',
    path: '/roles',
    element: <RolesPage />
  },
  {
    name: '提示词库',
    path: '/prompts',
    element: <PromptsPage />
  },
  {
    name: '历史记录',
    path: '/history',
    element: <HistoryPage />
  }
];

export default routes;
