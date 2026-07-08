import React, { useState } from 'react';
import { Download, Table as TableIcon, Database as DbIcon, Key, Hash } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { saveAs } from 'file-saver';

interface Column {
  name: string;
  type: string;
  key: string;
  null: string;
  comment?: string;
}

interface ForeignKey {
  column: string;
  referenced_table: string;
  referenced_column: string;
}

interface TableSchema {
  table_name: string;
  primary_key: string;
  record_length: number;
  columns: Column[];
  foreign_keys: ForeignKey[];
}

interface FileSpecificationProps {
  schema: { database_name: string, tables: TableSchema[] } | null;
  loading: boolean;
}

export const FileSpecification: React.FC<FileSpecificationProps> = ({ schema, loading }) => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Memuat spesifikasi...</div>;
  }

  if (!schema || schema.tables.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Tidak ada tabel di database ini.</div>;
  }

  const exportToWord = async () => {
    try {
      const sections = [];
      
      // Title
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: `Spesifikasi File - Database: ${schema.database_name}`, bold: true, size: 32 })
        ],
        spacing: { after: 400 }
      }));

      // For each table
      const tablesToExport = selectedTable ? schema.tables.filter(t => t.table_name === selectedTable) : schema.tables;
      
      for (const table of tablesToExport) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `Spesifikasi File ${table.table_name}`, bold: true, size: 28 })],
          spacing: { before: 400, after: 200 }
        }));
        
        // Metadata Table
        sections.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Nama Database' })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ text: schema.database_name })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Nama File (Tabel)' })] }),
                new TableCell({ children: [new Paragraph({ text: table.table_name })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Tipe File' })] }),
                new TableCell({ children: [new Paragraph({ text: 'SQL' })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Panjang Record' })] }),
                new TableCell({ children: [new Paragraph({ text: `${table.record_length} Byte` })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: 'Kunci Utama' })] }),
                new TableCell({ children: [new Paragraph({ text: table.primary_key || '-' })] })
              ]
            })
          ]
        }));
        
        sections.push(new Paragraph({ text: '', spacing: { before: 200, after: 200 } }));

        // Columns Table Header
        const headerRow = new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Nama Baris (Field)', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Tipe Data', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ukuran', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Jenis Key', bold: true })] })] }),
          ]
        });

        // Columns Table Rows
        const dataRows = table.columns.map(col => {
          let type = col.type;
          let size = '-';
          
          const match = col.type.match(/^(\w+)(?:\(([^)]+)\))?/);
          if (match) {
            type = match[1].toUpperCase();
            if (match[2]) size = match[2];
          }

          let keyType = '-';
          if (col.key === 'PRI') keyType = 'Primary Key';
          else if (col.key === 'UNI') keyType = 'Unique';
          else if (col.key === 'MUL') keyType = 'Index/Foreign';
          else if (table.foreign_keys.some((fk:any) => fk.column === col.name)) keyType = 'Foreign Key';

          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: col.name })] }),
              new TableCell({ children: [new Paragraph({ text: type })] }),
              new TableCell({ children: [new Paragraph({ text: size })] }),
              new TableCell({ children: [new Paragraph({ text: keyType })] }),
            ]
          });
        });

        sections.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows]
        }));
        
        sections.push(new Paragraph({ text: '', spacing: { before: 400 } })); // Spacing between tables
      }

      const doc = new Document({
        sections: [{ properties: {}, children: sections }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Spesifikasi_File_${schema.database_name}${selectedTable ? '_' + selectedTable : ''}.docx`);
    } catch (e: any) {
      console.error(e);
      alert('Gagal meng-export ke Word: ' + e.message);
    }
  };

  const activeTable = selectedTable 
    ? schema.tables.find(t => t.table_name === selectedTable) 
    : schema.tables[0];

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* Sidebar untuk list tabel */}
      <div style={{ width: '250px', borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TableIcon size={16} /> Daftar Tabel
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          <div 
            onClick={() => setSelectedTable(null)}
            style={{ 
              padding: '0.5rem 1rem', 
              cursor: 'pointer', 
              borderRadius: '6px',
              background: selectedTable === null ? 'var(--primary)' : 'transparent',
              color: selectedTable === null ? 'var(--on-primary)' : 'var(--text-primary)',
              fontWeight: selectedTable === null ? 'bold' : 'normal',
              marginBottom: '0.25rem'
            }}
          >
            Semua Tabel
          </div>
          {schema.tables.map(t => (
            <div 
              key={t.table_name}
              onClick={() => setSelectedTable(t.table_name)}
              style={{ 
                padding: '0.5rem 1rem', 
                cursor: 'pointer', 
                borderRadius: '6px',
                background: selectedTable === t.table_name ? 'var(--primary-fixed)' : 'transparent',
                color: selectedTable === t.table_name ? 'var(--on-primary-fixed)' : 'var(--text-secondary)',
                fontWeight: selectedTable === t.table_name ? 600 : 'normal'
              }}
            >
              {t.table_name}
            </div>
          ))}
        </div>
      </div>
      
      {/* Konten Utama */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            Spesifikasi File {selectedTable ? selectedTable : `(${schema.tables.length} Tabel)`}
          </h3>
          <button className="btn-primary" onClick={exportToWord} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16} /> Export ke Word
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {(selectedTable ? [activeTable!] : schema.tables).map((table, index) => (
            <div key={table.table_name} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                {table.table_name}
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nama Database</span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <DbIcon size={14} color="var(--primary)" /> {schema.database_name}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tipe File</span>
                  <span style={{ fontWeight: 600 }}>SQL</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Panjang Record</span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Hash size={14} color="var(--primary)" /> {table.record_length} Byte
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kunci Utama</span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Key size={14} color="#eab308" /> {table.primary_key || '-'}
                  </span>
                </div>
              </div>
              
              <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--surface-container)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)' }}>Nama Baris (Field)</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)' }}>Tipe Data</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)' }}>Ukuran</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)' }}>Jenis Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns.map((col, i) => {
                      let type = col.type;
                      let size = '-';
                      
                      const match = col.type.match(/^(\w+)(?:\(([^)]+)\))?/);
                      if (match) {
                        type = match[1].toUpperCase();
                        if (match[2]) size = match[2];
                      }

                      let keyType = '-';
                      if (col.key === 'PRI') keyType = 'Primary Key';
                      else if (col.key === 'UNI') keyType = 'Unique';
                      else if (col.key === 'MUL') keyType = 'Index/Foreign';
                      else if (table.foreign_keys.some((fk:any) => fk.column === col.name)) keyType = 'Foreign Key';

                      return (
                        <tr key={col.name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                          <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border-light)', fontWeight: 500 }}>{col.name}</td>
                          <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border-light)', color: 'var(--text-secondary)' }}>{type}</td>
                          <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border-light)' }}>{size}</td>
                          <td style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--glass-border-light)' }}>
                            <span style={{ 
                              padding: '0.15rem 0.5rem', 
                              borderRadius: '4px', 
                              fontSize: '0.8rem',
                              background: keyType === 'Primary Key' ? 'rgba(var(--primary-rgb), 0.15)' : 
                                          keyType.includes('Foreign') ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
                              color: keyType === 'Primary Key' ? 'var(--primary)' : 
                                     keyType.includes('Foreign') ? '#eab308' : 'var(--text-muted)'
                            }}>
                              {keyType}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
