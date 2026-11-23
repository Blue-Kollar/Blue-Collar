'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useWallet } from '@/hooks/useWallet';
import ConversationList from '@/components/messages/ConversationList';
import MessageThread from '@/components/messages/MessageThread';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { Conversation, Message } from '@/types';

export default function MessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { address } = useWallet();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.getConversations({ limit: 50 });
      setConversations(res.data ?? []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load conversations';
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      setActiveConversation(id);
      try {
        const res = await apiClient.getConversationMessages(id, { limit: 100 });
        setMessages(res.data ?? []);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to load messages';
        toast(message, 'error');
      }
    },
    [toast],
  );

  const handleSendMessage = useCallback(
    async (body: string) => {
      if (!activeConversation) return;
      try {
        const res = await apiClient.sendMessage(activeConversation, { body });
        setMessages((prev) => (res.data ? [...prev, res.data] : prev));
        fetchConversations();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to send message';
        toast(message, 'error');
      }
    },
    [activeConversation, toast, fetchConversations],
  );

  if (!user) return null;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl">
      <ConversationList
        conversations={conversations}
        activeId={activeConversation}
        onSelect={handleSelectConversation}
        loading={loading}
        currentUserId={user.id}
        walletAddress={address}
      />
      <MessageThread
        messages={messages}
        conversationId={activeConversation}
        onSend={handleSendMessage}
        currentUserId={user.id}
        walletAddress={address}
      />
    </div>
  );
}
