import React, { useState, useEffect } from 'react';
import { Database as DbIcon, Table, Play, RefreshCw, AlertCircle, PlayCircle, Code, Download, Info, History, RotateCcw, Camera, GitPullRequest, Server, Copy, Trash2, Search, ChevronLeft, ChevronRight, Filter, Upload } from 'lucide-react';
import { translations } from '../translations';
import { DatabaseVisualizer } from '../components/DatabaseVisualizer';
import { FileSpecification } from '../components/FileSpecification';

interface DatabaseProps {
  lang: string;
}

export const DatabasePage: React.FC<DatabaseProps> = ({ lang }) => {
  const t = (translations as any)[lang] || translations.id;

  const [connected, setConnected] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [isMysqlRunning, setIsMysqlRunning] = useState(true);
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<{ isSelect?: boolean, columns?: string[], rows?: any[], affectedRows?: number, insertId?: number, message?: string } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  const [activeMainTab, setActiveMainTab] = useState<'query' | 'snapshots' | 'diffing' | 'visualisasi' | 'spesifikasi'>('query');
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [snapshotSearchQuery, setSnapshotSearchQuery] = useState('');
  const [snapshotSort, setSnapshotSort] = useState<'date_desc' | 'date_asc' | 'size_desc' | 'size_asc'>('date_desc');
  const [snapshotPage, setSnapshotPage] = useState(1);
  const snapshotPerPage = 10;

  const [diffConfig, setDiffConfig] = useState({ host: '', user: '', password: '', port: 3306, database: '' });
  const [diffResult, setDiffResult] = useState<{ localOnly: string[], remoteOnly: string[], different: { table: string, diff: string }[] } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const [detailedSchema, setDetailedSchema] = useState<{ database_name: string, tables: any[] } | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const [dbConfig, setDbConfig] = useState({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    port: 3306
  });

  useEffect(() => {
    const init = async () => {
      try {
        const services = await (window as any).api.getServices();
        if (services.mysql) {
          setIsMysqlRunning(services.mysql.status === 'running');
          if (services.mysql.port) {
            setDbConfig(prev => ({ ...prev, port: services.mysql.port }));
          }
          if (services.mysql.status === 'running') {
            await handleConnect(services.mysql.port);
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setInitialLoading(false);
      }
    };
    init();
    
    return () => {
      (window as any).api.dbDisconnect();
    };
  }, []);

  const handleConnect = async (optionalPort?: number) => {
    setConnecting(true);
    let portToUse = optionalPort || dbConfig.port;
    if (!optionalPort) {
      try {
        const services = await (window as any).api.getServices();
        if (services.mysql && services.mysql.port) {
          portToUse = services.mysql.port;
          setDbConfig(prev => ({ ...prev, port: portToUse }));
        }
      } catch (e) {
        // ignore
      }
    }

    const res = await (window as any).api.dbConnect({ ...dbConfig, port: portToUse });
    setConnecting(false);
    if (res.success) {
      setConnected(true);
      fetchDatabases();
    } else {
      setConnected(false);
      setQueryError(`${t.db_conn_failed}: ${res.error}. ${t.db_conn_check_dashboard}`);
    }
  };

  const fetchDatabases = async () => {
    const res = await (window as any).api.dbGetDatabases();
    if (res.success) {
      setDatabases(res.data);
      setSelectedDb(null);
    }
  };

  const fetchTables = async (db: string) => {
    setSelectedDb(db);
    setSelectedTable(null);
    setQueryResult(null);
    setQueryError(null);
    const res = await (window as any).api.dbGetTables(db);
    if (res.success) {
      setTables(res.data);
    }
  };

  const executeQuery = async (sqlToRun: string) => {
    if (!sqlToRun.trim()) return;
    setQuerying(true);
    setQueryError(null);
    setQueryResult(null);
    const res = await (window as any).api.dbQuery(sqlToRun);
    setQuerying(false);
    if (res.success) {
      setQueryResult(res.data);
    } else {
      setQueryError(res.error);
    }
  };

  const viewTable = (table: string) => {
    setSelectedTable(table);
    const sql = `SELECT * FROM \`${table}\` LIMIT 100`;
    setQuery(sql);
    executeQuery(sql);
  };

  const exportToCSV = () => {
    if (!queryResult || !queryResult.isSelect || !queryResult.rows || queryResult.rows.length === 0 || !queryResult.columns) return;
    const headers = queryResult.columns.join(',');
    const csvRows = queryResult.rows.map(row => {
      return queryResult.columns!.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape quotes
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',');
    }).join('\n');
    
    const csvContent = headers + '\n' + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `query_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchSnapshots = async () => {
    try {
      setSnapshotLoading(true);
      const res = await (window as any).api.dbListSnapshots(selectedDb || undefined);
      if (res && res.success) {
        setSnapshots(res.data);
      } else {
        setSnapshots([]);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!selectedDb) {
      alert('${t.db_alert_select_db}');
      return;
    }
    try {
      setSnapshotLoading(true);
      const res = await (window as any).api.dbCreateSnapshot(selectedDb, dbConfig.port);
      if (res && res.success) {
        await fetchSnapshots();
        alert('${t.db_alert_snap_created}');
      } else {
        alert('${t.db_alert_snap_create_failed} ' + (res?.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error(e);
      alert('${t.db_alert_snap_create_error} ' + e.message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleRestoreSnapshot = async (filename: string) => {
    if (!confirm('${t.db_alert_snap_restore_confirm}')) return;
    try {
      setSnapshotLoading(true);
      const res = await (window as any).api.dbRestoreSnapshot(filename, dbConfig.port);
      if (res && res.success) {
        alert('${t.db_alert_snap_restored}');
      } else {
        alert('${t.db_alert_snap_restore_failed} ' + (res?.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error(e);
      alert('${t.db_alert_snap_restore_error} ' + e.message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleCopySnapshot = async (filename: string) => {
    try {
      setSnapshotLoading(true);
      const res = await (window as any).api.dbCopySnapshot(filename, undefined, dbConfig.port);
      if (res && res.success) {
        alert('${t.db_alert_snap_copied} ' + res.newDatabase + '!');
        fetchDatabases();
      } else {
        alert('${t.db_alert_snap_copy_failed} ' + (res?.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error(e);
      alert('${t.db_alert_snap_copy_error} ' + e.message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleExportSnapshot = async (filename: string) => {
    try {
      const res = await (window as any).api.dbExportSnapshot(filename);
      if (res && res.success) {
        alert('${t.db_alert_snap_exported}');
      } else if (res && !res.canceled) {
        alert('${t.db_alert_snap_export_failed} ' + (res.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error(e);
      alert('${t.db_alert_snap_export_error} ' + e.message);
    }
  };

  const handleExportSql = async () => {
    if (!selectedDb) {
      alert(t.db_alert_select_db || 'Pilih database terlebih dahulu');
      return;
    }
    try {
      const res = await (window as any).api.dbExportSql(selectedDb, dbConfig.port);
      if (res && res.success) {
        alert('Database berhasil diekspor ke SQL!');
      } else if (res && !res.canceled) {
        alert('Gagal mengekspor: ' + (res.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error(e);
      alert('Error saat ekspor: ' + e.message);
    }
  };

  const handleImportSql = async () => {
    if (!selectedDb) {
      alert(t.db_alert_select_db || 'Pilih database terlebih dahulu');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin mengimpor SQL ke dalam database '${selectedDb}'? Tindakan ini dapat menimpa data yang ada.`)) return;
    
    try {
      const res = await (window as any).api.dbImportSql(selectedDb, dbConfig.port);
      if (res && res.success) {
        alert('File SQL berhasil diimpor!');
        fetchTables(selectedDb); // Refresh tables
      } else if (res && !res.canceled) {
        alert('Gagal mengimpor: ' + (res.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error(e);
      alert('Error saat impor: ' + e.message);
    }
  };

  const handleDeleteSnapshot = async (filename: string) => {
    if (!confirm('${t.db_alert_snap_delete_confirm}')) return;
    try {
      setSnapshotLoading(true);
      const res = await (window as any).api.dbDeleteSnapshot(filename);
      if (res && res.success) {
        await fetchSnapshots();
      } else {
        alert('${t.db_alert_snap_delete_failed} ' + (res?.error || 'Unknown error'));
      }
    } catch (e: any) {
      console.error(e);
      alert('${t.db_alert_snap_delete_error} ' + e.message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleDiff = async () => {
    if (!selectedDb) return alert(t.db_alert_diff_select_local);
    if (!diffConfig.host || !diffConfig.database) return alert(t.db_alert_diff_fill_remote);
    try {
      setDiffLoading(true);
      const resLocal = await (window as any).api.dbGetSchema(dbConfig, selectedDb);
      const resRemote = await (window as any).api.dbGetSchema(diffConfig, diffConfig.database);
      
      if (!resLocal.success) throw new Error('Local: ' + resLocal.error);
      if (!resRemote.success) throw new Error('Remote: ' + resRemote.error);

      const localSchema = resLocal.schema;
      const remoteSchema = resRemote.schema;
      
      const localTables = Object.keys(localSchema);
      const remoteTables = Object.keys(remoteSchema);
      
      const localOnly = localTables.filter(t => !remoteTables.includes(t));
      const remoteOnly = remoteTables.filter(t => !localTables.includes(t));
      const different: { table: string, diff: string }[] = [];
      
      for (const t of localTables) {
        if (remoteTables.includes(t) && localSchema[t] !== remoteSchema[t]) {
          different.push({ table: t, diff: 'Schema structure differs' });
        }
      }
      
      setDiffResult({ localOnly, remoteOnly, different });
    } catch (e: any) {
      alert(t.db_alert_diff_error + ' ' + e.message);
    } finally {
      setDiffLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'snapshots') {
      fetchSnapshots();
      setSnapshotPage(1);
    } else if (activeMainTab === 'visualisasi' || activeMainTab === 'spesifikasi') {
      if (selectedDb) {
        fetchDetailedSchema();
      }
    }
  }, [activeMainTab, selectedDb]);

  const fetchDetailedSchema = async () => {
    if (!selectedDb) return;
    setSchemaLoading(true);
    try {
      const res = await (window as any).api.dbGetDetailedSchema(dbConfig, selectedDb);
      if (res && res.success) {
        setDetailedSchema(res.schema);
      } else {
        setDetailedSchema(null);
        console.error('Failed to get schema:', res?.error);
      }
    } catch (e) {
      console.error(e);
      setDetailedSchema(null);
    } finally {
      setSchemaLoading(false);
    }
  };

  const filteredSnapshots = snapshots.filter(s => 
    s.filename.toLowerCase().includes(snapshotSearchQuery.toLowerCase())
  ).sort((a, b) => {
    if (snapshotSort === 'date_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (snapshotSort === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (snapshotSort === 'size_desc') return b.size - a.size;
    if (snapshotSort === 'size_asc') return a.size - b.size;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSnapshots.length / snapshotPerPage));
  const paginatedSnapshots = filteredSnapshots.slice((snapshotPage - 1) * snapshotPerPage, snapshotPage * snapshotPerPage);

  if (initialLoading) {
    return (
      <div className="page-container" style={{ justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="spinner" style={{ marginBottom: '1rem' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Menghubungkan ke Database...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-heading)' }}>
            <DbIcon color="var(--primary)" size={32} />
            {t.db_title}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t.db_desc}</p>
        </div>
        {!connected ? (
          <div title={!isMysqlRunning ? "{t.db_mysql_not_running}" : ""}>
            <button 
              className="btn-primary" 
              onClick={() => handleConnect()} 
              disabled={connecting || !isMysqlRunning} 
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', opacity: !isMysqlRunning ? 0.5 : 1 }}
            >
              {connecting ? <RefreshCw size={18} className="spin" /> : <Play size={18} />} 
              Connect
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--status-running)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-running)' }}></div>
              Connected
            </span>
            <button className="btn-secondary" onClick={() => { setConnected(false); (window as any).api.dbDisconnect(); }}>{t.db_disconnect}</button>
          </div>
        )}
      </div>

      {!connected && queryError && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-error)', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle size={20} />
          {queryError}
        </div>
      )}

      {connected && (
        <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
          
          {/* Sidebar: Databases & Tables */}
          {showSidebar && (
            <div className="glass-panel" style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{t.db_databases}</h3>
              <button className="btn-secondary" style={{ padding: '0.25rem', background: 'transparent' }} onClick={fetchDatabases} title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {databases.map(db => {
                const isSystemDb = ['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db.toLowerCase());
                return (
                <div key={db}>
                  <div 
                    style={{ 
                      padding: '0.5rem', borderRadius: '8px', 
                      cursor: isSystemDb ? 'not-allowed' : 'pointer',
                      opacity: isSystemDb ? 0.5 : 1,
                      background: selectedDb === db ? 'var(--primary-fixed)' : 'transparent',
                      color: selectedDb === db ? 'var(--on-primary-fixed)' : 'var(--on-surface)',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      fontWeight: selectedDb === db ? 600 : 400,
                      transition: 'all 0.2s'
                    }}
                    onClick={() => !isSystemDb && fetchTables(db)}
                    title={isSystemDb ? 'System Database' : ''}
                  >
                    <DbIcon size={16} color={selectedDb === db ? 'var(--primary)' : 'var(--text-muted)'} />
                    {db}
                  </div>
                  
                  {selectedDb === db && (
                    <div style={{ paddingLeft: '1.5rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button 
                          onClick={handleExportSql}
                          title="Export SQL"
                          style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', background: 'var(--surface-container-high)', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                        >
                          <Download size={12} /> Export SQL
                        </button>
                        <button 
                          onClick={handleImportSql}
                          title="Import SQL"
                          style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', background: 'var(--surface-container-high)', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                        >
                          <Upload size={12} /> Import SQL
                        </button>
                      </div>

                      {tables.length === 0 ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.25rem' }}>{t.db_no_tables}</div>
                      ) : (
                        tables.map(tbl => (
                          <div 
                            key={tbl}
                            style={{ 
                              padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem',
                              background: selectedTable === tbl ? 'var(--surface-container)' : 'transparent',
                              color: selectedTable === tbl ? 'var(--primary)' : 'var(--text-secondary)',
                              display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                            onClick={() => viewTable(tbl)}
                          >
                            <Table size={14} />
                            {tbl}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            </div>
          )}

          {/* Main Area: Query & Results */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden', minWidth: 0 }}>
            
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <button 
                  style={{ 
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  onClick={() => setShowSidebar(!showSidebar)}
                  title={showSidebar ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
                >
                  {showSidebar ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
                <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', margin: '0 0.5rem' }}></div>
              </div>
              <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', alignItems: 'center', flex: 1 }}>
              <button 
                style={{ 
                  background: activeMainTab === 'query' ? 'var(--primary)' : 'transparent',
                  color: activeMainTab === 'query' ? 'var(--on-primary)' : 'var(--text-secondary)',
                  border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', flexShrink: 0
                }}
                onClick={() => setActiveMainTab('query')}
              >
                <Code size={16} /> Query Editor
              </button>
              <button 
                style={{ 
                  background: activeMainTab === 'snapshots' ? 'var(--primary)' : 'transparent',
                  color: activeMainTab === 'snapshots' ? 'var(--on-primary)' : 'var(--text-secondary)',
                  border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', flexShrink: 0
                }}
                onClick={() => setActiveMainTab('snapshots')}
              >
                <History size={16} /> Snapshots & Versioning
              </button>
              <button 
                style={{ 
                  background: activeMainTab === 'diffing' ? 'var(--primary)' : 'transparent',
                  color: activeMainTab === 'diffing' ? 'var(--on-primary)' : 'var(--text-secondary)',
                  border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', flexShrink: 0
                }}
                onClick={() => setActiveMainTab('diffing')}
              >
                <GitPullRequest size={16} /> Diffing Database
              </button>
              <button 
                style={{ 
                  background: activeMainTab === 'visualisasi' ? 'var(--primary)' : 'transparent',
                  color: activeMainTab === 'visualisasi' ? 'var(--on-primary)' : 'var(--text-secondary)',
                  border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', flexShrink: 0
                }}
                onClick={() => setActiveMainTab('visualisasi')}
              >
                <Server size={16} /> DB Designer
              </button>
              <button 
                style={{ 
                  background: activeMainTab === 'spesifikasi' ? 'var(--primary)' : 'transparent',
                  color: activeMainTab === 'spesifikasi' ? 'var(--on-primary)' : 'var(--text-secondary)',
                  border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', flexShrink: 0
                }}
                onClick={() => setActiveMainTab('spesifikasi')}
              >
                <Table size={16} /> Spesifikasi File
              </button>
            </div>
            </div>

            {activeMainTab === 'query' ? (
              <>
                {/* Query Editor */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '180px', flexShrink: 0 }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Code size={16} /> SQL Query
                    </span>
                    <button 
                      className="btn-primary" 
                      style={{ padding: '0.4rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                      onClick={() => executeQuery(query)}
                      disabled={querying || !query.trim()}
                    >
                      {querying ? <RefreshCw size={14} className="spin" /> : <PlayCircle size={14} />}
                      Run
                    </button>
                  </div>
                  <textarea 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SELECT * FROM table..."
                    style={{ 
                      flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', 
                      padding: '1rem', fontFamily: 'monospace', resize: 'none', outline: 'none' 
                    }}
                  />
                </div>

                {/* Query Results */}
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>
                      Results {queryResult && queryResult.isSelect && queryResult.rows && `(${queryResult.rows.length} rows)`}
                    </span>
                    {queryResult && queryResult.isSelect && queryResult.rows && queryResult.rows.length > 0 && (
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}
                        onClick={exportToCSV}
                      >
                        <Download size={14} /> Export CSV
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '0', position: 'relative' }}>
                    {queryError ? (
                      <div style={{ padding: '1.5rem', color: 'var(--status-error)' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{queryError}</pre>
                        </div>
                      </div>
                    ) : queryResult ? (
                      queryResult.isSelect && queryResult.rows && queryResult.columns ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-container)', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <tr>
                              {queryResult.columns.map(col => (
                                <th key={col} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }}>
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.rows.map((row, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--glass-border-light)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                {queryResult.columns!.map(col => (
                                  <td key={col} style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)' }}>
                                    {row[col] !== null ? String(row[col]) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>NULL</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {queryResult.rows.length === 0 && (
                              <tr>
                                <td colSpan={queryResult.columns.length || 1} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  Empty result set
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-running)', fontWeight: 500 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-running)' }}></div>
                            Query executed successfully
                          </div>
                          <div style={{ padding: '1rem', background: 'var(--surface-container)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                            <div><strong>{t.db_affected_rows}:</strong> {queryResult.affectedRows}</div>
                            {queryResult.insertId !== undefined && queryResult.insertId !== 0 && (
                              <div><strong>{t.db_insert_id}:</strong> {queryResult.insertId}</div>
                            )}
                            {queryResult.message && (
                              <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>{queryResult.message}</div>
                            )}
                          </div>
                        </div>
                      )
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        {querying ? <RefreshCw size={24} className="spin" /> : 'Run a query to see results'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : activeMainTab === 'snapshots' ? (
              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Camera size={18} /> Database Snapshots
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Buat titik pemulihan (snapshot) sebelum melakukan migrasi.
                    </p>
                  </div>
                  <button className="btn-primary" onClick={handleCreateSnapshot} disabled={snapshotLoading || !selectedDb}>
                    {snapshotLoading ? <RefreshCw size={16} className="spin" /> : <Camera size={16} />}
                    Create Snapshot
                  </button>
                </div>
                {selectedDb && (
                  <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-container)', borderRadius: '6px', padding: '0 0.5rem', flex: 1 }}>
                      <Search size={14} color="var(--text-muted)" />
                      <input 
                        type="text" 
                        placeholder={t.db_snap_search} 
                        value={snapshotSearchQuery} 
                        onChange={e => { setSnapshotSearchQuery(e.target.value); setSnapshotPage(1); }} 
                        style={{ border: 'none', background: 'transparent', padding: '0.4rem', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: '0.85rem' }} 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Filter size={14} color="var(--text-muted)" />
                      <select 
                        value={snapshotSort} 
                        onChange={e => setSnapshotSort(e.target.value as any)} 
                        style={{ border: '1px solid var(--glass-border)', background: 'var(--surface)', color: 'var(--text-primary)', padding: '0.3rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
                      >
                        <option value="date_desc">{t.db_sort_newest}</option>
                        <option value="date_asc">{t.db_sort_oldest}</option>
                        <option value="size_desc">{t.db_sort_size_desc}</option>
                        <option value="size_asc">{t.db_sort_size_asc}</option>
                      </select>
                    </div>
                  </div>
                )}
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                  {!selectedDb ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      ${t.db_alert_select_db} untuk melihat snapshot.
                    </div>
                  ) : snapshots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Belum ada snapshot untuk database ini.
                    </div>
                  ) : filteredSnapshots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Tidak ada snapshot yang cocok dengan pencarian Anda.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {paginatedSnapshots.map(snap => (
                        <div key={snap.filename} style={{ padding: '1rem', background: 'var(--surface-container)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{snap.filename}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              Dibuat: {new Date(snap.createdAt).toLocaleString()} • {t.db_snap_size} {(snap.size / 1024).toFixed(2)} KB
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn-secondary" onClick={() => handleRestoreSnapshot(snap.filename)} disabled={snapshotLoading} title="Restore" style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {snapshotLoading ? <RefreshCw size={14} className="spin" /> : <RotateCcw size={14} />} Restore
                            </button>
                            <button className="btn-secondary" onClick={() => handleCopySnapshot(snap.filename)} disabled={snapshotLoading} title="Copy to new Database" style={{ padding: '0.4rem' }}>
                              <Copy size={14} />
                            </button>
                            <button className="btn-secondary" onClick={() => handleExportSnapshot(snap.filename)} disabled={snapshotLoading} title="Export / Download" style={{ padding: '0.4rem' }}>
                              <Download size={14} />
                            </button>
                            <button className="btn-secondary" onClick={() => handleDeleteSnapshot(snap.filename)} disabled={snapshotLoading} title="Delete" style={{ padding: '0.4rem', color: 'var(--status-error)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                          <button className="btn-secondary" onClick={() => setSnapshotPage(p => Math.max(1, p - 1))} disabled={snapshotPage === 1} style={{ padding: '0.4rem' }}>
                            <ChevronLeft size={16} />
                          </button>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Halaman {snapshotPage} {t.db_snap_of} {totalPages}
                          </span>
                          <button className="btn-secondary" onClick={() => setSnapshotPage(p => Math.min(totalPages, p + 1))} disabled={snapshotPage === totalPages} style={{ padding: '0.4rem' }}>
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : activeMainTab === 'diffing' ? (
              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <GitPullRequest size={18} /> Diffing Database (Lokal vs Remote)
                  </h3>
                  <p style={{ margin: '0.25rem 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Bandingkan skema tabel {selectedDb || 'lokal'} dengan server production.
                  </p>
                  
                  <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--glass-border)', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)' }}>
                    <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Server size={18} color="var(--primary)" /> 
                      <span>{t.db_diff_remote_settings}</span>
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.db_diff_remote_host || "Remote Host / IP"}</label>
                        <input 
                          type="text" 
                          placeholder="contoh: 192.168.1.100 atau domain.com" 
                          value={diffConfig.host} 
                          onChange={e => setDiffConfig({...diffConfig, host: e.target.value})} 
                          style={{ background: 'var(--surface-container)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', width: '100%' }}
                          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.db_diff_port || "Port"}</label>
                        <input 
                          type="number" 
                          placeholder="3306" 
                          value={diffConfig.port} 
                          onChange={e => setDiffConfig({...diffConfig, port: Number(e.target.value)})} 
                          style={{ background: 'var(--surface-container)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', width: '100%' }}
                          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.db_diff_db_name || "Database Name"}</label>
                        <input 
                          type="text" 
                          placeholder="production_db" 
                          value={diffConfig.database} 
                          onChange={e => setDiffConfig({...diffConfig, database: e.target.value})} 
                          style={{ background: 'var(--surface-container)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', width: '100%' }}
                          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.db_diff_username || "Username"}</label>
                        <input 
                          type="text" 
                          placeholder="root" 
                          value={diffConfig.user} 
                          onChange={e => setDiffConfig({...diffConfig, user: e.target.value})} 
                          style={{ background: 'var(--surface-container)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', width: '100%' }}
                          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t.db_diff_password || "Password"}</label>
                        <input 
                          type="password" 
                          placeholder="***" 
                          value={diffConfig.password} 
                          onChange={e => setDiffConfig({...diffConfig, password: e.target.value})} 
                          style={{ background: 'var(--surface-container)', border: '1px solid var(--glass-border)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s', width: '100%' }}
                          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                          onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                        />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                      <button 
                        className="btn-primary" 
                        onClick={handleDiff} 
                        disabled={diffLoading || !selectedDb} 
                        style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem' }}
                      >
                        {diffLoading ? <RefreshCw size={18} className="spin" /> : <GitPullRequest size={18} />} 
                        Mulai Bandingkan
                      </button>
                    </div>
                  </div>
                </div>
                
                <div style={{ flex: 1, padding: '1rem' }}>
                  {!diffResult ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Masukkan kredensial remote database dan klik Bandingkan.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {diffResult.localOnly.length === 0 && diffResult.remoteOnly.length === 0 && diffResult.different.length === 0 ? (
                        <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--status-running)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Server size={18} /> Skema database 100% identik!
                        </div>
                      ) : (
                        <>
                          {diffResult.localOnly.length > 0 && (
                            <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', color: '#3b82f6' }}>{t.db_diff_local_only}</h4>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {diffResult.localOnly.map(t => <span key={t} style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{t}</span>)}
                              </div>
                            </div>
                          )}
                          
                          {diffResult.remoteOnly.length > 0 && (
                            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--status-error)' }}>{t.db_diff_remote_only}</h4>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {diffResult.remoteOnly.map(t => <span key={t} style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{t}</span>)}
                              </div>
                            </div>
                          )}

                          {diffResult.different.length > 0 && (
                            <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b' }}>{t.db_diff_structure}</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {diffResult.different.map(d => (
                                  <div key={d.table} style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>{d.table}</span>
                                    <span style={{ opacity: 0.8 }}>{d.diff}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : activeMainTab === 'visualisasi' ? (
              <div className="glass-panel" style={{ flex: 1, overflow: 'hidden' }}>
                <DatabaseVisualizer schema={detailedSchema} loading={schemaLoading} />
              </div>
            ) : activeMainTab === 'spesifikasi' ? (
              <div className="glass-panel" style={{ flex: 1, overflow: 'hidden' }}>
                <FileSpecification schema={detailedSchema} loading={schemaLoading} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
