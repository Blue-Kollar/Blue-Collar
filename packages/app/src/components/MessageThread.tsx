"use client";

import { useRef, useCallback } from "react";
import { User } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { cn, formatDate as sharedFormatDate, formatTime as sharedFormatTime } from "@/lib/utils";
import MessageInput from "./MessageInput";
import type { Message } from "@/types";
import { useTranslations } from "next-intl";

interface Props {
  messages: Message[];
  conversationId: string | null;
  onSend: (body: string) => void;
  currentUserId: string;
}

function formatTime(iso: string) {
  return sharedFormatTime(iso);
}

function formatDate(iso: string, todayLabel: string, yesterdayLabel: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return todayLabel;
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return sharedFormatDate(iso);
}

function shouldShowDate(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1]!.createdAt);
  const curr = new Date(messages[index]!.createdAt);
  return prev.toDateString() !== curr.toDateString();
}

export default function MessageThread({
  messages,
  conversationId,
  onSend,
  currentUserId,
}: Props) {
  const t = useTranslations("componentText");
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "End" && e.ctrlKey) {
      virtuosoRef.current?.scrollToIndex({ index: "LAST", behavior: "smooth" });
    }
  }, []);

  if (!conversationId) {
    return (
      <div
        className="flex flex-1 items-center justify-center text-gray-400"
        role="status"
        aria-label={t("noConversationSelected")}
      >
        <div className="text-center">
          <p className="text-sm font-medium">{t("selectConversation")}</p>
          <p className="text-xs mt-1">{t("chooseConversation")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col" role="main" aria-label={t("messageThread")}>
      <div
        className="flex-1 min-h-0 overflow-hidden px-4 py-4"
        role="region"
        aria-label={t("messages")}
        aria-live="polite"
        aria-atomic="false"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {messages.length === 0 ? (
          <div
            className="flex h-full items-center justify-center text-gray-400"
            role="status"
            aria-label={t("noMessages")}
          >
            <p className="text-sm">{t("noMessagesYetStart")}</p>
          </div>
        ) : (
          <div role="log" aria-label={t("conversationMessages")} className="h-full">
            <Virtuoso
              ref={virtuosoRef}
              className="h-full"
              data={messages}
              computeItemKey={(_, msg) => msg.id}
              followOutput="smooth"
              initialTopMostItemIndex={messages.length - 1}
              itemContent={(idx, msg) => (
                <div>
                  {shouldShowDate(messages, idx) && (
                    <div className="flex justify-center py-2">
                      <span
                        className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        role="doc-subtitle"
                      >
                        {formatDate(msg.createdAt, t("today"), t("yesterday"))}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex items-end gap-2",
                      msg.senderId === currentUserId ? "flex-row-reverse" : "flex-row"
                    )}
                    role="article"
                    aria-label={t("messageFrom", { name: `${msg.sender.firstName} ${msg.sender.lastName}`, time: formatTime(msg.createdAt) })}
                  >
                    <div
                      className={cn(
                        "flex items-end gap-2 max-w-[75%]",
                        msg.senderId === currentUserId ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      {msg.sender.avatar ? (
                        <img
                          src={msg.sender.avatar}
                          alt={t("avatarAlt", { name: `${msg.sender.firstName} ${msg.sender.lastName}` })}
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700"
                          aria-label={t("defaultAvatarAlt", { name: `${msg.sender.firstName} ${msg.sender.lastName}` })}
                        >
                          <User size={12} className="text-gray-500" aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                            msg.senderId === currentUserId
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                          )}
                        >
                          {msg.body}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 flex items-center gap-1 px-1",
                            msg.senderId === currentUserId ? "justify-end" : "justify-start"
                          )}
                          aria-label={msg.senderId === currentUserId ? t(msg.readAt ? "sentAtRead" : "sentAtSent", { time: formatTime(msg.createdAt) }) : ""}
                        >
                          <span className="text-[10px] text-gray-400">
                            {formatTime(msg.createdAt)}
                          </span>
                          {msg.senderId === currentUserId && (
                            <span className="text-[10px] text-gray-400" aria-label={msg.readAt ? t("messageRead") : t("messageSent")}>
                              {msg.readAt ? t("read") : t("sent")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          </div>
        )}
      </div>
      <MessageInput onSend={onSend} />
    </div>
  );
}
