import React, { useState, useEffect } from 'react';
import { Clock, Plus, Play, Square, Trash2, Edit, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { translations } from '../translations';

export const CronPage: React.FC<{ lang?: string, embedded?: boolean }> = ({ lang = 'en', embedded = false }) => {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    cwd: '',
    schedule: '* * * * *'
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await (window as any).api.cronGetTasks();
      setTasks(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await (window as any).api.cronToggleTask(id, active);
    loadTasks();
  };

  const handleRunNow = async (id: string) => {
    const originalTasks = [...tasks];
    setTasks(tasks.map(t => t.id === id ? { ...t, lastStatus: 'running' } : t));
    try {
      await (window as any).api.cronRunNow(id);
    } catch (e) {}
    loadTasks();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this cron job?')) {
      await (window as any).api.cronDeleteTask(id);
      loadTasks();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await (window as any).api.cronAddTask(formData);
    setShowModal(false);
    setFormData({ name: '', command: '', cwd: '', schedule: '* * * * *' });
    loadTasks();
  };

  return (
    <div className={embedded ? "" : "page-container"} style={embedded ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}>
      {!embedded && (
        <div className="page-header" style={{ flexShrink: 0 }}>
          <h1><Clock size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Task & Cron Runner</h1>
          <p>Schedule and monitor local background tasks.</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
        <div></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={loadTasks}><RefreshCw size={14} /></button>
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Plus size={14} /> Add Cron Job
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Loading...</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
            <Clock size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No scheduled tasks yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {tasks.map(task => (
              <div key={task.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: task.active ? 'var(--status-running)' : 'var(--status-stopped)',
                      boxShadow: task.active ? '0 0 10px var(--status-running)' : 'none'
                    }} />
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{task.name}</h3>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {task.schedule}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className={task.active ? "btn-secondary" : "btn-primary"} 
                      onClick={() => handleToggle(task.id, !task.active)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      {task.active ? <Square size={12} style={{ marginRight: '0.3rem' }} /> : <Play size={12} style={{ marginRight: '0.3rem' }} />}
                      {task.active ? 'Stop' : 'Start'}
                    </button>
                    <button className="btn-secondary" onClick={() => handleRunNow(task.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                      Run Now
                    </button>
                    <button className="btn-secondary" onClick={() => handleDelete(task.id)} style={{ padding: '0.3rem 0.4rem', color: '#ef4444' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '6px' }}>
                  $ {task.command}
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>Dir: {task.cwd}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    Status: 
                    {task.lastStatus === 'running' && <span style={{ color: 'var(--brand-blue)' }}><RefreshCw size={12} className="spin" style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />Running</span>}
                    {task.lastStatus === 'success' && <span style={{ color: 'var(--status-running)' }}><CheckCircle size={12} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />Success</span>}
                    {task.lastStatus === 'error' && <span style={{ color: 'var(--status-error)' }}><XCircle size={12} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />Failed</span>}
                    {!task.lastStatus && <span style={{ color: 'var(--text-muted)' }}>Never run</span>}
                  </div>
                  {task.lastRun && <div style={{ color: 'var(--text-muted)' }}>Last run: {new Date(task.lastRun).toLocaleString()}</div>}
                </div>

                {task.lastOutput && (
                  <pre style={{ margin: '0.5rem 0 0 0', padding: '0.75rem', background: '#1e1e1e', color: '#d4d4d4', borderRadius: '6px', fontSize: '0.75rem', maxHeight: '150px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {task.lastOutput}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form className="glass-panel" onSubmit={handleSubmit} style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Add Cron Job</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Task Name</label>
              <input required type="text" className="input-glass" style={{ width: '100%', padding: '0.5rem' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Daily Backup" />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Command</label>
              <input required type="text" className="input-glass" style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }} value={formData.command} onChange={e => setFormData({...formData, command: e.target.value})} placeholder="e.g. php artisan schedule:run" />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Working Directory</label>
              <input required type="text" className="input-glass" style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }} value={formData.cwd} onChange={e => setFormData({...formData, cwd: e.target.value})} placeholder="C:\laragon\www\project" />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cron Schedule</label>
              <input required type="text" className="input-glass" style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace' }} value={formData.schedule} onChange={e => setFormData({...formData, schedule: e.target.value})} placeholder="* * * * *" />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Minute Hour Day Month DayOfWeek</div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Task</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
