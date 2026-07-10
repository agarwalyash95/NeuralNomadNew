
export interface PlannerChatProps {
  workspaceId?: string | null;
}

export interface MessageBubbleProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  badge?: React.ReactNode;
  explanation?: React.ReactNode;
  widget?: React.ReactNode;
}
