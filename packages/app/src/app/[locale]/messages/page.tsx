"use client";

import { useCallback,useEffect, useState } from "react";

import ConversationList from "@/components/ConversationList";
import MessageThread from "@/components/MessageThread";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { getConversationMessages, getConversations, sendMessage } from "@/lib/api";
import type { Conversation, Message } from "@/types";

export default function MessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await getConversations({ limit: "50" });
      setConversations(res.data);
    } catch {
      toast("Failed to load conversations", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversation(id);
    try {
      const res = await getConversationMessages(id, { limit: "100" });
      setMessages(res.data);
    } catch {
      toast("Failed to load messages", "error");
    }
  }, [toast]);

  const handleSendMessage = useCallback(async (body: string) => {
    if (!activeConversation) return;
    try {
      const res = await sendMessage(activeConversation, { body });
      setMessages((prev) => [...prev, res.data]);
      fetchConversations();
    } catch {
      toast("Failed to send message", "error");
    }
  }, [activeConversation, toast, fetchConversations]);

  if (!user) return null;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl">
      <ConversationList
        conversations={conversations}
        activeId={activeConversation}
        onSelect={handleSelectConversation}
        loading={loading}
        currentUserId={user.id}
      />
      <MessageThread
        messages={messages}
        conversationId={activeConversation}
        onSend={handleSendMessage}
        currentUserId={user.id}
      />
    </div>
  );
}
