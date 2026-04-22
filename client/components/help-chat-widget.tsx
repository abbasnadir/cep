"use client";

import { useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Ask about filing civic complaints, using UrbanFix, or registering complaints on official grievance portals.",
};

export function HelpChatWidget() {
  const { session, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== INITIAL_MESSAGE.id)
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  );

  async function handleSend() {
    const content = draft.trim();
    if (!content || !session?.access_token || sending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      content,
    };

    setDraft("");
    setError(null);
    setSending(true);
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await apiFetch<{ message: string }>("/assistant/chat", {
        method: "POST",
        accessToken: session.access_token,
        body: JSON.stringify({
          message: content,
          history,
        }),
      });

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${crypto.randomUUID()}`,
          role: "assistant",
          content: response.message,
        },
      ]);
    } catch (chatError) {
      setError(
        chatError instanceof Error ? chatError.message : "Assistant is unavailable right now.",
      );
    } finally {
      setSending(false);
    }
  }

  if (loading || !session) {
    return null;
  }

  return (
    <div className="fixed right-4 top-24 z-50 sm:right-6">
      {isOpen ? (
        <div className="w-[min(92vw,24rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
          <div className="bg-[linear-gradient(135deg,#0f172a_0%,#155eef_65%,#22c55e_140%)] px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                  Complaint help
                </p>
                <h2 className="mt-1 text-lg font-semibold">UrbanFix assistant</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[26rem] space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "assistant"
                    ? "mr-8 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700"
                    : "ml-8 rounded-[20px] bg-slate-900 px-4 py-3 text-sm leading-7 text-white"
                }
              >
                {message.content}
              </div>
            ))}

            {sending && (
              <div className="mr-8 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Thinking...
              </div>
            )}

            {error && (
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <textarea
              className="textarea-field min-h-[7rem]"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask how to file complaint, choose category, add location, or use official grievance portals."
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-slate-500">
                Signed-in users only. Assistant answers complaint/reporting questions in English.
              </p>
              <button
                type="button"
                className="button-primary"
                disabled={sending || !draft.trim()}
                onClick={handleSend}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200 bg-[linear-gradient(135deg,#0f172a_0%,#155eef_60%,#22c55e_140%)] text-xl text-white shadow-[0_18px_45px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5"
          onClick={() => setIsOpen(true)}
          aria-label="Open complaint help chat"
          title="Open complaint help chat"
        >
          ?
        </button>
      )}
    </div>
  );
}
