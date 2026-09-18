'use client';
import * as React from 'react';
import { useChat } from '@/features/chat/hooks/useChat';
import { ChatPanelPC } from '@/features/chat/views/pc';
import { ChatPanelPhone } from '@/features/chat/views/phone';
import { ChatPanelProps, EnhancedChatExports } from '@/features/chat/shared';
export * from '@/features/chat/shared';
export const ChatPanel = React.forwardRef<EnhancedChatExports, ChatPanelProps>(function ChatPanel(props, ref) {
const model = useChat(props, ref);
return model.device === 'phone' ? <ChatPanelPhone model={model} /> : <ChatPanelPC model={model} />;
});
