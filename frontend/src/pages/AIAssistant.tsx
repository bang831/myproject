import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Send, Loader2, Zap, AlertTriangle, RefreshCw,
  Sparkles, X, ChevronDown,
} from 'lucide-react';

interface AIAssistantProps {
  projectId?: string;
  appId?: string;
  projectName?: string;
}

const token = () => localStorage.getItem('deployflow_token');

interface Message {
  role: 'user' | 'assistant';
  content: string;
  keyUsed?: number;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-indigo-500/20' : 'bg-purple-500/20'}`}>
        {isUser ? <span className="text-xs">👤</span> : <Bot size={14} className="text-purple-400"/>}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser ? 'bg-indigo-500/20 border border-indigo-500/20 text-white' : 'bg-white/[0.04] border border-white/[0.08] text-gray-300'
      }`}>
        {/* Render markdown sederhana */}
        {msg.content.split('\n').map((line, i) => {
          if (line.startsWith('**') && line.endsWith('**')) {
            return <p key={i} className="font-semibold text-white my-1">{line.slice(2,-2)}</p>;
          }
          if (line.startsWith('```')) return null;
          if (line.match(/^\d+\./)) {
            return <p key={i} className="my-0.5 ml-2">{line}</p>;
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return <p key={i} className="my-0.5 ml-2">• {line.slice(2)}</p>;
          }
          if (line.trim() === '') return <br key={i}/>;
          return <p key={i}>{line}</p>;
        })}
        {msg.keyUsed && (
          <p className="text-xs text-gray-600 mt-2">via Groq API Key {msg.keyUsed}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function AIAssistant({ projectId, appId, projectName }: AIAssistantProps) {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [configured, setConfigured] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/ai/status', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => setConfigured(d.configured)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          message: input,
          appId,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, keyUsed: data.keyUsed }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ ' + (data.error || 'Gagal.') }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Gagal terhubung ke AI.' }]);
    } finally {
      setLoading(false);
    }
  };

  const analyzeProject = async () => {
    if (!appId || analyzing) return;
    setAnalyzing(true);
    setMessages(prev => [...prev, { role: 'user', content: `🔍 Analisis project "${projectName || appId}"` }]);

    try {
      const res = await fetch(`/api/ai/analyze/${appId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.analysis) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.analysis, keyUsed: data.keyUsed }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ ' + (data.error || 'Gagal analisis.') }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Gagal analisis.' }]);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!configured) {
    return (
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
        <Bot size={32} className="text-purple-400 mx-auto mb-3"/>
        <h3 className="text-sm font-semibold text-white mb-2">AI Assistant</h3>
        <p className="text-xs text-gray-500 mb-4">Konfigurasi Groq API Key di Settings untuk menggunakan fitur AI.</p>
        <a href="/dashboard" className="text-xs text-indigo-400 hover:underline">Pergi ke Settings →</a>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden" style={{ height: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-purple-500/5">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-purple-400"/>
          <span className="text-sm font-medium text-white">AI Assistant</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            llama-3.3-70b
          </span>
        </div>
        <div className="flex items-center gap-2">
          {appId && (
            <button onClick={analyzeProject} disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-40 transition-all">
              {analyzing ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12}/>}
              {analyzing ? 'Menganalisis...' : 'Analisis Project'}
            </button>
          )}
          <button onClick={() => setMessages([])} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600 hover:text-white">
            <RefreshCw size={13}/>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles size={32} className="text-purple-400/30 mb-3"/>
            <p className="text-sm text-gray-600">Tanya apapun tentang project kamu</p>
            {appId && (
              <button onClick={analyzeProject} disabled={analyzing}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-400 hover:bg-yellow-500/20 transition-all">
                <Zap size={14}/>
                Analisis masalah otomatis
              </button>
            )}
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} msg={msg}/>)
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Bot size={14} className="text-purple-400"/>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-purple-400"
                    animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i*0.15 }}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Tanya sesuatu... (Enter untuk kirim, Shift+Enter untuk baris baru)"
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none leading-relaxed"
            style={{ maxHeight: '120px' }}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 disabled:opacity-40 transition-all">
            <Send size={16}/>
          </button>
        </div>
      </div>
    </div>
  );
}
