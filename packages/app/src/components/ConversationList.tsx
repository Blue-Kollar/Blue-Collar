"use client";

import { MessageSquare, Plus, User } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  currentUserId: string;
}


export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading,
  currentUserId,
}: Props) {
  return (
    <div className="flex w-80 flex-col border-r dark:border-gray-800">
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Messages</h2>
        <button className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
            <MessageSquare size={24} className="opacity-30" />
            <p className="text-xs">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const other = conv.participants.find((p) => p.userId !== currentUserId);
            const lastMsg = conv.messages?.[0];
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors dark:border-gray-800",
                  activeId === conv.id
                    ? "bg-blue-50 dark:bg-blue-950/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                  {other?.user.avatar ? (
                    <img
                      src={other.user.avatar}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <User size={16} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {other?.user.firstName} {other?.user.lastName}
                    </span>
                    {lastMsg && (
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {formatRelativeTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {lastMsg && (
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {lastMsg.senderId === currentUserId ? "You: " : ""}
                        {lastMsg.body}
                      </p>
                    )}
                    {(conv.unreadCount ?? 0) > 0 && (
                      <span className="ml-auto shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                        {conv.unreadCount! > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
