import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, applyNodeChanges, applyEdgeChanges, Handle, Position, addEdge, ReactFlowProvider, useReactFlow, ConnectionMode, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Download, Camera, CheckSquare, Square, Sparkles, X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { toPng, toJpeg, toSvg } from 'html-to-image';

const ErdColorModeContext = createContext('color');

interface Column {
  name: string;
  type: string;
  key: string;
  null: string;
}

interface ForeignKey {
  column: string;
  referenced_table: string;
  referenced_column: string;
}

interface TableSchema {
  table_name: string;
  primary_key: string;
  columns: Column[];
  foreign_keys: ForeignKey[];
}

interface DatabaseVisualizerProps {
  schema: { database_name?: string, tables: TableSchema[] } | null;
  loading: boolean;
}

// Custom Node for Tables
const TableNode = ({ data }: { data: any }) => {
  const { table, mode } = data;
  
  return (
    <div style={{ 
      background: 'var(--surface-container)', 
      border: '1px solid var(--glass-border)', 
      borderRadius: '8px',
      overflow: 'hidden',
      minWidth: '200px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--primary)', border: 'none' }} />
      
      <div style={{ 
        background: 'var(--primary)', 
        color: 'var(--on-primary)', 
        padding: '0.5rem 1rem', 
        fontWeight: 'bold',
        fontSize: '0.9rem',
        textAlign: 'center'
      }}>
        {table.table_name}
      </div>
      
      <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {table.columns.map((col: any) => {
          if (mode === 'LRS' && col.key !== 'PRI' && !table.foreign_keys.some((fk:any) => fk.column === col.name)) {
            return null; // LRS only shows keys
          }
          
          const isPK = col.key === 'PRI';
          const isFK = table.foreign_keys.some((fk:any) => fk.column === col.name);
          
          return (
            <div key={col.name} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '0.15rem 1rem',
              fontSize: '0.8rem',
              background: isPK ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
              borderBottom: '1px solid var(--glass-border-light)'
            }}>
              <span style={{ fontWeight: isPK || isFK ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                {col.name} {isPK && <span style={{ color: 'var(--primary)', fontSize: '0.7rem', marginLeft: '4px' }}>(PK)</span>}
                {isFK && <span style={{ color: '#eab308', fontSize: '0.7rem', marginLeft: '4px' }}>(FK)</span>}
              </span>
              {mode === 'ERD' && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{col.type}</span>
              )}
            </div>
          );
        })}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--primary)', border: 'none' }} />
    </div>
  );
};

const EntityNode = ({ data }: any) => {
  const erdColorMode = useContext(ErdColorModeContext);
  const isWeak = data.subType === 'weak';
  const bgColor = erdColorMode === 'bw' ? '#ffffff' : '#eab308';
  const borderColor = '#000';
  
  return (
    <div style={{ 
      background: bgColor, color: '#000', 
      padding: '10px 20px', border: `2px solid ${borderColor}`, 
      borderRadius: '8px', minWidth: 120, textAlign: 'center', 
      fontWeight: 'bold', position: 'relative', cursor: 'pointer',
      boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
    }}>
      {isWeak && (
        <div style={{ position: 'absolute', top: '3px', left: '3px', right: '3px', bottom: '3px', border: `1px solid ${borderColor}`, pointerEvents: 'none' }}></div>
      )}
      <Handle type="source" position={Position.Top} id="t" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="l" style={{ opacity: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{data.label}</div>
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0 }} />
    </div>
  );
};

const RelationshipNode = ({ data }: any) => {
  const erdColorMode = useContext(ErdColorModeContext);
  const isId = data.subType === 'identifying';
  const bgColor = erdColorMode === 'bw' ? '#ffffff' : '#0d9488';
  const textColor = erdColorMode === 'bw' ? '#000000' : '#ffffff';
  const borderColor = '#000';

  return (
    <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', width: '80px', height: '80px', background: bgColor, border: `2px solid ${borderColor}`, transform: 'rotate(45deg)' }}></div>
      {isId && (
        <div style={{ position: 'absolute', width: '70px', height: '70px', border: `1px solid ${borderColor}`, transform: 'rotate(45deg)', pointerEvents: 'none', zIndex: 1 }}></div>
      )}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: 2, fontSize: '0.75rem', color: textColor, fontWeight: 'bold', width: '75px', maxHeight: '75px', overflow: 'hidden', wordWrap: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: '1.2', textOverflow: 'ellipsis' }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Top} id="t" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="l" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0 }} />
    </div>
  );
};

const AttributeNode = ({ data }: any) => {
  const erdColorMode = useContext(ErdColorModeContext);
  const { subType } = data;
  let bgColor = erdColorMode === 'bw' ? '#ffffff' : '#86efac';
  let borderColor = '#000';
  let borderStyle = 'solid';
  let isDouble = false;
  let isUnderline = false;

  if (subType === 'derived') {
    borderStyle = 'dashed';
  } else if (subType === 'multivalued') {
    isDouble = true;
  } else if (subType === 'key') {
    isUnderline = true;
  }

  return (
    <div style={{ 
      position: 'relative',
      background: bgColor, 
      border: `2px ${borderStyle} ${borderColor}`, 
      borderRadius: '50px', 
      padding: '5px 15px', 
      minWidth: 80, 
      textAlign: 'center', 
      fontSize: '0.85rem', 
      color: '#000',
      cursor: 'pointer'
    }}>
      {isDouble && (
        <div style={{ position: 'absolute', top: '2px', left: '2px', right: '2px', bottom: '2px', border: `1px solid ${borderColor}`, borderRadius: '50px', pointerEvents: 'none' }}></div>
      )}
      <Handle type="source" position={Position.Top} id="t" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="l" style={{ opacity: 0 }} />
      <div style={{ textDecoration: isUnderline ? 'underline' : 'none', fontWeight: isUnderline ? 'bold' : 'normal', position: 'relative', zIndex: 1 }}>{data.label}</div>
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0 }} />
    </div>
  );
};

const TextNode = ({ data }: any) => {
  return (
    <div style={{ 
      padding: '5px 10px', 
      fontSize: '0.9rem', 
      color: 'var(--text-primary)', 
      cursor: 'text', 
      minWidth: '80px', 
      textAlign: 'center', 
      background: 'transparent', 
      border: 'none',
      boxShadow: 'none'
    }}>
      {data.label}
      <Handle type="source" position={Position.Top} id="t" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="l" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0 }} />
    </div>
  );
};

import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath } from '@xyflow/react';

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
}: any) => {
  let edgePath = '';
  let labelX = 0;
  let labelY = 0;
  
  if (data?.type === 'straight') {
    [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  } else if (data?.type === 'smoothstep' || data?.type === 'step') {
    const borderRadius = data?.type === 'step' ? 0 : 5;
    [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius });
  } else {
    [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {data?.labelLeft && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${sourceX + (targetX > sourceX ? 15 : -15)}px,${sourceY + (targetY > sourceY ? 15 : -15)}px)`,
              background: 'transparent',
              padding: '2px 4px',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-primary)',
              pointerEvents: 'none'
            }}
            className="nodrag nopan"
          >
            {data.labelLeft}
          </div>
        )}
        {data?.labelRight && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${targetX + (sourceX > targetX ? 15 : -15)}px,${targetY + (sourceY > targetY ? 15 : -15)}px)`,
              background: 'transparent',
              padding: '2px 4px',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-primary)',
              pointerEvents: 'none'
            }}
            className="nodrag nopan"
          >
            {data.labelRight}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  customEdge: CustomEdge,
};

const nodeTypes = {
  tableNode: TableNode,
  entityNode: EntityNode,
  relationshipNode: RelationshipNode,
  attributeNode: AttributeNode,
  textNode: TextNode
};

const CustomControls = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  
  return (
    <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '5px', background: 'var(--surface-container-lowest)', padding: '5px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)' }}>
      <button onClick={() => zoomIn()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', borderRadius: '4px' }} title="Zoom In" onMouseOver={e => e.currentTarget.style.background = 'var(--surface-container)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}><ZoomIn size={18} /></button>
      <button onClick={() => zoomOut()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', borderRadius: '4px' }} title="Zoom Out" onMouseOver={e => e.currentTarget.style.background = 'var(--surface-container)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}><ZoomOut size={18} /></button>
      <button onClick={() => fitView({ duration: 800, padding: 0.1 })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', borderRadius: '4px' }} title="Fit View" onMouseOver={e => e.currentTarget.style.background = 'var(--surface-container)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}><Maximize size={18} /></button>
    </div>
  );
};

const DatabaseVisualizerContent: React.FC<DatabaseVisualizerProps> = ({ schema, loading }) => {
  const [lrsNodes, setLrsNodes, onLrsNodesChange] = useNodesState<any>([]);
  const [lrsEdges, setLrsEdges, onLrsEdgesChange] = useEdgesState<any>([]);
  const [erdNodes, setErdNodes, onErdNodesChange] = useNodesState<any>([]);
  const [erdEdges, setErdEdges, onErdEdgesChange] = useEdgesState<any>([]);

  const [viewMode, setViewMode] = useState<'ERD' | 'LRS'>('LRS');
  
  const nodes = viewMode === 'LRS' ? lrsNodes : erdNodes;
  const setNodes = viewMode === 'LRS' ? setLrsNodes : setErdNodes;
  const onNodesChange = viewMode === 'LRS' ? onLrsNodesChange : onErdNodesChange;
  
  const edges = viewMode === 'LRS' ? lrsEdges : erdEdges;
  const setEdges = viewMode === 'LRS' ? setLrsEdges : setErdEdges;
  const onEdgesChange = viewMode === 'LRS' ? onLrsEdgesChange : onErdEdgesChange;
  const [activeTables, setActiveTables] = useState<TableSchema[]>(schema?.tables || []);
  const [erdDatabaseName, setErdDatabaseName] = useState<string>(schema?.database_name || 'default');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [promptConfig, setPromptConfig] = useState<{ isOpen: boolean, type: 'node' | 'edge', title: string, defaultValue?: string, defaultValue2?: string, onSave: (val: string, val2?: string) => void, onDelete?: () => void } | null>(null);
  const [edgeType, setEdgeType] = useState('default');
  const [erdColorMode, setErdColorMode] = useState<'color' | 'bw'>('color');
  const [showMinimap, setShowMinimap] = useState(true);
  
  const [history, setHistory] = useState<{nodes: any[], edges: any[]}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isHistoryAction = useRef(false);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'node'|'edge'|'pane', id?: string } | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, getNodes } = useReactFlow();

  useEffect(() => {
    if (schema && schema.tables) {
      setActiveTables(schema.tables);
    } else {
      setActiveTables([]);
    }
  }, [schema]);

  useEffect(() => {
    setLrsEdges(eds => eds.map(e => ({ ...e, type: edgeType })));
    setErdEdges(eds => eds.map(e => ({ ...e, type: edgeType })));
  }, [edgeType, setLrsEdges, setErdEdges]);
  
  const generateErd = useCallback((forceReset = false) => {
    if (activeTables.length === 0) return;
    
    const newLrsNodes: any[] = [];
    const newLrsEdges: any[] = [];
    
    const newErdNodes: any[] = [];
    const newErdEdges: any[] = [];
    
    // Grid layout calculation
    const cols = Math.ceil(Math.sqrt(activeTables.length));
    const xOffset = 300;
    const yOffset = 250;
    
    const erdXOffset = 600;
    const erdYOffset = 500;
    
    activeTables.forEach((table, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // LRS Generation
      newLrsNodes.push({
        id: table.table_name,
        type: 'tableNode',
        position: { x: col * xOffset, y: row * yOffset },
        data: { table, mode: 'LRS' }
      });
      
      table.foreign_keys.forEach(fk => {
        newLrsEdges.push({
          id: `e-${table.table_name}-${fk.referenced_table}`,
          source: fk.referenced_table,
          target: table.table_name,
          animated: true,
          style: { stroke: 'var(--primary)', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'var(--primary)',
          },
        });
      });

      // ERD Generation
      const entityId = `entity-${table.table_name}`;
      const entityX = col * erdXOffset;
      const entityY = row * erdYOffset;

      newErdNodes.push({
        id: entityId,
        type: 'entityNode',
        position: { x: entityX, y: entityY },
        data: { label: table.table_name, subType: 'normal' }
      });

      const radius = 140;
      const angleStep = (2 * Math.PI) / (table.columns.length || 1);
      
      table.columns.forEach((column, i) => {
        const attrId = `attr-${table.table_name}-${column.name}`;
        const angle = i * angleStep;
        const attrX = entityX + radius * Math.cos(angle);
        const attrY = entityY + radius * Math.sin(angle);

        newErdNodes.push({
          id: attrId,
          type: 'attributeNode',
          position: { x: attrX, y: attrY },
          data: { label: column.name, subType: column.key === 'PRI' ? 'key' : 'normal' }
        });

        newErdEdges.push({
          id: `e-${entityId}-${attrId}`,
          source: entityId,
          target: attrId,
          type: 'straight',
          style: { stroke: '#000', strokeWidth: 2, cursor: 'pointer' },
        });
      });
    });
    
    setLrsNodes(newLrsNodes);
    setLrsEdges(prevEdges => {
       return newLrsEdges.map(newEdge => {
          const existing = prevEdges.find(e => e.id === newEdge.id);
          if (existing && existing.label) {
             return { ...newEdge, label: existing.label, labelStyle: existing.labelStyle, labelBgStyle: existing.labelBgStyle };
          }
          return newEdge;
       });
    });

    if (!forceReset) {
      const dbKey = schema?.database_name || 'default';
      const savedNodes = localStorage.getItem(`sabila_erd_nodes_${dbKey}`);
      const savedEdges = localStorage.getItem(`sabila_erd_edges_${dbKey}`);
      if (savedNodes && savedEdges) {
        try {
          const pNodes = JSON.parse(savedNodes);
          const pEdges = JSON.parse(savedEdges);
          if (pNodes.length > 0) {
            setErdDatabaseName(dbKey);
            setErdNodes(pNodes);
            setErdEdges(pEdges);
            return;
          }
        } catch (e) {}
      }
    }

    setErdDatabaseName(schema?.database_name || 'default');
    setErdNodes(newErdNodes);
    setErdEdges(newErdEdges);
  }, [activeTables, setLrsNodes, setLrsEdges, setErdNodes, setErdEdges, schema?.database_name]);

  useEffect(() => {
    generateErd();
  }, [generateErd]);

  // History & Auto Save
  useEffect(() => {
    if (viewMode === 'ERD' && erdNodes.length > 0) {
      const dbKey = erdDatabaseName;
      localStorage.setItem(`sabila_erd_nodes_${dbKey}`, JSON.stringify(erdNodes));
      localStorage.setItem(`sabila_erd_edges_${dbKey}`, JSON.stringify(erdEdges));

      if (isHistoryAction.current) {
        isHistoryAction.current = false;
        return;
      }
      
      const timer = setTimeout(() => {
        setHistory(prev => {
          const newHist = prev.slice(0, historyIndex + 1);
          newHist.push({ nodes: JSON.parse(JSON.stringify(erdNodes)), edges: JSON.parse(JSON.stringify(erdEdges)) });
          if (newHist.length > 50) newHist.shift();
          setHistoryIndex(newHist.length - 1);
          return newHist;
        });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [erdNodes, erdEdges, viewMode, erdDatabaseName]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isHistoryAction.current = true;
      const prevState = history[historyIndex - 1];
      setErdNodes(prevState.nodes);
      setErdEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setErdNodes, setErdEdges]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isHistoryAction.current = true;
      const nextState = history[historyIndex + 1];
      setErdNodes(nextState.nodes);
      setErdEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setErdNodes, setErdEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const selectedNodes = nodes.filter((n: any) => n.selected);
        if (selectedNodes.length > 0) {
           const duplicatedNodes = selectedNodes.map((n: any) => ({
              ...n,
              id: `${n.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              selected: false,
              position: { x: n.position.x + 50, y: n.position.y + 50 }
           }));
           setNodes(nds => [...nds, ...duplicatedNodes]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, nodes, setNodes]);

  const handleReset = () => {
    if (window.confirm("Apakah Anda yakin ingin mengatur ulang ERD? Semua kustomisasi akan hilang.")) {
      const dbKey = schema?.database_name || 'default';
      localStorage.removeItem(`sabila_erd_nodes_${dbKey}`);
      localStorage.removeItem(`sabila_erd_edges_${dbKey}`);
      setHistory([]);
      setHistoryIndex(-1);
      generateErd(true); 
    }
  };

  const handleAutoLayout = () => {
    setErdNodes(nds => {
      let counter = 0;
      return nds.map((n) => {
        if (n.type === 'entityNode' || n.type === 'tableNode') {
          const col = counter % 4;
          const row = Math.floor(counter / 4);
          counter++;
          return { ...n, position: { x: col * 400, y: row * 300 } };
        }
        return n;
      });
    });
    setContextMenu(null);
  };

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge({
    ...params, 
    type: 'customEdge',
    data: { type: edgeType },
    animated: false, 
    style: { stroke: '#000', strokeWidth: 2, cursor: 'pointer' }
  }, eds)), [setEdges, edgeType]);

  const isValidConnection = useCallback((connection: any) => {
    const sourceNode = nodes.find((n: any) => n.id === connection.source);
    const targetNode = nodes.find((n: any) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const types = [sourceNode.type, targetNode.type];
    
    // Hanya izinkan Relasi <-> Entitas / Tabel
    if (types.includes('relationshipNode') && (types.includes('entityNode') || types.includes('tableNode'))) {
      return true;
    }
    
    // Opsional: Izinkan Entitas <-> Atribut
    if (types.includes('attributeNode') && types.includes('entityNode')) {
      return true;
    }
    
    return false;
  }, [nodes]);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: any) => {
    event.stopPropagation();
    
    let defLeft = edge.data?.labelLeft || "";
    let defRight = edge.data?.labelRight || "";
    
    setPromptConfig({
      isOpen: true,
      type: 'edge',
      title: "Pengaturan Relasi",
      defaultValue: defLeft,
      defaultValue2: defRight,
      onSave: (left, right) => {
        setEdges(eds => eds.map(e => e.id === edge.id ? { 
          ...e, 
          data: { ...e.data, labelLeft: left || undefined, labelRight: right || undefined }
        } : e));
      },
      onDelete: () => {
        setEdges(eds => eds.filter(e => e.id !== edge.id));
      }
    });
  }, [setEdges]);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: any) => {
    if (node.type !== 'textNode' && node.type !== 'relationshipNode' && node.type !== 'attributeNode') return;
    setPromptConfig({
      isOpen: true,
      type: 'node',
      title: "Masukkan teks baru:",
      defaultValue: node.data.label,
      onSave: (newLabel) => {
        if (!newLabel?.trim()) return;
        setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n));
      }
    });
  }, [setNodes]);

  const onDragStart = (event: React.DragEvent, nodeType: string, subType: string = 'normal', label?: string) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-subtype', subType);
    if (label) event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onNodeClick = useCallback((event: any, node: any) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', id: node.id });
  }, []);
  const onPaneClick = useCallback((event: any) => {
    event.preventDefault();
    setContextMenu(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type');
      const subType = event.dataTransfer.getData('application/reactflow-subtype') || 'normal';
      const customLabel = event.dataTransfer.getData('application/reactflow-label');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      let label = customLabel || (type === 'entityNode' ? 'Entity' : type === 'relationshipNode' ? 'Relationship' : 'Attribute');
      
      const newNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label, subType },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const handleGenerateAi = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      let convId;
      try {
        const convRes = await (window as any).api.chatCreateConversation("DB Designer AI");
        convId = convRes?.id;
      } catch (e) {
        // Fallback or ignore if creation fails
      }

      const systemPrompt = `Anda adalah ahli database. Buat desain database berdasarkan deskripsi berikut: "${aiPrompt}".\nOutput WAJIB berupa JSON valid dengan format persis seperti ini (tanpa markdown, tanpa penjelasan tambahan):\n{"tables": [{"table_name": "string", "columns": [{"name": "string", "type": "string", "key": "PRI" | "MUL" | ""}], "foreign_keys": [{"column": "string", "referenced_table": "string"}]}]}`;
      
      const reply = await (window as any).api.sendAiMessage(convId || 1, systemPrompt);
      
      const jsonStr = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      const generatedSchema = JSON.parse(jsonStr);
      
      if (generatedSchema && generatedSchema.tables) {
        setActiveTables(generatedSchema.tables);
        setShowAiModal(false);
      } else {
        setAiError("Format response AI tidak sesuai.");
      }
      
      if (convId) {
        await (window as any).api.chatDeleteConversation(convId).catch(() => {});
      }
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || "Gagal menghubungi AI. Pastikan konfigurasi AI sudah diatur di Settings.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = useCallback(async () => {
    if (!reactFlowWrapper.current) return;
    
    try {
      const nodes = getNodes();
      if (!nodes || nodes.length === 0) throw new Error("Tidak ada node untuk diexport");

      const nodesBounds = getNodesBounds(nodes);
      const padding = 50;
      const imageWidth = nodesBounds.width + padding * 2;
      const imageHeight = nodesBounds.height + padding * 2;

      // Batasi ukuran untuk mencegah canvas crash di memori browser
      if (imageWidth > 10000 || imageHeight > 10000) {
         throw new Error("Diagram terlalu besar, memori browser tidak cukup untuk kualitas HD.");
      }

      const viewport = getViewportForBounds(
        nodesBounds,
        imageWidth,
        imageHeight,
        0.5,
        2,
        padding // argument ke-6 wajib di @xyflow/react versi terbaru
      );

      const viewportElement = reactFlowWrapper.current.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewportElement) throw new Error("Canvas viewport tidak ditemukan");

      // Menggunakan toPng pada elemen viewport secara spesifik menyelesaikan masalah styling yang berantakan di toSvg
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#0f172a',
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      // Buat file HTML dengan gaya yang cocok dengan Sabila
      const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ERD - ${schema?.database_name || 'Database'} (Kualitas HD)</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --surface: rgba(30, 41, 59, 0.7);
            --border: rgba(255, 255, 255, 0.1);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
        }
        body {
            margin: 0;
            padding: 20px;
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: system-ui, -apple-system, sans-serif;
            color: var(--text-primary);
        }
        .container {
            background: var(--surface);
            padding: 30px;
            border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset;
            max-width: 95vw;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow: auto;
        }
        img {
            max-width: 100%;
            height: auto;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: rgba(0,0,0,0.2);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
        h1 {
            text-align: center;
            margin: 0 0 25px 0;
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.025em;
            background: linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .footer {
            text-align: center;
            margin-top: 25px;
            color: var(--text-secondary);
            font-size: 0.85rem;
            letter-spacing: 0.025em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Skema Database: ${schema?.database_name || 'Database'}</h1>
        <img src="${dataUrl}" alt="ERD Diagram" />
        <div class="footer">
            Dihasilkan oleh Sabila Local Dev Environment &bull; ${new Date().toLocaleString('id-ID')}
        </div>
    </div>
</body>
</html>`;

      // Download file HTML
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ERD_${schema?.database_name || 'Database'}_HD.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Gagal export HD HTML:', error);
      alert('Gagal menghasilkan export HD. Silakan coba lagi. Error: ' + (error as Error).message);
    }
  }, [schema, getNodes]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Memuat skema...</div>;
  }

  if (activeTables.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)', gap: '1rem' }}>
        <p>Tidak ada tabel di database ini.</p>
        <button className="btn-primary" onClick={() => setShowAiModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} /> Buat dengan AI
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input 
              type="radio" 
              name="viewMode" 
              checked={viewMode === 'ERD'} 
              onChange={() => setViewMode('ERD')} 
              style={{ display: 'none' }}
            />
            {viewMode === 'ERD' ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} />}
            ERD View
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <input 
              type="radio" 
              name="viewMode" 
              checked={viewMode === 'LRS'} 
              onChange={() => setViewMode('LRS')} 
              style={{ display: 'none' }}
            />
            {viewMode === 'LRS' ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} />}
            LRS View
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={() => setShowAiModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6', borderColor: '#8b5cf6' }}>
            <Sparkles size={16} /> AI Generator
          </button>
          <button className="btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={16} /> Export (HTML HD)
          </button>
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {viewMode === 'ERD' && (
          <div style={{ width: '130px', minWidth: '90px', maxWidth: '300px', resize: 'horizontal', borderRight: '1px solid var(--glass-border)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--surface-container)', overflowY: 'auto', overflowX: 'hidden' }}>
          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9rem' }}>ERD Tools</h4>
          
          <div style={{ background: 'var(--surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tambahkan Elemen</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
              <div draggable onDragStart={(e) => onDragStart(e, 'relationshipNode', 'normal', 'Relasi')} style={{ position: 'relative', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }} title="Tarik Relasi">
                <div style={{ position: 'absolute', width: '35px', height: '35px', background: '#0d9488', border: '2px solid #000', transform: 'rotate(45deg)' }}></div>
                <span style={{ position: 'relative', zIndex: 1, fontSize: '0.65rem', fontWeight: 'bold', color: '#fff' }}>Relasi</span>
              </div>
              <div draggable onDragStart={(e) => onDragStart(e, 'textNode', 'normal', 'Teks Note')} style={{ position: 'relative', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', background: 'transparent' }} title="Tarik Teks">
                <span style={{ position: 'relative', zIndex: 1, fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Teks</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)' }}>Tarik elemen ke kanvas untuk menambahkannya.</p>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gaya Garis</p>
            <select 
              value={edgeType} 
              onChange={(e) => setEdgeType(e.target.value)}
              className="input-glass"
              style={{ padding: '0.25rem', width: '100%', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              <option value="default">Melengkung</option>
              <option value="straight">Lurus</option>
              <option value="smoothstep">Siku Melengkung</option>
              <option value="step">Siku Kaku</option>
            </select>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tampilan</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={erdColorMode === 'color'} onChange={(e) => setErdColorMode(e.target.checked ? 'color' : 'bw')} /> Warna ERD
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showMinimap} onChange={(e) => setShowMinimap(e.target.checked)} /> Minimap
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
            <button className="btn-secondary" onClick={undo} disabled={historyIndex <= 0} style={{ fontSize: '0.7rem', padding: '0.25rem' }}>Undo (Ctrl+Z)</button>
            <button className="btn-secondary" onClick={redo} disabled={historyIndex >= history.length - 1} style={{ fontSize: '0.7rem', padding: '0.25rem' }}>Redo (Ctrl+Y)</button>
            <button className="btn-secondary" onClick={handleReset} style={{ fontSize: '0.7rem', padding: '0.25rem', color: '#ef4444', borderColor: '#ef4444' }}>Reset ERD</button>
          </div>
          </div>
        )}

        <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
          <ErdColorModeContext.Provider value={viewMode === 'ERD' ? erdColorMode : 'color'}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onEdgeClick={onEdgeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
              fitViewOptions={{ padding: 0.05 }}
              minZoom={0.1}
              attributionPosition="bottom-right"
            >
            <Background color="var(--text-muted)" gap={16} size={1} />
            <CustomControls />
            {showMinimap && (
              <MiniMap 
                nodeStrokeColor={(n) => '#000'}
                nodeColor={(n) => {
                  if (erdColorMode === 'bw' && viewMode === 'ERD') return '#ffffff';
                  if (n.type === 'entityNode') return '#eab308';
                  if (n.type === 'relationshipNode') return '#0d9488';
                  if (n.type === 'attributeNode') return '#86efac';
                  return n.data?.mode === 'ERD' ? '#3b82f6' : '#8b5cf6';
                }}
                maskColor="rgba(0,0,0,0.1)" 
                style={{ background: 'var(--surface-container)' }}
              />
            )}
            </ReactFlow>
          </ErdColorModeContext.Provider>
        </div>
      </div>

      {contextMenu && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300 }} onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
          <div className="glass-panel" style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, background: 'var(--surface-container-highest)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>

            {contextMenu.id && contextMenu.type === 'node' && (
              <button onClick={(e) => {
                e.stopPropagation();
                const node = nodes.find(n => n.id === contextMenu.id);
                if (node) {
                  setPromptConfig({
                    isOpen: true,
                    type: 'node',
                    title: "Ganti Nama:",
                    defaultValue: node.data.label,
                    onSave: (newLabel) => {
                      if (!newLabel?.trim()) return;
                      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n));
                    }
                  });
                  setContextMenu(null);
                }
              }} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', padding: '0.5rem', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-container)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>Ganti Nama</button>
            )}
            {contextMenu.id && (
              <button onClick={(e) => {
                e.stopPropagation();
                if (contextMenu.type === 'node') {
                  setNodes(nds => nds.filter(n => n.id !== contextMenu.id));
                } else if (contextMenu.type === 'edge') {
                  setEdges(eds => eds.filter(e => e.id !== contextMenu.id));
                }
                setContextMenu(null);
              }} style={{ background: 'transparent', border: 'none', color: '#ef4444', textAlign: 'left', padding: '0.5rem', cursor: 'pointer', borderRadius: '4px' }} onMouseOver={e => e.currentTarget.style.background = 'var(--surface-container)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>Hapus dari Tampilan</button>
            )}
          </div>
        </div>
      )}

      {showAiModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '500px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={18} color="#8b5cf6" /> AI DB Generator</h3>
              <button onClick={() => setShowAiModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Deskripsikan sistem yang ingin Anda buat, AI akan menghasilkan struktur tabel (ERD/LRS) untuk Anda.
            </p>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Contoh: Buatkan ERD untuk sistem perpustakaan yang memiliki tabel buku, anggota, dan peminjaman..."
              style={{ width: '100%', height: '120px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--surface-container)', color: 'var(--text-primary)', resize: 'none', outline: 'none' }}
            />
            {aiError && <div style={{ color: 'var(--status-error)', fontSize: '0.85rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>{aiError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setShowAiModal(false)} disabled={aiLoading}>Batal</button>
              <button 
                className="btn-primary" 
                onClick={handleGenerateAi}
                disabled={aiLoading || !aiPrompt.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#8b5cf6', color: 'white', border: 'none' }}
              >
                {aiLoading ? 'Menghasilkan...' : 'Generate Diagram'}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptConfig && promptConfig.isOpen && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '400px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--surface)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{promptConfig.title}</h3>
            
            {promptConfig.type === 'node' ? (
              <input 
                type="text" 
                autoFocus
                className="input-glass"
                defaultValue={promptConfig.defaultValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    promptConfig.onSave(e.currentTarget.value);
                    setPromptConfig(null);
                  } else if (e.key === 'Escape') {
                    setPromptConfig(null);
                  }
                }}
                id="custom-prompt-input"
              />
            ) : (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kiri</label>
                  <input type="text" className="input-glass" defaultValue={promptConfig.defaultValue} id="edge-left-input" style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kanan</label>
                  <input type="text" className="input-glass" defaultValue={promptConfig.defaultValue2} id="edge-right-input" style={{ width: '100%', marginTop: '0.25rem' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: promptConfig.type === 'edge' ? 'space-between' : 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              {promptConfig.type === 'edge' && (
                <button className="btn-secondary" onClick={() => {
                  if (promptConfig.onDelete) promptConfig.onDelete();
                  setPromptConfig(null);
                }} style={{ color: '#ef4444', borderColor: '#ef4444' }}>Hapus Garis</button>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" onClick={() => setPromptConfig(null)}>Batal</button>
                <button className="btn-primary" onClick={() => {
                  if (promptConfig.type === 'node') {
                    const input = document.getElementById('custom-prompt-input') as HTMLInputElement;
                    if (input) promptConfig.onSave(input.value);
                  } else {
                    const left = document.getElementById('edge-left-input') as HTMLInputElement;
                    const right = document.getElementById('edge-right-input') as HTMLInputElement;
                    promptConfig.onSave(left?.value || '', right?.value || '');
                  }
                  setPromptConfig(null);
                }}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DatabaseVisualizer: React.FC<DatabaseVisualizerProps> = (props) => {
  return (
    <ReactFlowProvider>
      <DatabaseVisualizerContent {...props} />
    </ReactFlowProvider>
  );
};
