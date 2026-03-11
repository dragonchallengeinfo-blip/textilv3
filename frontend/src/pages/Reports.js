import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  FileText, RefreshCw, Printer, Settings, Clock, AlertTriangle,
  Calendar, CheckSquare, Bell, Factory, Users, MessageSquare,
  ChevronDown, ChevronRight, Plus, Trash2, Archive, X
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/helpers';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [config, setConfig] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [showAddAnnotation, setShowAddAnnotation] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({
    projeto_id: '',
    texto: '',
    tipo: 'nota',
    data_lembrete: ''
  });
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportRes, configRes, annotationsRes, projectsRes] = await Promise.all([
        api.get('/reports/daily'),
        api.get('/reports/config'),
        api.get('/reports/annotations'),
        api.get('/projects/')
      ]);
      setReportData(reportRes.data);
      setConfig(configRes.data);
      setAnnotations(annotationsRes.data);
      setProjects(projectsRes.data.filter(p => p.status_projeto !== 'concluido'));
      
      // Expand high priority sections by default
      const expanded = {};
      Object.entries(reportRes.data.sections).forEach(([key, section]) => {
        if (section.priority === 'high' && section.count > 0) {
          expanded[key] = true;
        }
      });
      setExpandedSections(expanded);
    } catch (error) {
      console.error('Failed to fetch report:', error);
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.open(`${process.env.REACT_APP_BACKEND_URL}/api/reports/daily/html`, '_blank');
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addAnnotation = async () => {
    if (!newAnnotation.texto.trim()) {
      toast.error('Escreva uma nota');
      return;
    }
    try {
      await api.post('/reports/annotations', newAnnotation);
      toast.success('Nota adicionada');
      setShowAddAnnotation(false);
      setNewAnnotation({ projeto_id: '', texto: '', tipo: 'nota', data_lembrete: '' });
      fetchData();
    } catch (error) {
      toast.error('Erro ao adicionar nota');
    }
  };

  const archiveAnnotation = async (id) => {
    try {
      await api.patch(`/reports/annotations/${id}/archive`);
      toast.success('Nota arquivada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao arquivar');
    }
  };

  const deleteAnnotation = async (id) => {
    if (!window.confirm('Eliminar esta nota?')) return;
    try {
      await api.delete(`/reports/annotations/${id}`);
      toast.success('Nota eliminada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao eliminar');
    }
  };

  const getSectionIcon = (key) => {
    const icons = {
      delayed_projects: Clock,
      deliveries_today: Calendar,
      deliveries_week: Calendar,
      pending_checkpoints: CheckSquare,
      alerts: Bell,
      capacity: Factory,
      sem_confeccao: Users,
      annotations: MessageSquare,
      reported_delays: AlertTriangle
    };
    return icons[key] || FileText;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-50 border-red-200';
      case 'medium': return 'bg-amber-50 border-amber-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getPriorityHeaderColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-600';
      case 'medium': return 'bg-amber-500';
      default: return 'bg-slate-600';
    }
  };

  if (loading) {
    return (
      <MainLayout title="Relatórios">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Relatórios">
      <div data-testid="reports-page" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Relatório Diário</h2>
            <p className="text-sm text-slate-500">
              Gerado em {formatDateTime(reportData?.generated_at)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center space-x-1"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Atualizar</span>
            </button>
            <button
              onClick={handlePrint}
              data-testid="print-report-btn"
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-1"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border ${
            reportData?.summary?.overall_status === 'critical' ? 'bg-red-50 border-red-200' :
            reportData?.summary?.overall_status === 'attention' ? 'bg-amber-50 border-amber-200' :
            'bg-green-50 border-green-200'
          }`}>
            <p className="text-sm font-medium text-slate-600">Total de Itens</p>
            <p className="text-3xl font-bold mt-1">{reportData?.summary?.total_items || 0}</p>
          </div>
          <div className={`p-4 rounded-xl border ${
            reportData?.summary?.high_priority_sections > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="text-sm font-medium text-slate-600">Secções Críticas</p>
            <p className="text-3xl font-bold mt-1 text-red-600">{reportData?.summary?.high_priority_sections || 0}</p>
          </div>
          <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
            <p className="text-sm font-medium text-slate-600">Atrasados</p>
            <p className="text-3xl font-bold mt-1">{reportData?.sections?.delayed_projects?.count || 0}</p>
          </div>
          <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
            <p className="text-sm font-medium text-slate-600">Entregas Hoje</p>
            <p className="text-3xl font-bold mt-1">{reportData?.sections?.deliveries_today?.count || 0}</p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {reportData?.sections && Object.entries(reportData.sections).map(([key, section]) => {
            const Icon = getSectionIcon(key);
            const isExpanded = expandedSections[key];
            
            if (section.count === 0 && section.priority !== 'high') return null;
            
            return (
              <div 
                key={key}
                className={`rounded-xl border overflow-hidden ${getPriorityColor(section.priority)}`}
              >
                <button
                  onClick={() => toggleSection(key)}
                  className={`w-full px-4 py-3 flex items-center justify-between text-white ${getPriorityHeaderColor(section.priority)}`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.title}</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
                      {section.count}
                    </span>
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                
                {isExpanded && section.items?.length > 0 && (
                  <div className="p-4 bg-white">
                    {/* Different layouts based on section type */}
                    {key === 'delayed_projects' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-500 border-b">
                              <th className="pb-2">OF</th>
                              <th className="pb-2">Modelo</th>
                              <th className="pb-2">Confecção</th>
                              <th className="pb-2">Etapa</th>
                              <th className="pb-2">Atraso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {section.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 font-mono text-xs">{item.of_numero}</td>
                                <td className="py-2">{item.modelo}</td>
                                <td className="py-2">{item.parceiro_nome}</td>
                                <td className="py-2">{item.etapa_nome}</td>
                                <td className="py-2">
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                    {item.dias_atraso} dias
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {key === 'capacity' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {section.items.map((item, idx) => (
                          <div key={idx} className={`p-3 rounded-lg border ${
                            item.status === 'sobrecarregado' ? 'bg-red-50 border-red-200' :
                            item.status === 'alto' ? 'bg-amber-50 border-amber-200' :
                            'bg-green-50 border-green-200'
                          }`}>
                            <p className="font-medium text-slate-900">{item.nome}</p>
                            <div className="flex items-center justify-between mt-2 text-sm">
                              <span className="text-slate-500">Utilização</span>
                              <span className={`font-bold ${
                                item.utilizacao > 100 ? 'text-red-600' :
                                item.utilizacao > 80 ? 'text-amber-600' :
                                'text-green-600'
                              }`}>{item.utilizacao}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                              <div 
                                className={`h-2 rounded-full ${
                                  item.utilizacao > 100 ? 'bg-red-500' :
                                  item.utilizacao > 80 ? 'bg-amber-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(item.utilizacao, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {key === 'alerts' && (
                      <div className="space-y-2">
                        {section.items.map((item, idx) => (
                          <div key={idx} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-slate-50">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              item.prioridade === 'alta' ? 'bg-red-100 text-red-700' :
                              item.prioridade === 'media' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{item.prioridade || 'info'}</span>
                            <p className="text-sm text-slate-700">{item.mensagem}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {key === 'reported_delays' && (
                      <div className="space-y-2">
                        {section.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border-l-4 border-red-400">
                            <div className="flex items-center space-x-3">
                              <span className="font-mono text-xs text-slate-600">{item.of_numero}</span>
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{item.tipo_evento}</span>
                              <span className="text-sm text-slate-700">{item.descricao?.substring(0, 50)}</span>
                            </div>
                            <span className="text-xs text-slate-400">{formatDate(item.data_evento)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(key === 'deliveries_today' || key === 'deliveries_week' || key === 'sem_confeccao') && (
                      <div className="space-y-2">
                        {section.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                            <div className="flex items-center space-x-3">
                              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{item.of_numero}</span>
                              <span className="text-sm text-slate-700">{item.modelo}</span>
                              <span className="text-xs text-slate-500">{item.quantidade?.toLocaleString()} pcs</span>
                            </div>
                            {item.data_prevista_entrega && (
                              <span className="text-xs text-slate-500">{formatDate(item.data_prevista_entrega)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {key === 'pending_checkpoints' && (
                      <div className="space-y-2">
                        {section.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                            <div className="flex items-center space-x-3">
                              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{item.of_numero}</span>
                              <span className="text-sm text-slate-700">{item.checkpoint_nome}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {key === 'annotations' && (
                      <div className="space-y-2">
                        {section.items.map((item, idx) => (
                          <div key={idx} className={`flex items-start justify-between p-3 rounded-lg border ${
                            item.tipo === 'urgente' ? 'bg-red-50 border-red-200' :
                            item.tipo === 'atencao' ? 'bg-amber-50 border-amber-200' :
                            'bg-blue-50 border-blue-200'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                {item.of_numero && (
                                  <span className="font-mono text-xs bg-white px-2 py-0.5 rounded">{item.of_numero}</span>
                                )}
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  item.tipo === 'urgente' ? 'bg-red-100 text-red-700' :
                                  item.tipo === 'atencao' ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>{item.tipo}</span>
                              </div>
                              <p className="text-sm text-slate-700">{item.texto}</p>
                            </div>
                            <div className="flex items-center space-x-1 ml-3">
                              <button onClick={() => archiveAnnotation(item.id)} className="p-1 hover:bg-white rounded">
                                <Archive className="w-4 h-4 text-slate-400" />
                              </button>
                              <button onClick={() => deleteAnnotation(item.id)} className="p-1 hover:bg-white rounded">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Annotation */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-900">Anotações e Lembretes</h3>
            <button
              onClick={() => setShowAddAnnotation(!showAddAnnotation)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-1 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Nota</span>
            </button>
          </div>
          
          {showAddAnnotation && (
            <div className="border border-slate-200 rounded-lg p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Projeto (opcional)</label>
                  <select
                    value={newAnnotation.projeto_id}
                    onChange={(e) => setNewAnnotation(prev => ({ ...prev, projeto_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Geral</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.of_numero} - {p.modelo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select
                    value={newAnnotation.tipo}
                    onChange={(e) => setNewAnnotation(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="nota">Nota</option>
                    <option value="atencao">Atenção</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nota</label>
                <textarea
                  value={newAnnotation.texto}
                  onChange={(e) => setNewAnnotation(prev => ({ ...prev, texto: e.target.value }))}
                  rows={2}
                  placeholder="Escreva a sua nota..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lembrete (opcional)</label>
                <input
                  type="date"
                  value={newAnnotation.data_lembrete}
                  onChange={(e) => setNewAnnotation(prev => ({ ...prev, data_lembrete: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowAddAnnotation(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={addAnnotation}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}
          
          {/* List existing annotations */}
          {annotations.length > 0 && (
            <div className="space-y-2">
              {annotations.slice(0, 5).map(ann => (
                <div key={ann.id} className={`flex items-start justify-between p-3 rounded-lg border ${
                  ann.tipo === 'urgente' ? 'bg-red-50 border-red-200' :
                  ann.tipo === 'atencao' ? 'bg-amber-50 border-amber-200' :
                  'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      {ann.of_numero && (
                        <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border">{ann.of_numero}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ann.tipo === 'urgente' ? 'bg-red-100 text-red-700' :
                        ann.tipo === 'atencao' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{ann.tipo}</span>
                      <span className="text-xs text-slate-400">{formatDateTime(ann.criado_em)}</span>
                    </div>
                    <p className="text-sm text-slate-700">{ann.texto}</p>
                  </div>
                  <div className="flex items-center space-x-1 ml-3">
                    <button onClick={() => archiveAnnotation(ann.id)} className="p-1 hover:bg-white rounded" title="Arquivar">
                      <Archive className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    </button>
                    <button onClick={() => deleteAnnotation(ann.id)} className="p-1 hover:bg-white rounded" title="Eliminar">
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Reports;
