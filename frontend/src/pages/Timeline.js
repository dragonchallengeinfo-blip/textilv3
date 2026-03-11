import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Search,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Flag,
  ArrowRight,
  Plus,
  X,
  Clock,
  RefreshCw
} from 'lucide-react';
import { formatDate } from '@/utils/helpers';

const Timeline = () => {
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eventTypes, setEventTypes] = useState([]);
  const [problemTypes, setProblemTypes] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    tipo_evento: 'nota',
    tipo_problema: null,
    descricao: '',
    impacto_dias: 0
  });

  useEffect(() => {
    fetchProjects();
    fetchEventTypes();
  }, []);

  const fetchProjects = async (search = '') => {
    try {
      const response = await api.get(`/planning/projects${search ? `?search=${search}` : ''}`);
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const response = await api.get('/timeline/types');
      setEventTypes(response.data.event_types);
      setProblemTypes(response.data.problem_types);
    } catch (error) {
      console.error('Failed to fetch event types:', error);
    }
  };

  const selectProject = async (project) => {
    setSelectedProject(project);
    setLoading(true);
    try {
      const response = await api.get(`/timeline/${project.id}`);
      setTimelineData(response.data);
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
      toast.error('Erro ao carregar timeline');
    } finally {
      setLoading(false);
    }
  };

  const refreshTimeline = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const response = await api.get(`/timeline/${selectedProject.id}`);
      setTimelineData(response.data);
    } catch (error) {
      console.error('Failed to refresh timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async () => {
    if (!selectedProject || !newEvent.tipo_evento) return;
    
    try {
      await api.post(`/timeline/${selectedProject.id}`, {
        ...newEvent,
        projeto_id: selectedProject.id
      });
      toast.success('Evento adicionado com sucesso');
      setShowAddEvent(false);
      setNewEvent({ tipo_evento: 'nota', tipo_problema: null, descricao: '', impacto_dias: 0 });
      refreshTimeline();
    } catch (error) {
      console.error('Failed to add event:', error);
      toast.error('Erro ao adicionar evento');
    }
  };

  const resolveProblema = async (eventId) => {
    if (!selectedProject) return;
    
    try {
      await api.patch(`/timeline/${selectedProject.id}/event/${eventId}`, {
        resolvido: true
      });
      toast.success('Problema marcado como resolvido');
      refreshTimeline();
    } catch (error) {
      console.error('Failed to resolve problem:', error);
      toast.error('Erro ao resolver problema');
    }
  };

  const getEventIcon = (tipoEvento) => {
    const icons = {
      'inicio': Play,
      'pausa': Pause,
      'retoma': Play,
      'problema': AlertTriangle,
      'problema_resolvido': CheckCircle2,
      'mudanca_etapa': ArrowRight,
      'conclusao': Flag,
      'nota': MessageSquare
    };
    return icons[tipoEvento] || MessageSquare;
  };

  const getEventColor = (tipoEvento) => {
    const event = eventTypes.find(e => e.value === tipoEvento);
    return event?.color || '#64748B';
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    fetchProjects(e.target.value);
  };

  return (
    <MainLayout title="Timeline de Produção">
      <div data-testid="timeline-page" className="space-y-6">
        {/* Project Selection */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Selecionar Projeto</h2>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              data-testid="project-search"
              placeholder="Pesquisar por OF ou modelo..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
            {projects.map(project => (
              <button
                key={project.id}
                data-testid={`project-${project.id}`}
                onClick={() => selectProject(project)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedProject?.id === project.id
                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-mono text-sm font-semibold text-slate-900">{project.of_numero}</div>
                <div className="text-xs text-slate-500 truncate">{project.modelo}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {selectedProject && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status Summary */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">
                  {selectedProject.of_numero}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Modelo:</span>
                    <span className="text-slate-900">{timelineData?.project?.modelo}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Quantidade:</span>
                    <span className="text-slate-900">{timelineData?.project?.quantidade?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Status:</span>
                    <span className={`font-medium ${
                      timelineData?.project?.status_projeto === 'ativo' ? 'text-green-600' :
                      timelineData?.project?.status_projeto === 'bloqueado' ? 'text-yellow-600' :
                      timelineData?.project?.status_projeto === 'atrasado' ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {timelineData?.project?.status_projeto}
                    </span>
                  </div>
                  
                  {/* Summary badges */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    {timelineData?.summary?.is_paused && (
                      <div className="flex items-center text-yellow-600 text-sm">
                        <Pause className="w-4 h-4 mr-2" />
                        Produção Pausada
                      </div>
                    )}
                    {timelineData?.summary?.active_problems > 0 && (
                      <div className="flex items-center text-red-600 text-sm">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        {timelineData.summary.active_problems} Problema(s) Ativo(s)
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <h4 className="font-medium text-slate-900 mb-3">Ações Rápidas</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'pausa', tipo_problema: null, descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-2 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors flex items-center justify-center"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pausar
                  </button>
                  <button
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'retoma', tipo_problema: null, descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Retomar
                  </button>
                  <button
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'problema', tipo_problema: 'outro', descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center"
                  >
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Problema
                  </button>
                  <button
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'nota', tipo_problema: null, descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-2 text-sm bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Nota
                  </button>
                </div>
              </div>

              {/* Active Problems */}
              {timelineData?.summary?.problems_list?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Problemas Ativos
                  </h4>
                  <div className="space-y-2">
                    {timelineData.summary.problems_list.map(problem => (
                      <div key={problem.id} className="flex items-start justify-between p-2 bg-white rounded border border-red-100">
                        <div className="flex-1">
                          <p className="text-sm text-slate-900">{problem.descricao || 'Sem descrição'}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {problemTypes.find(p => p.value === problem.tipo_problema)?.label || problem.tipo_problema}
                          </p>
                        </div>
                        <button
                          onClick={() => resolveProblema(problem.id)}
                          className="ml-2 p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Marcar como resolvido"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Events Timeline */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-slate-900">Histórico de Eventos</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={refreshTimeline}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      data-testid="add-event-btn"
                      onClick={() => setShowAddEvent(true)}
                      className="inline-flex items-center px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Evento
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  {loading ? (
                    <div className="text-center text-slate-400 py-8">A carregar...</div>
                  ) : timelineData?.events?.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                      Nenhum evento registado
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                      
                      <div className="space-y-6">
                        {timelineData?.events?.map((event, idx) => {
                          const EventIcon = getEventIcon(event.tipo_evento);
                          const color = getEventColor(event.tipo_evento);
                          const eventType = eventTypes.find(e => e.value === event.tipo_evento);
                          
                          return (
                            <div key={event.id} className="relative flex items-start ml-4 pl-6">
                              {/* Icon */}
                              <div 
                                className="absolute -left-4 w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: color }}
                              >
                                <EventIcon className="w-4 h-4 text-white" />
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 bg-slate-50 rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span 
                                      className="text-sm font-medium"
                                      style={{ color }}
                                    >
                                      {eventType?.label || event.tipo_evento}
                                    </span>
                                    {event.tipo_problema && (
                                      <span className="text-xs text-slate-500 ml-2">
                                        ({problemTypes.find(p => p.value === event.tipo_problema)?.label || event.tipo_problema})
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-400">
                                    {formatDate(event.data_evento)}
                                  </span>
                                </div>
                                
                                {event.descricao && (
                                  <p className="text-sm text-slate-600 mt-2">{event.descricao}</p>
                                )}
                                
                                {event.impacto_dias > 0 && (
                                  <p className="text-xs text-red-600 mt-1 flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Impacto: +{event.impacto_dias} dias
                                  </p>
                                )}
                                
                                <p className="text-xs text-slate-400 mt-2">
                                  por {event.criado_por_nome}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Event Modal */}
        {showAddEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Adicionar Evento</h2>
                <button onClick={() => setShowAddEvent(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Tipo de Evento *
                  </label>
                  <select
                    data-testid="event-type-select"
                    value={newEvent.tipo_evento}
                    onChange={(e) => setNewEvent(prev => ({ 
                      ...prev, 
                      tipo_evento: e.target.value,
                      tipo_problema: e.target.value === 'problema' ? 'outro' : null
                    }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  >
                    {eventTypes.map(et => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>
                
                {newEvent.tipo_evento === 'problema' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Tipo de Problema
                    </label>
                    <select
                      data-testid="problem-type-select"
                      value={newEvent.tipo_problema || ''}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, tipo_problema: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    >
                      {problemTypes.map(pt => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Descrição
                  </label>
                  <textarea
                    data-testid="event-description"
                    value={newEvent.descricao}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Descreva o evento..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
                
                {(newEvent.tipo_evento === 'problema' || newEvent.tipo_evento === 'pausa') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Impacto Estimado (dias)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newEvent.impacto_dias}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, impacto_dias: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddEvent(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  data-testid="save-event-btn"
                  onClick={addEvent}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Timeline;
