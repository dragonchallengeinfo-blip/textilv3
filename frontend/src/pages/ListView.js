import React, { useState, useEffect, useMemo, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Check,
  X,
  Pencil,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Download,
  Maximize2,
  Minimize2,
  ArrowLeft
} from 'lucide-react';
import { formatDate, getStatusColor, getStatusLabel } from '@/utils/helpers';

const ListView = () => {
  const { viewId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  // Editing state
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [compactMode, setCompactMode] = useState(true);
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef(null);
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (viewId) {
      fetchViewData();
    }
  }, [viewId]);

  const fetchViewData = async () => {
    setLoadingData(true);
    try {
      const response = await api.get(`/custom-views/${viewId}/data`);
      setViewData(response.data);
      setView(response.data.view);
    } catch (error) {
      console.error('Failed to fetch view data:', error);
      toast.error('Erro ao carregar dados da lista');
      navigate('/dashboard');
    } finally {
      setLoading(false);
      setLoadingData(false);
    }
  };

  // Export to PDF function
  const exportToPDF = async () => {
    setExporting(true);
    try {
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${view?.nome} - Exportação</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 9px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #0f172a; }
            .header h1 { font-size: 14px; font-weight: bold; }
            .header .meta { font-size: 8px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th { background: #0f172a; color: white; padding: 4px 3px; text-align: left; font-size: 8px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            td { border: 1px solid #e2e8f0; padding: 3px; font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
            tr:nth-child(even) { background: #f8fafc; }
            .status { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 7px; font-weight: 600; }
            .status-ativo { background: #dcfce7; color: #166534; }
            .status-atrasado { background: #fef3c7; color: #92400e; }
            .status-concluido { background: #dbeafe; color: #1e40af; }
            .status-rascunho { background: #f1f5f9; color: #475569; }
            .status-bloqueado { background: #fee2e2; color: #991b1b; }
            .boolean-yes { color: #16a34a; font-weight: 600; }
            .boolean-no { color: #94a3b8; }
            .footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid #e2e8f0; font-size: 7px; color: #64748b; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${view?.nome}</h1>
            <div class="meta">
              <div>Exportado: ${new Date().toLocaleString('pt-PT')}</div>
              <div>Total: ${filteredAndSortedData.length} registos</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                ${view?.columns?.map(col => `<th>${col.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredAndSortedData.map(project => `
                <tr>
                  ${view?.columns?.map(col => {
                    const value = project[col.field];
                    if (col.type === 'status') {
                      const statusClass = value ? 'status-' + value : '';
                      return '<td><span class="status ' + statusClass + '">' + (getStatusLabel(value) || '-') + '</span></td>';
                    }
                    if (col.type === 'boolean') {
                      return '<td class="' + (value ? 'boolean-yes' : 'boolean-no') + '">' + (value ? 'Sim' : 'Não') + '</td>';
                    }
                    if (col.type === 'date' && value) {
                      return '<td>' + formatDate(value) + '</td>';
                    }
                    return '<td>' + (value ?? '-') + '</td>';
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <span>SAMIDEL - Sistema de Gestão Têxtil</span>
            <span>${view?.descricao || ''}</span>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => { printWindow.print(); }, 250);
      };
      toast.success('PDF preparado para impressão');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const startEdit = (projectId, field, currentValue) => {
    setEditingCell({ projectId, field });
    setEditValue(currentValue ?? '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    
    setSaving(true);
    try {
      await api.patch(`/custom-views/${viewId}/data/${editingCell.projectId}`, {
        field: editingCell.field,
        value: editValue
      });
      toast.success('Campo atualizado com sucesso');
      fetchViewData();
      cancelEdit();
    } catch (error) {
      console.error('Failed to save edit:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar alteração');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') cancelEdit();
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (field, value) => {
    setColumnFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setColumnFilters({});
    setSortConfig({ field: null, direction: 'asc' });
  };

  const getUniqueValues = (field) => {
    if (!viewData?.data) return [];
    const values = viewData.data.map(item => item[field]).filter(v => v !== null && v !== undefined);
    return [...new Set(values)].sort();
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!viewData?.data) return [];
    
    let result = [...viewData.data];
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(item => {
        return view?.columns?.some(col => {
          const value = item[col.field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }
    
    Object.entries(columnFilters).forEach(([field, filterValue]) => {
      if (filterValue && filterValue !== '__all__') {
        result = result.filter(item => {
          const value = item[field];
          if (filterValue === '__empty__') {
            return value === null || value === undefined || value === '';
          }
          return String(value) === String(filterValue);
        });
      }
    });
    
    if (sortConfig.field) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.field];
        const bVal = b[sortConfig.field];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'string' && aVal.includes('T') && aVal.includes('-')) {
          const dateA = new Date(aVal);
          const dateB = new Date(bVal);
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
    
    return result;
  }, [viewData?.data, searchTerm, columnFilters, sortConfig, view?.columns]);

  const renderCellValue = (project, column) => {
    const value = project[column.field];
    const isEditing = editingCell?.projectId === project.id && editingCell?.field === column.field;
    
    // Checkpoints are always boolean type
    const isCheckpoint = column.field.startsWith('checkpoint_');
    const effectiveType = isCheckpoint ? 'boolean' : column.type;

    if (isEditing) {
      return (
        <div className="flex items-center space-x-1">
          {effectiveType === 'boolean' ? (
            <select
              value={String(editValue)}
              onChange={(e) => setEditValue(e.target.value === 'true')}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-slate-500"
              autoFocus
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          ) : column.type === 'status' ? (
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-slate-500"
              autoFocus
            >
              <option value="rascunho">Rascunho</option>
              <option value="ativo">Ativo</option>
              <option value="atrasado">Atrasado</option>
              <option value="bloqueado">Bloqueado</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          ) : column.type === 'date' ? (
            <input
              type="date"
              value={editValue ? editValue.split('T')[0] : ''}
              onChange={(e) => setEditValue(e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-slate-500"
              autoFocus
            />
          ) : column.type === 'number' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-slate-500"
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-slate-500"
              autoFocus
            />
          )}
          <button onClick={saveEdit} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (column.type === 'date') return value ? formatDate(value) : '-';
    
    if (column.type === 'status') {
      return (
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${getStatusColor(value)}`}>
          {getStatusLabel(value)}
        </span>
      );
    }
    
    if (column.type === 'stage') {
      return (
        <div className="flex items-center space-x-1">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.etapa_atual_cor || '#64748B' }} />
          <span className="truncate">{value || '-'}</span>
        </div>
      );
    }
    
    if (effectiveType === 'boolean') {
      return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {value ? '✓' : '✗'}
        </span>
      );
    }
    
    if (column.type === 'number' && column.field === 'progresso_percentagem') {
      return `${value || 0}%`;
    }

    return value ?? '-';
  };

  const hasActiveFilters = searchTerm || Object.values(columnFilters).some(v => v && v !== '__all__');

  if (loading) {
    return (
      <MainLayout title="A carregar...">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar lista...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={view?.nome || 'Lista'}>
      <div data-testid="list-view-page" className="space-y-4">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-base font-medium text-slate-900">{view?.nome}</h3>
                {view?.descricao && (
                  <p className="text-xs text-slate-500">{view?.descricao}</p>
                )}
                {view?.status_filter && view.status_filter.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-slate-400">Estados:</span>
                    {view.status_filter.map(status => (
                      <span key={status} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${getStatusColor(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCompactMode(!compactMode)}
                  className={`p-1.5 rounded-md transition-colors ${compactMode ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                  title={compactMode ? 'Modo normal' : 'Modo compacto'}
                >
                  {compactMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={exportToPDF} disabled={exporting} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Exportar PDF">
                  <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
                </button>
                <button onClick={fetchViewData} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Atualizar">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar em todas as colunas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 border rounded-lg text-sm transition-colors ${showFilters || hasActiveFilters ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    {Object.values(columnFilters).filter(v => v && v !== '__all__').length + (searchTerm ? 1 : 0)}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button onClick={clearFilters} className="inline-flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <X className="w-4 h-4 mr-1" />
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Column Filters Row */}
            {showFilters && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <div className="text-xs font-medium text-slate-500 mb-3">Filtrar por coluna:</div>
                <div className="flex flex-wrap gap-3">
                  {view?.columns?.map((col) => (
                    <div key={col.field} className="min-w-[150px]">
                      <label className="block text-xs text-slate-600 mb-1">{col.label}</label>
                      <select
                        value={columnFilters[col.field] || '__all__'}
                        onChange={(e) => handleFilterChange(col.field, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-500"
                      >
                        <option value="__all__">Todos</option>
                        <option value="__empty__">Vazio</option>
                        {getUniqueValues(col.field).map((val, idx) => (
                          <option key={idx} value={String(val)}>
                            {col.type === 'boolean' ? (val ? 'Sim' : 'Não') : col.type === 'date' ? formatDate(val) : String(val)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto" ref={tableRef}>
            {loadingData ? (
              <div className="p-8 text-center text-slate-400 text-sm">A carregar dados...</div>
            ) : (
              <table className={`w-full ${compactMode ? 'text-xs' : 'text-sm'}`}>
                <thead>
                  <tr className="bg-slate-800 text-white font-medium">
                    {view?.columns?.map((col) => (
                      <th
                        key={col.field}
                        className={`${compactMode ? 'h-7 px-1.5' : 'h-9 px-3'} text-left whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors`}
                        onClick={() => handleSort(col.field)}
                        style={{ maxWidth: compactMode ? '120px' : '200px' }}
                      >
                        <div className="flex items-center space-x-1 overflow-hidden">
                          <span className="truncate" title={col.label}>{col.label}</span>
                          {col.editable && (
                            <span className="flex items-center bg-emerald-500 text-white px-1 py-0.5 rounded text-[9px] font-bold">
                              <Pencil className="w-3 h-3 mr-0.5" />
                            </span>
                          )}
                          {sortConfig.field === col.field ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedData.length === 0 ? (
                    <tr>
                      <td colSpan={view?.columns?.length || 1} className={`${compactMode ? 'px-2 py-6' : 'px-4 py-12'} text-center text-slate-400`}>
                        {hasActiveFilters ? 'Nenhum resultado para os filtros' : 'Nenhum projeto'}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedData.map((project, rowIndex) => (
                      <tr
                        key={project.id}
                        className={`border-b border-slate-100 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}
                        data-testid={`project-row-${project.id}`}
                      >
                        {view?.columns?.map((col) => (
                          <td
                            key={col.field}
                            className={`${compactMode ? 'px-1.5 py-1' : 'px-3 py-2'} ${col.editable && !editingCell ? 'cursor-pointer bg-amber-50 hover:bg-amber-100 border-l-2 border-amber-400' : ''} whitespace-nowrap overflow-hidden text-ellipsis`}
                            style={{ maxWidth: compactMode ? '120px' : '200px' }}
                            onClick={() => col.editable && !editingCell && startEdit(project.id, col.field, project[col.field])}
                            title={col.editable ? `Clique para editar: ${String(project[col.field] ?? '')}` : String(project[col.field] ?? '')}
                          >
                            {renderCellValue(project, col)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {viewData && (
            <div className={`${compactMode ? 'px-3 py-1.5' : 'px-4 py-2'} border-t border-slate-100 flex justify-between items-center text-xs text-slate-500`}>
              <span>
                {filteredAndSortedData.length} de {viewData.total || 0} registos
                {hasActiveFilters && ` (filtrado)`}
              </span>
              <div className="flex items-center space-x-3">
                {view?.columns?.filter(c => c.editable).length > 0 && (
                  <span className="flex items-center bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-medium">
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Editável
                  </span>
                )}
                <span className="text-slate-400">{compactMode ? 'Compacto' : 'Normal'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ListView;
