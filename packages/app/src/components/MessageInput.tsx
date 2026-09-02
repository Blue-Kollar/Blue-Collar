"use client";

import { Paperclip, Send, Smile } from "lucide-react";
import { useRef,useState } from "react";

interface Props {
  onSend: (body: string) => void;
  disabled?: boolean;
}

const EMOJIS = ["👍", "❤️", "😂", "😊", "🎉", "👏", "🔥", "💯", "🙏", "✨"];

export default function MessageInput({ onSend, disabled }: Props) {
  const [message, setMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage("");
    setShowEmoji(false);
  };

  const handleEmojiPick = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="border-t p-4 dark:border-gray-800">
      {showEmoji && (
        <div className="mb-2 flex flex-wrap gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiPick(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmoji((s) => !s)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle emoji picker"
        >
          <Smile size={18} />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Attach file"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={disabled}
          className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
