'use client';

import * as React from 'react';
import { useChat } from '@/components/Chat/hooks/useChat';
import { ChatPanelPC } from '@/components/Chat/pc';
import { ChatPanelPhone } from '@/components/Chat/phone';
import { ChatPanelProps, EnhancedChatExports } from '@/components/Chat/shared';
export * from '@/components/Chat/shared';

export const ChatPanel = React.forwardRef<EnhancedChatExports, ChatPanelProps>(
  function ChatPanel(props, ref) {
    const model = useChat(props, ref);
    return model.device === 'phone' ? (
      <ChatPanelPhone model={model} />
    ) : (
      <ChatPanelPC model={model} />
    );
  },
);
