import { useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { cn } from '../lib/utils';
import Fa from './Fa';
import { MarkdownContent } from './MarkdownContent';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('');
}

function hasToolCalls(message: UIMessage): boolean {
  return message.parts.some(
    (part) => part.type === 'tool-call' || part.type === 'tool-input' || part.type === 'tool-result',
  );
}

function getToolName(message: UIMessage): string | null {
  const toolPart = message.parts.find((p) => p.type === 'tool-call');
  if (toolPart && 'toolName' in toolPart) return String(toolPart.toolName);
  return null;
}

const SUGGESTIONS = [
  'How do I track my parcel?',
  'How does Tapa Wallet top-up work?',
  'How do I cancel a booking?',
  'How does the parcel claim code work?',
] as const;

export default function SupportChat() {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const { messages, sendMessage, status, error } = useChat({
    transport,
  });

  const isBusy = status === 'submitted' || status === 'streaming';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput('');
    await sendMessage({ text });
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const askSuggestion = (text: string) => {
    if (isBusy) return;
    void sendMessage({ text });
  };

  return (
    <section className="mx-auto mt-12 max-w-3xl">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-extrabold text-ink-900">Chat with Tapa Assist</h2>
        <p className="mt-1 text-sm text-ink-500">
          AI-powered help for bookings, parcels, and wallet questions. Powered by NVIDIA NIM.
        </p>
      </div>

      <div className="card flex h-[32rem] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
                <Fa name="mail" className="mr-1.5 inline h-4 w-4 text-flame-600" />
                Hi — I&apos;m Tapa Assist. Ask about trips, parcels, wallet top-ups, or claim codes.
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => askSuggestion(s)}
                    disabled={isBusy}
                    className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-flame-200 hover:text-flame-700 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const text = messageText(message);
            const showToolIndicator = hasToolCalls(message);
            const toolName = getToolName(message);
            if (!text && !showToolIndicator) return null;
            const isUser = message.role === 'user';
            return (
              <div
                key={message.id}
                className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    isUser
                      ? 'bg-ink-900 text-white'
                      : 'border border-ink-100 bg-white text-ink-700',
                  )}
                >
                  {!isUser && (
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-flame-600">
                      Tapa Assist
                    </div>
                  )}
                  {showToolIndicator && !text && (
                    <div className="flex items-center gap-2 text-ink-500">
                      <Fa name="loader2" className="h-3.5 w-3.5 animate-spin" />
                      <span className="italic">
                        {toolName ? `Looking up ${toolName.replace(/([A-Z])/g, ' $1').trim()}…` : 'Calling tool…'}
                      </span>
                    </div>
                  )}
                  {text && <MarkdownContent content={text} />}
                </div>
              </div>
            );
          })}

          {isBusy && (
            <div className="flex items-center gap-2 text-sm text-ink-400">
              <Fa name="loader2" className="h-4 w-4 animate-spin" />
              Tapa Assist is typing…
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-flame-100 bg-flame-50 px-4 py-3 text-sm text-flame-700">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-ink-100 p-4">
          <div className="flex items-end gap-2">
            <textarea
              className="input flex-1 resize-none leading-relaxed"
              placeholder="Ask a question…"
              value={input}
              rows={1}
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
            <button type="submit" disabled={isBusy || !input.trim()} className="btn-primary px-5">
              <Fa name="arrow-right" className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
