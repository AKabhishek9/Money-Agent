'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency } from '@/lib/utils';
import { Bot, Send, Sparkles, User as UserIcon, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAdvisorPage() {
  const { user } = useAuth();
  const { sections, transactions } = useData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false); // Debounce guard

  // Build context from DataContext data (no duplicate fetch)
  useEffect(() => {
    if (!sections.length && !transactions.length) return;
    const totalBalance = sections.reduce((s, sec) => s + sec.balance, 0);
    const now = new Date();
    const monthTx = transactions.filter(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const mIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const mExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const catMap: Record<string, number> = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category || 'Other'] = (catMap[t.category || 'Other'] || 0) + t.amount;
    });

    const ctx = `
Total Balance: ${formatCurrency(totalBalance)}
Sections: ${sections.map(s => `${s.name}: ${formatCurrency(s.balance)}`).join(', ')}
This Month Income: ${formatCurrency(mIncome)}
This Month Expenses: ${formatCurrency(mExpense)}
Net Savings: ${formatCurrency(mIncome - mExpense)}
Top Expense Categories: ${Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${formatCurrency(v)}`).join(', ') || 'None'}
Recent Transactions: ${transactions.slice(0, 10).map(t => `${t.type} ${formatCurrency(t.amount)} (${t.category || t.note || '-'})`).join('; ')}
    `.trim();
    setContext(ctx);
  }, [sections, transactions]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || !user || sendingRef.current) return;
    sendingRef.current = true;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Get Firebase ID Token for secure API call
      const idToken = await user.getIdToken();

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ message: userMsg, context }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'No response' }]);
    } catch (err: any) {
      console.error('AI Advisor error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || 'Failed to connect to AI service.' }]);
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }, [input, loading, user, context]);

  const suggestions = [
    'Analyze my spending this month',
    'How can I save more money?',
    'Which categories should I cut back on?',
    'Create a budget plan for me',
    'Am I spending too much on food?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Bot size={24} style={{ color: 'var(--accent-primary)' }} /> AI Financial Advisor
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Get personalized financial insights powered by Gemini AI
        </p>
      </div>

      {/* Chat Area */}
      <div ref={chatRef} className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>How can I help you today?</h2>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Ask me anything about your finances</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {suggestions.map(s => (
                <button key={s} onClick={() => { setInput(s); }} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'}`}
                style={{
                  background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
                }}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
                  <UserIcon size={16} style={{ color: 'var(--text-secondary)' }} />
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Bot size={16} className="text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-3 pt-4 border-t border-[var(--border-subtle)]">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about your finances..."
          className="input-field flex-1"
          disabled={loading}
          id="ai-input"
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary px-4" id="ai-send">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
