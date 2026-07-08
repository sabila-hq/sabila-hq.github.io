import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Cpu, Plus, Trash2, MessageSquare, Download, Copy, Edit2, Save } from 'lucide-react';
import { translations } from '../translations';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PrdBlock = ({ initialContent }: { initialContent: string }) => {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PRD.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline)', overflow: 'hidden', margin: '1rem 0' }}>
      <div style={{ background: 'var(--surface-container-low)', padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline)' }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>📄 PRD.md</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setIsEditing(!isEditing)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            {isEditing ? <Save size={14} /> : <Edit2 size={14} />} {isEditing ? 'Save Preview' : 'Edit'}
          </button>
          <button onClick={handleCopy} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={handleDownload} className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <Download size={14} /> Download
          </button>
        </div>
      </div>
      <div style={{ padding: '1rem', background: 'var(--surface-container)', maxHeight: '400px', overflowY: 'auto' }}>
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', minHeight: '300px', background: 'transparent', border: 'none', color: 'var(--on-surface)', resize: 'vertical', outline: 'none', fontFamily: 'var(--font-mono)' }}
          />
        ) : (
          <div className="markdown-body" style={{ color: 'var(--on-surface)', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

interface ChatMessage {
  id?: number;
  role: string;
  content: string;
  tool_calls?: string;
  tool_call_id?: string;
}

interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export const AiChat: React.FC<{ lang?: string }> = ({ lang = 'en' }) => {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [projects, setProjects] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState({ active: false, text: '', position: 0 });
  
  const handleMentionSelect = (projectName: string) => {
    const beforeText = input.slice(0, mentionQuery.position);
    const afterText = input.slice(mentionQuery.position + mentionQuery.text.length + 1);
    setInput(beforeText + '@' + projectName + ' ' + afterText);
    setMentionQuery({ active: false, text: '', position: 0 });
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();

    const fetchProjects = async () => {
      try {
        // @ts-ignore
        const prjs = await window.api.getProjects();
        setProjects([{ id: 'system-sabila', name: '.sabila', url: 'system', path: 'C:\\sabila\\.sabila' }, ...prjs]);
      } catch (e) {}
    };
    fetchProjects();

    const handleFixAi = (e: any) => {
      const errorText = e.detail;
      const prompt = `${t.ai_chat_fix_error}\n\n\`\`\`\n${errorText}\n\`\`\``;
      setPendingPrompt(prompt);
    };
    window.addEventListener('trigger-ai-fix', handleFixAi);
    return () => window.removeEventListener('trigger-ai-fix', handleFixAi);
  }, [lang]);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const [editingConvoId, setEditingConvoId] = useState<number | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  const loadConversations = async () => {
    try {
      // @ts-ignore
      const convos = await window.api.chatListConversations();
      setConversations(convos);
    } catch { /* ignore */ }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      // @ts-ignore
      const msgs = await window.api.chatGetMessages(conversationId);
      // Filter only user and assistant messages for display
      setMessages(msgs.filter((m: ChatMessage) => m.role === 'user' || (m.role === 'assistant' && m.content)));
    } catch { /* ignore */ }
  };

  const handleNewChat = async () => {
    try {
      // @ts-ignore
      const convo = await window.api.chatCreateConversation();
      setConversations(prev => [convo, ...prev]);
      setActiveConversationId(convo.id);
      setMessages([]);
    } catch { /* ignore */ }
  };

  const handleSelectConversation = async (id: number) => {
    if (editingConvoId === id) return; // Prevent selection while editing
    setActiveConversationId(id);
    await loadMessages(id);
  };

  const handleRenameConversation = async (id: number) => {
    if (!editTitleInput.trim() || editTitleInput === conversations.find(c => c.id === id)?.title) {
      setEditingConvoId(null);
      return;
    }
    try {
      // @ts-ignore
      await window.api.chatUpdateTitle(id, editTitleInput.trim());
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editTitleInput.trim() } : c));
      setEditingConvoId(null);
    } catch { /* ignore */ }
  };

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t.ai_chat_delete_confirm)) return;
    try {
      // @ts-ignore
      await window.api.chatDeleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch { /* ignore */ }
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : input;
    if (!textToSend.trim() || isLoading) return;

    let convId = activeConversationId;

    // Auto-create conversation if none active
    if (!convId) {
      try {
        // @ts-ignore
        const convo = await window.api.chatCreateConversation(textToSend.trim().slice(0, 50));
        convId = convo.id;
        setActiveConversationId(convo.id);
        setConversations(prev => [convo, ...prev]);
      } catch { return; }
    }

    const userContent = textToSend.trim();
    setMessages(prev => [...prev, { role: 'user', content: userContent }]);
    if (typeof overrideText !== 'string') setInput('');
    setIsLoading(true);

    try {
      // @ts-ignore
      const reply = await window.api.sendAiMessage(convId, userContent);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      // Auto-rename first conversation
      if (conversations.find(c => c.id === convId)?.title === 'New Chat') {
        const autoTitle = userContent.slice(0, 40) + (userContent.length > 40 ? '...' : '');
        // @ts-ignore
        await window.api.chatUpdateTitle(convId, autoTitle);
        loadConversations();
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pendingPrompt && !isLoading) {
      handleSend(pendingPrompt);
      setPendingPrompt(null);
    }
  }, [pendingPrompt, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery.active && e.key === 'Enter') {
      e.preventDefault();
      const filtered = projects.filter(p => p.name.toLowerCase().includes(mentionQuery.text.toLowerCase()));
      if (filtered.length > 0) {
        handleMentionSelect(filtered[0].name);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
      handleSend();
    }
  };


  return (
    <div className="page-container" style={{ position: 'relative' }}>
      <div className="page-header" style={{ marginBottom: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="btn-secondary" 
          style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Toggle Sidebar"
        >
          <MessageSquare size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--on-surface)', fontWeight: 800 }}>🤖 {t.ai_assistant}</h1>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', color: 'var(--text-muted)' }}>{t.ai_assistant_desc}</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '1rem', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {/* Conversation Sidebar */}
        <div className="glass-panel" style={{
          width: isSidebarOpen ? '260px' : '0px', 
          opacity: isSidebarOpen ? 1 : 0,
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', borderRadius: 'var(--radius-lg)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderWidth: isSidebarOpen ? '1px' : '0px',
          padding: isSidebarOpen ? undefined : '0',
          position: window.innerWidth <= 768 ? 'absolute' : 'relative',
          zIndex: 10,
          height: '100%',
          left: 0,
          background: window.innerWidth <= 768 ? 'var(--background)' : 'var(--surface-container-low)',
          boxShadow: (window.innerWidth <= 768 && isSidebarOpen) ? 'var(--shadow-md)' : 'none'
        }}>
          <button
            className="btn-primary"
            onClick={handleNewChat}
            style={{ margin: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', padding: '0.6rem' }}
          >
            <Plus size={16} /> {t.ai_chat_new}
          </button>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem 0.5rem', scrollbarWidth: 'thin' }}>
            {conversations.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-body)' }}>
                {t.ai_chat_history_empty}
              </p>
            )}
            {conversations.map(convo => (
              <div
                key={convo.id}
                onClick={() => handleSelectConversation(convo.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: activeConversationId === convo.id ? 'var(--primary-container)' : 'transparent',
                  border: activeConversationId === convo.id ? '1px solid var(--primary)' : '1px solid transparent',
                  transition: 'all 0.15s ease', marginBottom: '0.25rem',
                  fontSize: '0.85rem', color: activeConversationId === convo.id ? 'var(--on-primary-container)' : 'var(--on-surface)',
                  fontFamily: 'var(--font-body)'
                }}
                onMouseEnter={e => { if (activeConversationId !== convo.id) e.currentTarget.style.background = 'var(--surface-container-high)'; }}
                onMouseLeave={e => { if (activeConversationId !== convo.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <MessageSquare size={14} style={{ flexShrink: 0, opacity: activeConversationId === convo.id ? 1 : 0.6 }} />
                
                {editingConvoId === convo.id ? (
                  <input
                    type="text"
                    value={editTitleInput}
                    onChange={(e) => setEditTitleInput(e.target.value)}
                    onBlur={() => handleRenameConversation(convo.id)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') handleRenameConversation(convo.id);
                      if (e.key === 'Escape') {
                        setEditingConvoId(null);
                      }
                    }}
                    autoFocus
                    style={{
                      flex: 1, minWidth: 0, background: 'transparent', color: 'inherit',
                      border: '1px dashed var(--primary)', borderRadius: '4px',
                      padding: '2px 6px', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                ) : (
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: activeConversationId === convo.id ? 600 : 400 }}>
                    {convo.title}
                  </span>
                )}

                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingConvoId(convo.id);
                      setEditTitleInput(convo.title);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.4, color: activeConversationId === convo.id ? 'var(--on-primary-container)' : 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                    title={t.ai_chat_rename}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(convo.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.4, color: activeConversationId === convo.id ? 'var(--on-primary-container)' : 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                    title={t.ai_chat_delete}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.3s ease', minHeight: 0 }}>
          
          {!activeConversationId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', textAlign: 'center', overflowY: 'auto' }}>
              <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '2px solid var(--primary)', flexShrink: 0 }}>
                  <Bot size={40} color="var(--primary)" />
                </div>
                <h2 style={{ marginBottom: '1rem', color: 'var(--on-surface)', fontFamily: 'var(--font-heading)' }}>
                  {lang === 'id' ? 'SABIL.AI' : 'SABIL.AI'}
                </h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '2rem', lineHeight: '1.6', fontFamily: 'var(--font-body)' }}>
                  {t.ai_chat_hero_desc}
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', width: '100%', marginBottom: '2rem' }}>
                  <div className="glass-card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
                    <Cpu size={24} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>Server DevOps</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.ai_chat_hero_devops}</p>
                  </div>
                  <div className="glass-card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
                    <MessageSquare size={24} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>Database Master</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.ai_chat_hero_db}</p>
                  </div>
                  <div className="glass-card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
                    <Bot size={24} color="#10b981" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--on-surface)' }}>Security & Code</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{t.ai_chat_hero_sec}</p>
                  </div>
                </div>

                <button onClick={handleNewChat} className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <Plus size={20} /> {t.ai_chat_start_new}
                </button>
              </div>
            </div>
          ) : (
            <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', scrollbarWidth: 'thin' }}>


            {messages.map((msg, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: '1rem',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}>
                {msg.role !== 'user' && (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: msg.content.startsWith('❌') ? 'var(--error-container)' : 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: msg.content.startsWith('❌') ? '1px solid var(--error)' : '1px solid var(--primary)' }}>
                    <Bot size={18} color={msg.content.startsWith('❌') ? 'var(--error)' : "var(--primary)"} />
                  </div>
                )}

                <div style={{
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--surface-container)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--outline)',
                  padding: '1rem',
                  borderRadius: msg.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  color: msg.role === 'user' ? 'var(--on-primary)' : 'var(--on-surface)',
                  lineHeight: '1.6',
                  boxShadow: 'var(--shadow-sm)',
                  fontFamily: 'var(--font-body)'
                }}>
                  <div style={{ margin: 0, color: 'inherit', width: '100%', overflowX: 'auto' }}>
                    {msg.role === 'user' ? (
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0, color: '#ffffff', fontWeight: 500 }}>{msg.content}</p>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code(props) {
                            const { children, className, node, ...rest } = props;
                            const match = /language-(\w+)/.exec(className || '');
                            if (match && match[1] === 'prd') {
                              return <PrdBlock initialContent={String(children).replace(/\n$/, '')} />;
                            }
                            // Default code block
                            const isInline = !match && !String(children).includes('\n');
                            return isInline ? (
                              <code {...rest} className={className} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                                {children}
                              </code>
                            ) : (
                              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                <code {...rest} className={className}>
                                  {children}
                                </code>
                              </pre>
                            );
                          },
                          p({ children }) {
                            return <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>{children}</p>;
                          },
                          a({ href, children }) {
                            return <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{children}</a>;
                          },
                          table({ children }) {
                            return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', marginBottom: '1rem' }}>{children}</table></div>;
                          },
                          th({ children }) {
                            return <th style={{ border: '1px solid var(--outline)', padding: '0.5rem', background: 'var(--surface-container-high)' }}>{children}</th>;
                          },
                          td({ children }) {
                            return <td style={{ border: '1px solid var(--outline)', padding: '0.5rem' }}>{children}</td>;
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', gap: '1rem', alignSelf: 'flex-start', maxWidth: '80%' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--primary)' }}>
                  <Bot size={18} color="var(--primary)" />
                </div>
                <div style={{ background: 'var(--surface-container)', border: '1px solid var(--outline)', padding: '1rem', borderRadius: '16px 16px 16px 0', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-body)' }}>
                  <Loader2 size={16} className="spin-animation" /> <span>{t.ai_thinking || 'AI is thinking...'}</span>
                </div>
              </div>
            )}

          </div>
          )}

          {/* Chat Input */}
          <div style={{ 
            display: activeConversationId ? 'block' : 'none',
            padding: '1rem 1.5rem', borderTop: '1px solid var(--outline)', 
            background: 'var(--surface-container)', 
            borderBottomLeftRadius: 'var(--radius-lg)',
            borderBottomRightRadius: 'var(--radius-lg)'
          }}>
            <div style={{ position: 'relative' }}>
              {mentionQuery.active && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '1rem', marginBottom: '0.5rem',
                  background: 'var(--surface-container-high)', border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-md)', maxHeight: '200px', overflowY: 'auto',
                  zIndex: 50, boxShadow: 'var(--shadow-md)', minWidth: '250px'
                }}>
                  <div style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--outline)' }}>
                    {t.ai_chat_tag_project}
                  </div>
                  {projects.filter(p => p.name.toLowerCase().includes(mentionQuery.text.toLowerCase())).map(p => (
                    <div 
                      key={p.id} onClick={() => handleMentionSelect(p.name)}
                      style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: 'var(--on-surface)', borderBottom: '1px solid var(--outline)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-body)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-container-highest)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Cpu size={14} color="var(--primary)" />
                      <span>@{p.name}</span>
                    </div>
                  ))}
                  {projects.filter(p => p.name.toLowerCase().includes(mentionQuery.text.toLowerCase())).length === 0 && (
                     <div style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>
                       {t.ai_chat_project_not_found}
                     </div>
                  )}
                </div>
              )}
              <textarea
                className="input-glass"
                placeholder={t.ask_ai || "Tanya AI tentang error, config, atau project..."}
                value={input}
                onChange={(e) => {
                  const val = e.target.value;
                  setInput(val);
                  const cursor = e.target.selectionStart;
                  const textBefore = val.slice(0, cursor);
                  const match = textBefore.match(/@([\w-]*)$/);
                  if (match) {
                    setMentionQuery({ active: true, text: match[1], position: cursor - match[1].length - 1 });
                  } else {
                    setMentionQuery({ active: false, text: '', position: 0 });
                  }
                }}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%', minHeight: '50px', maxHeight: '150px',
                  padding: '12px 100px 12px 16px', resize: 'none', overflowY: 'auto',
                  color: 'var(--on-surface)', backgroundColor: 'var(--surface-container-low)',
                  fontSize: '0.95rem', lineHeight: '1.5',
                  border: '1px solid var(--primary)',
                  fontFamily: 'var(--font-body)',
                  borderRadius: 'var(--radius-pill)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />
              <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} title="Attach Log">
                  <Cpu size={16} />
                </button>
                <button className="btn-primary" style={{ padding: '0.4rem 0.6rem' }} onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
