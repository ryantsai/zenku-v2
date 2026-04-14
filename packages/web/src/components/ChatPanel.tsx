import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { sendChat } from '../api';
import type { ChatMessage, SSEChunk, ToolEvent } from '../types';

interface Props {
  onViewsChanged: () => void;
}

export function ChatPanel({ onViewsChanged }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 Zenku。告訴我你想要管理什麼資料，我來幫你建立應用。\n\n例如：「我要管理客戶資料，有姓名、電話、email」',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      toolEvents: [],
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setLoading(true);

    const history = messages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => ({ role: m.role, content: m.content }));

    let hasViewChange = false;

    try {
      for await (const chunk of sendChat(text, history)) {
        const c = chunk as SSEChunk;

        if (c.type === 'text') {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id ? { ...m, content: m.content + c.content } : m
            )
          );
        } else if (c.type === 'tool_start') {
          const event: ToolEvent = { type: 'tool_start', tool: c.tool };
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? { ...m, toolEvents: [...(m.toolEvents ?? []), event] }
                : m
            )
          );
        } else if (c.type === 'tool_result') {
          const event: ToolEvent = { type: 'tool_result', tool: c.tool, result: c.result };
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    toolEvents: (m.toolEvents ?? []).map(e =>
                      e.type === 'tool_start' && e.tool === c.tool && !e.result ? event : e
                    ),
                  }
                : m
            )
          );
          if (c.tool === 'manage_schema' || c.tool === 'manage_ui') {
            hasViewChange = true;
          }
        } else if (c.type === 'done') {
          if (hasViewChange) onViewsChanged();
        } else if (c.type === 'error') {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? { ...m, content: `錯誤：${c.message}` }
                : m
            )
          );
        }
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: `發生錯誤：${String(err)}` }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">Zenku 禪空</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="描述你想要的功能... (Enter 送出)"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors self-end"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
        {isUser ? (
          <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm">
            {message.content}
          </div>
        ) : (
          <div>
            {/* Tool events */}
            {message.toolEvents && message.toolEvents.length > 0 && (
              <div className="mb-2 space-y-1">
                {message.toolEvents.map((event, i) => (
                  <ToolEventBadge key={i} event={event} />
                ))}
              </div>
            )}
            {/* Text content */}
            {message.content && (
              <div className="bg-gray-100 text-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm whitespace-pre-wrap">
                {message.content}
              </div>
            )}
            {/* Loading indicator */}
            {!message.content && (!message.toolEvents || message.toolEvents.length === 0) && (
              <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-tl-sm">
                <Loader2 size={14} className="animate-spin text-gray-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  manage_schema: '資料結構',
  manage_ui: '介面',
  query_data: '資料查詢',
};

function ToolEventBadge({ event }: { event: ToolEvent }) {
  const label = TOOL_LABELS[event.tool] ?? event.tool;

  if (event.type === 'tool_start') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Wrench size={11} className="animate-pulse" />
        <span>更新{label}中...</span>
      </div>
    );
  }

  if (event.type === 'tool_result') {
    const ok = event.result?.success;
    return (
      <div className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-red-500'}`}>
        {ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
        <span>{event.result?.message}</span>
      </div>
    );
  }

  return null;
}
