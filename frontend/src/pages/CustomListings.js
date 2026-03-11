import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Eye,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GripVertical,
  Check,
  Settings2,
  Table,
  Clock,
  User,
  FileText,
  CheckSquare,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  Shield,
  RefreshCw,
  Download,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { formatDate, getStatusColor, getStatusLabel } from '@/utils/helpers';

const CustomListings = () => {
  const [views, setViews] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [groupedFields, setGroupedFields] = useState(null);
  const [editableFields, setEditableFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingView, setEditingView] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  
  // Builder state
  const [builderForm, setBuilderForm] = useState({
    nome: '',
    descricao: '',
    columns: [],
    is_public: false,
    allowed_roles: ['admin', 'producao', 'comercial', 'operador'],
    edit_roles: ['admin', 'producao'],
    ordem: 0,
    status_filter: []
  });

  useEffect(() => {
    fetchViews();
    fetchAvailableFields();
  }, []);

  const fetchViews = async () => {
    try {
      const response = await api.get('/custom-views/');
      setViews(response.data);
    } catch (error) {
      console.error('Failed to fetch views:', error);
      toast.error('Erro ao carregar listagens');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableFields = async () => {
    try {
      const response = await api.get('/custom-views/fields');
      setAvailableFields(response.data.fields.project || []);
      setGroupedFields(response.data.grouped_fields || null);
      setEditableFields(response.data.editable_fields || []);
    } catch (error) {
      console.error('Failed to fetch fields:', error);
    }
  };

  const fetchViewData = async (viewId) => {
    setLoadingData(true);
    try {
      const response = await api.get(`/custom-views/${viewId}/data`);
      setViewData(response.data);
      setActiveView(response.data.view);
    } catch (error) {
      console.error('Failed to fetch view data:', error);
      toast.error('Erro ao carregar dados da vista');
    } finally {
      setLoadingData(false);
    }
  };

  const openBuilder = (view = null) => {
    if (view) {
      setEditingView(view);
      setBuilderForm({
        nome: view.nome,
        descricao: view.descricao || '',
        columns: view.columns || [],
        is_public: view.is_public || false,
        allowed_roles: view.allowed_roles || ['admin', 'producao', 'comercial', 'operador'],
        edit_roles: view.edit_roles || ['admin', 'producao'],
        ordem: view.ordem || 0,
        status_filter: view.status_filter || []
      });
    } else {
      setEditingView(null);
      setBuilderForm({
        nome: '',
        descricao: '',
        columns: [],
        is_public: false,
        allowed_roles: ['admin', 'producao', 'comercial', 'operador'],
        edit_roles: ['admin', 'producao'],
        ordem: 0,
        status_filter: []
      });
    }
    setShowBuilder(true);
  };

  const closeBuilder = () => {
    setShowBuilder(false);
    setEditingView(null);
  };

  const addColumn = (field) => {
    if (builderForm.columns.find(c => c.field === field.field)) {
      toast.error('Campo já adicionado');
      return;
    }
    setBuilderForm(prev => ({
      ...prev,
      columns: [...prev.columns, {
        field: field.field,
        label: field.label,
        type: field.type,
        editable: false
      }]
    }));
  };

  const removeColumn = (index) => {
    setBuilderForm(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index)
    }));
  };

  const toggleColumnEditable = (index) => {
    const column = builderForm.columns[index];
    // Checkpoints are always editable, regular fields need to be in editableFields list
    const isCheckpoint = column.field.startsWith('checkpoint_');
    if (!isCheckpoint && !editableFields.includes(column.field)) {
      toast.error('Este campo não pode ser editável');
      return;
    }
    setBuilderForm(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => 
        i === index ? { ...col, editable: !col.editable } : col
      )
    }));
  };

  const moveColumn = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= builderForm.columns.length) return;
    
    const newColumns = [...builderForm.columns];
    [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
    setBuilderForm(prev => ({ ...prev, columns: newColumns }));
  };

  const saveView = async () => {
    if (!builderForm.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (builderForm.columns.length === 0) {
      toast.error('Adicione pelo menos uma coluna');
      return;
    }

    try {
      if (editingView) {
        await api.put(`/custom-views/${editingView.id}`, builderForm);
        toast.success('Vista atualizada com sucesso');
      } else {
        await api.post('/custom-views/', { ...builderForm, entidade: 'project' });
        toast.success('Vista criada com sucesso');
      }
      fetchViews();
      closeBuilder();
    } catch (error) {
      console.error('Failed to save view:', error);
      toast.error('Erro ao guardar vista');
    }
  };

  const deleteView = async (viewId) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta vista?')) return;
    
    try {
      await api.delete(`/custom-views/${viewId}`);
      toast.success('Vista eliminada');
      fetchViews();
      if (activeView?.id === viewId) {
        setActiveView(null);
        setViewData(null);
      }
    } catch (error) {
      console.error('Failed to delete view:', error);
      toast.error('Erro ao eliminar vista');
    }
  };

  const closeActiveView = () => {
    setActiveView(null);
    setViewData(null);
  };

  if (loading) {
    return (
      <MainLayout title="Listagens Personalizadas">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Listagens Personalizadas">
      <div data-testid="custom-listings-page" className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <p className="text-slate-500 text-sm">
            Crie vistas personalizadas para visualizar e editar projetos
          </p>
          <button
            data-testid="create-view-btn"
            onClick={() => openBuilder()}
            className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Vista
          </button>
        </div>

        {/* Views Grid */}
        {!activeView && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {views.length === 0 ? (
              <div className="col-span-full bg-white border border-slate-200 rounded-lg p-12 text-center">
                <Table className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Nenhuma vista personalizada criada</p>
                <button
                  onClick={() => openBuilder()}
                  className="mt-4 text-slate-700 hover:text-slate-900 text-sm font-medium underline"
                >
                  Criar primeira vista
                </button>
              </div>
            ) : (
              views.map(view => (
                <div
                  key={view.id}
                  data-testid={`view-card-${view.id}`}
                  className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-slate-900">{view.nome}</h3>
                        {view.ordem > 0 && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            #{view.ordem}
                          </span>
                        )}
                      </div>
                      {view.descricao && (
                        <p className="text-xs text-slate-500 mt-1">{view.descricao}</p>
                      )}
                    </div>
                    {view.is_public && (
                      <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                        Pública
                      </span>
                    )}
                  </div>
                  
                  <div className="text-xs text-slate-400 mb-2">
                    {view.columns?.length || 0} colunas • 
                    {view.columns?.filter(c => c.editable).length || 0} editáveis
                  </div>
                  
                  {/* Status Filter Tags */}
                  {view.status_filter && view.status_filter.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {view.status_filter.map(status => (
                        <span 
                          key={status} 
                          className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusColor(status)}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <button
                      data-testid={`view-btn-${view.id}`}
                      onClick={() => fetchViewData(view.id)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      Ver
                    </button>
                    <button
                      data-testid={`edit-view-btn-${view.id}`}
                      onClick={() => openBuilder(view)}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      data-testid={`delete-view-btn-${view.id}`}
                      onClick={() => deleteView(view.id)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Active View Data */}
        {activeView && (
          <ViewDataTable 
            view={activeView} 
            data={viewData}
            loading={loadingData}
            onClose={closeActiveView}
            onRefresh={() => fetchViewData(activeView.id)}
          />
        )}

        {/* Builder Modal */}
        {showBuilder && (
          <ViewBuilder
            form={builderForm}
            setForm={setBuilderForm}
            availableFields={availableFields}
            groupedFields={groupedFields}
            editableFields={editableFields}
            editing={!!editingView}
            onSave={saveView}
            onClose={closeBuilder}
            onAddColumn={addColumn}
            onRemoveColumn={removeColumn}
            onToggleEditable={toggleColumnEditable}
            onMoveColumn={moveColumn}
          />
        )}
      </div>
    </MainLayout>
  );
};

// View Builder Modal Component
const ViewBuilder = ({ 
  form, 
  setForm, 
  availableFields, 
  groupedFields,
  editableFields,
  editing, 
  onSave, 
  onClose,
  onAddColumn,
  onRemoveColumn,
  onToggleEditable,
  onMoveColumn
}) => {
  const [expandedStages, setExpandedStages] = useState({});
  const [expandedOF, setExpandedOF] = useState(true);
  const [expandedCheckpoints, setExpandedCheckpoints] = useState(true);

  const toggleStage = (stageId) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  // Filter out already selected fields
  const isFieldSelected = (fieldName) => {
    return form.columns.find(c => c.field === fieldName);
  };

  // Get OF fields that are not selected
  const getUnusedOFFields = () => {
    if (!groupedFields?.of?.fields) return [];
    return groupedFields.of.fields.filter(f => !isFieldSelected(f.field));
  };

  // Get checkpoint fields for a stage that are not selected
  const getUnusedCheckpointFields = (stage) => {
    return stage.fields.filter(f => !isFieldSelected(f.field));
  };

  // Check if stage has any unselected checkpoints
  const stageHasUnusedCheckpoints = (stage) => {
    return stage.fields.some(f => !isFieldSelected(f.field));
  };

  const unusedOFFields = getUnusedOFFields();
  const hasUnusedCheckpoints = groupedFields?.checkpoints?.stages?.some(stageHasUnusedCheckpoints);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editing ? 'Editar Vista' : 'Nova Vista Personalizada'}
            </h2>
            <p className="text-sm text-slate-500">Configure as colunas que deseja visualizar</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome da Vista *
              </label>
              <input
                type="text"
                data-testid="view-name-input"
                value={form.nome}
                onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Produção Semanal"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Descrição
              </label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição opcional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Ordem e Filtro de Estados */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Ordem de Apresentação
              </label>
              <input
                type="number"
                data-testid="view-ordem-input"
                value={form.ordem || 0}
                onChange={(e) => setForm(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                min="0"
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 mt-1">Menor número = aparece primeiro no menu</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Filtrar por Estados
              </label>
              <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                {[
                  { value: 'rascunho', label: 'Rascunho', color: 'bg-slate-100 text-slate-600' },
                  { value: 'ativo', label: 'Ativo', color: 'bg-green-100 text-green-700' },
                  { value: 'atrasado', label: 'Atrasado', color: 'bg-amber-100 text-amber-700' },
                  { value: 'bloqueado', label: 'Bloqueado', color: 'bg-red-100 text-red-700' },
                  { value: 'concluido', label: 'Concluído', color: 'bg-blue-100 text-blue-700' },
                  { value: 'cancelado', label: 'Cancelado', color: 'bg-slate-200 text-slate-500' }
                ].map(status => (
                  <label 
                    key={status.value} 
                    className={`flex items-center space-x-1.5 px-2 py-1 rounded cursor-pointer transition-all ${
                      form.status_filter?.includes(status.value) 
                        ? status.color + ' ring-2 ring-offset-1 ring-slate-400' 
                        : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.status_filter?.includes(status.value) || false}
                      onChange={(e) => {
                        const currentStatuses = form.status_filter || [];
                        if (e.target.checked) {
                          setForm(prev => ({ ...prev, status_filter: [...currentStatuses, status.value] }));
                        } else {
                          setForm(prev => ({ ...prev, status_filter: currentStatuses.filter(s => s !== status.value) }));
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-xs font-medium">{status.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-1">Deixe vazio para mostrar todos os estados</p>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_public"
              checked={form.is_public}
              onChange={(e) => setForm(prev => ({ ...prev, is_public: e.target.checked }))}
              className="w-4 h-4 text-slate-600 border-slate-300 rounded focus:ring-slate-500"
            />
            <label htmlFor="is_public" className="ml-2 text-sm text-slate-700">
              Vista pública (visível para todos os utilizadores)
            </label>
          </div>

          {/* Permissions Section */}
          {form.is_public && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Shield className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-medium text-amber-900">Controlo de Acesso</h4>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                Selecione quais roles podem ver e editar esta listagem:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {['admin', 'producao', 'comercial', 'operador'].map(role => (
                  <label key={role} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowed_roles?.includes(role) ?? true}
                      onChange={(e) => {
                        const currentRoles = form.allowed_roles || ['admin', 'producao', 'comercial', 'operador'];
                        if (e.target.checked) {
                          setForm(prev => ({ ...prev, allowed_roles: [...currentRoles, role] }));
                        } else {
                          setForm(prev => ({ ...prev, allowed_roles: currentRoles.filter(r => r !== role) }));
                        }
                      }}
                      className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700 capitalize">{role}</span>
                  </label>
                ))}
              </div>
              
              {/* Edit Permissions */}
              <div className="mt-4 pt-3 border-t border-amber-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Pencil className="w-3 h-3 text-amber-600" />
                  <span className="text-xs font-medium text-amber-900">Permissões de Edição</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {['admin', 'producao', 'comercial', 'operador'].map(role => (
                    <label key={`edit-${role}`} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.edit_roles?.includes(role) ?? (role === 'admin' || role === 'producao')}
                        onChange={(e) => {
                          const currentRoles = form.edit_roles || ['admin', 'producao'];
                          if (e.target.checked) {
                            setForm(prev => ({ ...prev, edit_roles: [...currentRoles, role] }));
                          } else {
                            setForm(prev => ({ ...prev, edit_roles: currentRoles.filter(r => r !== role) }));
                          }
                        }}
                        className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-slate-700 capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Columns Configuration */}
          <div className="grid grid-cols-2 gap-6">
            {/* Available Fields - Grouped */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Campos Disponíveis</h3>
              <div className="border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                
                {/* Ordem de Fabrico Section */}
                <div className="border-b border-slate-100">
                  <button
                    onClick={() => setExpandedOF(!expandedOF)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Ordem de Fabrico</span>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        {unusedOFFields.length}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${expandedOF ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {expandedOF && (
                    <div className="p-2 space-y-0.5 bg-white">
                      {unusedOFFields.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">Todos os campos adicionados</p>
                      ) : (
                        unusedOFFields.map(field => (
                          <button
                            key={field.field}
                            onClick={() => onAddColumn(field)}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-between group"
                          >
                            <span className="text-sm text-slate-700">{field.label}</span>
                            <Plus className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Checkpoints Section */}
                <div>
                  <button
                    onClick={() => setExpandedCheckpoints(!expandedCheckpoints)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-900">Checkpoints por Etapa</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-emerald-600 transition-transform ${expandedCheckpoints ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedCheckpoints && groupedFields?.checkpoints?.stages && (
                    <div className="bg-white">
                      {groupedFields.checkpoints.stages.map(stage => {
                        const unusedCheckpoints = getUnusedCheckpointFields(stage);
                        const isExpanded = expandedStages[stage.id] ?? true;
                        
                        if (unusedCheckpoints.length === 0) return null;
                        
                        return (
                          <div key={stage.id} className="border-t border-slate-100">
                            <button
                              onClick={() => toggleStage(stage.id)}
                              className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-2.5 h-2.5 rounded-full" 
                                  style={{ backgroundColor: stage.cor }}
                                />
                                <span className="text-sm font-medium text-slate-700">{stage.nome}</span>
                                <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {unusedCheckpoints.length}
                                </span>
                              </div>
                              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                            
                            {isExpanded && (
                              <div className="pl-6 pr-2 pb-2 space-y-0.5">
                                {unusedCheckpoints.map(field => (
                                  <button
                                    key={field.field}
                                    onClick={() => onAddColumn({
                                      ...field,
                                      label: field.label // Keep clean label without stage prefix
                                    })}
                                    className="w-full text-left px-3 py-1.5 rounded-md hover:bg-emerald-50 transition-colors flex items-center justify-between group"
                                  >
                                    <span className="text-sm text-slate-600">{field.label}</span>
                                    <Plus className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {!hasUnusedCheckpoints && (
                        <p className="text-xs text-slate-400 text-center py-3">Todos os checkpoints adicionados</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Columns */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Colunas Selecionadas ({form.columns.length})
              </h3>
              <div className="border border-slate-200 rounded-lg p-3 max-h-80 overflow-y-auto space-y-1">
                {form.columns.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    Adicione campos da lista à esquerda
                  </p>
                ) : (
                  form.columns.map((col, index) => {
                    // Checkpoints are always editable
                    const isCheckpoint = col.field.startsWith('checkpoint_');
                    const canBeEditable = isCheckpoint || editableFields.includes(col.field);
                    
                    return (
                    <div
                      key={col.field}
                      className={`flex items-center space-x-2 px-2 py-1.5 rounded-md ${
                        isCheckpoint 
                          ? 'bg-emerald-50 border border-emerald-100' 
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <button
                          onClick={() => onMoveColumn(index, -1)}
                          disabled={index === 0}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onMoveColumn(index, 1)}
                          disabled={index === form.columns.length - 1}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-700 block truncate">{col.label}</span>
                        {isCheckpoint && (
                          <span className="text-xs text-emerald-600">Checkpoint</span>
                        )}
                      </div>
                      <button
                        onClick={() => onToggleEditable(index)}
                        data-testid={`toggle-editable-${col.field}`}
                        className={`p-1.5 rounded transition-colors ${
                          col.editable 
                            ? 'bg-green-100 text-green-600' 
                            : canBeEditable
                              ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        }`}
                        title={col.editable ? 'Editável' : canBeEditable ? 'Clique para tornar editável' : 'Campo não editável'}
                        disabled={!canBeEditable}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRemoveColumn(index)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            data-testid="save-view-btn"
            onClick={onSave}
            className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            {editing ? 'Guardar Alterações' : 'Criar Vista'}
          </button>
        </div>
      </div>
    </div>
  );
};

// View Data Table Component with Inline Editing, Filtering, Sorting and Search
const ViewDataTable = ({ view, data, loading, onClose, onRefresh }) => {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [compactMode, setCompactMode] = useState(true); // Default to compact
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef(null);
  
  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  // Export to PDF function
  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Create a printable HTML table
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${view.nome} - Exportação</title>
          <style>
            @page { 
              size: A4 landscape; 
              margin: 10mm;
            }
            * { 
              box-sizing: border-box; 
              margin: 0; 
              padding: 0;
            }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 9px;
              color: #1e293b;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 2px solid #0f172a;
            }
            .header h1 {
              font-size: 14px;
              font-weight: bold;
            }
            .header .meta {
              font-size: 8px;
              color: #64748b;
            }
            table { 
              width: 100%; 
              border-collapse: collapse;
              table-layout: fixed;
            }
            th { 
              background: #0f172a; 
              color: white; 
              padding: 4px 3px;
              text-align: left;
              font-size: 8px;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            td { 
              border: 1px solid #e2e8f0; 
              padding: 3px;
              font-size: 8px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100px;
            }
            tr:nth-child(even) { background: #f8fafc; }
            tr:hover { background: #f1f5f9; }
            .status {
              display: inline-block;
              padding: 1px 4px;
              border-radius: 3px;
              font-size: 7px;
              font-weight: 600;
            }
            .status-ativo { background: #dcfce7; color: #166534; }
            .status-atrasado { background: #fef3c7; color: #92400e; }
            .status-concluido { background: #dbeafe; color: #1e40af; }
            .status-rascunho { background: #f1f5f9; color: #475569; }
            .status-bloqueado { background: #fee2e2; color: #991b1b; }
            .boolean-yes { color: #16a34a; font-weight: 600; }
            .boolean-no { color: #94a3b8; }
            .footer {
              margin-top: 10px;
              padding-top: 5px;
              border-top: 1px solid #e2e8f0;
              font-size: 7px;
              color: #64748b;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${view.nome}</h1>
            <div class="meta">
              <div>Exportado: ${new Date().toLocaleString('pt-PT')}</div>
              <div>Total: ${filteredAndSortedData.length} registos</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                ${view.columns?.map(col => `<th>${col.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredAndSortedData.map(project => `
                <tr>
                  ${view.columns?.map(col => {
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
            <span>${view.descricao || ''}</span>
          </div>
        </body>
        </html>
      `;

      // Open print dialog
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
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
      await api.patch(`/custom-views/${view.id}/data/${editingCell.projectId}`, {
        field: editingCell.field,
        value: editValue
      });
      toast.success('Campo atualizado com sucesso');
      onRefresh();
      cancelEdit();
    } catch (error) {
      console.error('Failed to save edit:', error);
      toast.error(error.response?.data?.detail || 'Erro ao guardar alteração');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Handle sorting
  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle column filter change
  const handleFilterChange = (field, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setColumnFilters({});
    setSortConfig({ field: null, direction: 'asc' });
  };

  // Get unique values for a column (for filter dropdowns)
  const getUniqueValues = (field) => {
    if (!data?.data) return [];
    const values = data.data.map(item => item[field]).filter(v => v !== null && v !== undefined);
    return [...new Set(values)].sort();
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!data?.data) return [];
    
    let result = [...data.data];
    
    // Apply search filter (searches across all visible columns)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(item => {
        return view.columns?.some(col => {
          const value = item[col.field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }
    
    // Apply column filters
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
    
    // Apply sorting
    if (sortConfig.field) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.field];
        const bVal = b[sortConfig.field];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        // Date comparison
        if (typeof aVal === 'string' && aVal.includes('T') && aVal.includes('-')) {
          const dateA = new Date(aVal);
          const dateB = new Date(bVal);
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
        
        // Number comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // String comparison
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        if (sortConfig.direction === 'asc') {
          return strA.localeCompare(strB);
        }
        return strB.localeCompare(strA);
      });
    }
    
    return result;
  }, [data?.data, searchTerm, columnFilters, sortConfig, view.columns]);

  const renderCellValue = (project, column) => {
    const value = project[column.field];
    const isEditing = editingCell?.projectId === project.id && editingCell?.field === column.field;
    
    // Checkpoints are always boolean type
    const isCheckpoint = column.field.startsWith('checkpoint_');
    const effectiveType = isCheckpoint ? 'boolean' : column.type;

    // If editing this cell
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
          <button
            onClick={saveEdit}
            disabled={saving}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelEdit}
            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    // Regular cell display
    if (column.type === 'date') {
      return value ? formatDate(value) : '-';
    }
    
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
          <div 
            className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
            style={{ backgroundColor: project.etapa_atual_cor || '#64748B' }}
          />
          <span className="truncate">{value || '-'}</span>
        </div>
      );
    }
    
    if (effectiveType === 'boolean') {
      return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
          value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
        }`}>
          {value ? '✓' : '✗'}
        </span>
      );
    }
    
    if (column.type === 'number' && column.field === 'progresso_percentagem') {
      return `${value || 0}%`;
    }

    return value ?? '-';
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || Object.values(columnFilters).some(v => v && v !== '__all__');

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-base font-medium text-slate-900">{view.nome}</h3>
            {view.descricao && (
              <p className="text-xs text-slate-500">{view.descricao}</p>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {/* Compact Mode Toggle */}
            <button
              onClick={() => setCompactMode(!compactMode)}
              className={`p-1.5 rounded-md transition-colors ${
                compactMode ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'
              }`}
              title={compactMode ? 'Modo normal' : 'Modo compacto'}
            >
              {compactMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {/* Export PDF */}
            <button
              onClick={exportToPDF}
              disabled={exporting}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
              title="Exportar PDF (horizontal)"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
            </button>
            {/* Refresh */}
            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* Close */}
            <button
              data-testid="close-view-btn"
              onClick={onClose}
              className="inline-flex items-center px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-md transition-colors text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Fechar
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
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

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-3 py-2 border rounded-lg text-sm transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {Object.values(columnFilters).filter(v => v && v !== '__all__').length + (searchTerm ? 1 : 0)}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
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
              {view.columns?.map((col) => (
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
                        {col.type === 'boolean' ? (val ? 'Sim' : 'Não') : 
                         col.type === 'date' ? formatDate(val) : String(val)}
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
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">A carregar dados...</div>
        ) : (
          <table className={`w-full ${compactMode ? 'text-xs' : 'text-sm'}`}>
            <thead>
              <tr className="bg-slate-800 text-white font-medium">
                {view.columns?.map((col) => (
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
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-blue-400 flex-shrink-0" />
                        )
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
                  <td colSpan={view.columns?.length || 1} className={`${compactMode ? 'px-2 py-6' : 'px-4 py-12'} text-center text-slate-400`}>
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
                    {view.columns?.map((col) => (
                      <td 
                        key={col.field} 
                        className={`${compactMode ? 'px-1.5 py-1' : 'px-3 py-2'} ${col.editable && !editingCell ? 'cursor-pointer bg-amber-50 hover:bg-amber-100 border-l-2 border-amber-400' : ''} whitespace-nowrap overflow-hidden text-ellipsis`}
                        style={{ maxWidth: compactMode ? '120px' : '200px' }}
                        onClick={() => col.editable && !editingCell && startEdit(project.id, col.field, project[col.field])}
                        data-testid={col.editable ? `editable-cell-${project.id}-${col.field}` : undefined}
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

      {/* Footer with pagination info */}
      {data && (
        <div className={`${compactMode ? 'px-3 py-1.5' : 'px-4 py-2'} border-t border-slate-100 flex justify-between items-center text-xs text-slate-500`}>
          <span>
            {filteredAndSortedData.length} de {data.total || 0} registos
            {hasActiveFilters && ` (filtrado)`}
          </span>
          <div className="flex items-center space-x-3">
            {view.columns?.filter(c => c.editable).length > 0 && (
              <span className="flex items-center bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-medium">
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Editável
              </span>
            )}
            <span className="text-slate-400">
              {compactMode ? 'Compacto' : 'Normal'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomListings;
