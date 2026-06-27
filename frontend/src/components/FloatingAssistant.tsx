import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { cn } from "../lib/utils";
import Fa from "./Fa";
import { MarkdownContent } from "./MarkdownContent";
import { friendlyError } from "../lib/errors";

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('');
}

const QUICK_PROMPTS = [
  { icon: 'search', text: 'Find buses Kigali → Huye' },
  { icon: 'package', text: 'Send a parcel' },
  { icon: 'life-ring', text: 'How does wallet work?' },
] as const;

/**
 * Glassmorphism floating assistant.
 *
 * Frosted glass panel with backdrop-blur, translucent surfaces, soft
 * layered shadows. Apple.com aesthetic — no chrome, no heavy borders,
 * light passes through everything.
 *
 * Structure (mirrors SaaS chatbot):
 *   1. Frosted header — title + actions
 *   2. Welcome card + quick prompts (empty state)
 *   3. Conversation thread
 *   4. Input dock
 */
export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/api/ai/chat`,
        headers: () => {
          const token = localStorage.getItem('accessToken');
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput('');
    await sendMessage({ text });
  };

  const askQuick = (text: string) => {
    if (isBusy) return;
    void sendMessage({ text });
  };

  const clearChat = () => setMessages([]);

  return (
    <>
      {/* ── Chat Panel ────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex h-[34rem] w-[24rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border border-white/20 shadow-glow"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between border-b border-white/20 px-5 py-4"
            style={{
              background: 'rgba(16, 7, 92, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-flame-500 shadow-lg shadow-flame-500/30">
                <Fa name="robot" className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Tapa Assist</div>
                <div className="text-[11px] text-white/60">AI · NVIDIA NIM</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                title="Clear chat"
              >
                <Fa name="rotateccw" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                title="Close"
              >
                <Fa name="x" className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Messages area ───────────────────────────────────────── */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-5 pt-2">
                {/* Welcome card */}
                <div
                  className="rounded-2xl border border-white/30 px-4 py-3.5"
                  style={{
                    background: 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <Fa name="bolt" className="h-4 w-4 text-flame-500" />
                    How can I help?
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                    Ask about trips, parcels, wallet, claim codes, or anything TapaRide.
                  </p>
                </div>

                {/* Quick prompts */}
                <div className="space-y-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p.text}
                      type="button"
                      onClick={() => askQuick(p.text)}
                      disabled={isBusy}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/30 px-4 py-3 text-left text-sm text-ink-700 transition hover:border-flame-300/50 hover:shadow-soft disabled:opacity-50"
                      style={{
                        background: 'rgba(255, 255, 255, 0.45)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                      }}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-flame-50 text-flame-600">
                        <Fa name={p.icon} className="h-3.5 w-3.5" />
                      </span>
                      {p.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const text = messageText(message);
              const showToolIndicator = message.parts.some(
                (p) => p.type === 'tool-call' || p.type === 'tool-input' || p.type === 'tool-result',
              );
              const toolName = message.parts.find((p) => p.type === 'tool-call');
              const toolLabel =
                toolName && 'toolName' in toolName
                  ? String(toolName.toolName).replace(/([A-Z])/g, ' $1').trim()
                  : null;
              if (!text && !showToolIndicator) return null;
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id}
                  className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                >
                  {!isUser && (
                    <div className="mr-2 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-flame-500">
                      <Fa name="robot" className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      isUser
                        ? 'bg-ink-900 text-white'
                        : 'border border-white/30 text-ink-700',
                    )}
                    style={
                      !isUser
                        ? {
                            background: 'rgba(255, 255, 255, 0.6)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                          }
                        : undefined
                    }
                  >
                    {!isUser && (
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-flame-500">
                        Tapa Assist
                      </div>
                    )}
                    {showToolIndicator && !text && (
                      <div className="flex items-center gap-2 text-ink-500">
                        <Fa name="loader2" className="h-3.5 w-3.5 animate-spin" />
                        <span className="italic text-xs">
                          {toolLabel ? `Looking up ${toolLabel}…` : 'Calling tool…'}
                        </span>
                      </div>
                    )}
                    {text && <MarkdownContent content={text} />}
                  </div>
                </div>
              );
            })}

            {isBusy && messages.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-ink-400">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-flame-500">
                  <Fa name="robot" className="h-3 w-3 text-white" />
                </div>
                <div
                  className="rounded-2xl border border-white/30 px-4 py-2.5 italic"
                  style={{
                    background: 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {error && (
            <div
              className="border-t border-white/20 px-4 py-2.5 text-xs text-flame-700"
              style={{ background: 'rgba(254, 215, 215, 0.6)' }}
            >
              {friendlyError(error.message)}
            </div>
          )}

          {/* ── Input dock ──────────────────────────────────────────── */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-white/20 p-3"
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="flex items-center gap-2 rounded-2xl border border-white/40 px-3 py-1.5"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              <textarea
                ref={(el) => {
                  inputRef.current = el as unknown as HTMLInputElement;
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                  }
                }}
                rows={1}
                className="flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-ink-900 placeholder:text-ink-400 outline-none"
                placeholder="Ask anything…"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).form?.requestSubmit();
                  }
                }}
                disabled={isBusy}
              />
              <button
                type="submit"
                disabled={isBusy || !input.trim()}
                className="grid h-8 w-8 place-items-center rounded-xl bg-flame-500 text-white transition hover:bg-flame-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Fa name="arrow-right" className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── FAB ───────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-glow transition-all duration-300',
          open
            ? 'bg-ink-900/80 hover:bg-ink-900'
            : 'bg-flame-500 hover:bg-flame-600 hover:scale-105',
        )}
        style={
          open
            ? {
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }
            : undefined
        }
        aria-label={open ? 'Close Tapa Assist' : 'Open Tapa Assist'}
      >
        <Fa
          name={open ? 'x' : 'robot'}
          className="h-6 w-6 text-white transition-transform duration-300"
        />
      </button>
    </>
  );
}
