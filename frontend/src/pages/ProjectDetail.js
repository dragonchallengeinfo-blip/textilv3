import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, Edit, Clock, CheckSquare, Package, Paperclip, History as HistoryIcon,
  Calendar, Save, Calculator, Play, Pause, AlertTriangle, CheckCircle2, MessageSquare,
  Flag, Plus, X, RefreshCw, Upload, FileText, Trash2, Download, Circle, ArrowRight,
  Euro, Timer, Settings, Check, Info, ArrowRightLeft, User, Filter, ChevronDown, 
  ChevronRight, Activity, PlusCircle, Pencil, Eye
} from 'lucide-react';
import { formatDate, formatDateTime, getStatusColor, getStatusLabel } from '@/utils/helpers';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [stagePlanning, setStagePlanning] = useState([]);
  const [checkpointResponses, setCheckpointResponses] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [history, setHistory] = useState([]);
  const [timelineData, setTimelineData] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('geral');
  
  // Reference data
  const [brands, setBrands] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Planning state
  const [planning, setPlanning] = useState([]);
  const [dataEntrega, setDataEntrega] = useState('');
  const [dataEntradaConfeccao, setDataEntradaConfeccao] = useState('');
  const [diasPorEtapa, setDiasPorEtapa] = useState({});
  const [savingPlanning, setSavingPlanning] = useState(false);
  
  // Timeline state
  const [eventTypes, setEventTypes] = useState([]);
  const [problemTypes, setProblemTypes] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    tipo_evento: 'nota',
    tipo_problema: null,
    descricao: '',
    impacto_dias: 0
  });
  
  // Checkpoint state
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);
  const [checkpointValues, setCheckpointValues] = useState({});
  
  // Attachment state
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Piece Cost state
  const [pieceCostConfig, setPieceCostConfig] = useState({
    custo_hora_confeccao: 8.0,
    custo_hora_minimo: 5.0,
    custo_hora_maximo: 25.0,
    margem_percentagem: 15.0,
    incluir_margem: true
  });
  const [pieceCostCalculations, setPieceCostCalculations] = useState([]);
  const [currentPieceCost, setCurrentPieceCost] = useState(null);
  const [pieceCostMode, setPieceCostMode] = useState('tempo_para_custo');
  const [pieceCostInput, setPieceCostInput] = useState({
    custo: '',
    tempo: '',
    custo_hora: 8.0,
    margem: 15.0,
    incluir_margem: true
  });
  const [pieceCostResult, setPieceCostResult] = useState(null);
  const [pieceCostFinal, setPieceCostFinal] = useState({ tempo: '', custo: '' });
  const [savingPieceCost, setSavingPieceCost] = useState(false);
  const [showPieceCostConfig, setShowPieceCostConfig] = useState(false);

  // Complete Timeline state
  const [completeTimeline, setCompleteTimeline] = useState(null);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});

  useEffect(() => {
    fetchProjectData();
    fetchPieceCostData();
  }, [id]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, planningRes, checkpointsRes, historyRes, timelineTypesRes, brandsRes, orderTypesRes, partnersRes, usersRes, suppliersRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/planning/${id}`),
        api.get(`/checkpoints/responses/project/${id}`),
        api.get(`/history/?entidade=project&entidade_id=${id}`),
        api.get('/timeline/types'),
        api.get('/brands/'),
        api.get('/order-types/'),
        api.get('/partners/'),
        api.get('/users/'),
        api.get('/suppliers/')
      ]);
      
      setProject(projectRes.data);
      setBrands(brandsRes.data);
      setOrderTypes(orderTypesRes.data);
      setPartners(partnersRes.data);
      setUsers(usersRes.data);
      setSuppliers(suppliersRes.data);
      
      // Planning data
      if (planningRes.data.planning) {
        setPlanning(planningRes.data.planning);
        const dias = {};
        planningRes.data.planning.forEach(p => {
          if (p.dias_previstos !== undefined) {
            dias[p.key] = p.dias_previstos;
          }
        });
        setDiasPorEtapa(dias);
      }
      
      if (projectRes.data.data_prevista_entrega) {
        const date = new Date(projectRes.data.data_prevista_entrega);
        setDataEntrega(date.toISOString().split('T')[0]);
      }
      
      // Load data_entrada_confecao if exists
      if (projectRes.data.data_entrada_confecao) {
        const date = new Date(projectRes.data.data_entrada_confecao);
        setDataEntradaConfeccao(date.toISOString().split('T')[0]);
      }
      
      setCheckpointResponses(checkpointsRes.data);
      setHistory(historyRes.data);
      setEventTypes(timelineTypesRes.data.event_types);
      setProblemTypes(timelineTypesRes.data.problem_types);
      
      // Fetch checkpoints for the project's stage
      if (projectRes.data.etapa_atual_id) {
        const allCheckpoints = await api.get(`/checkpoints/`);
        setCheckpoints(allCheckpoints.data);
        
        // Build checkpoint values from responses
        const values = {};
        checkpointsRes.data.forEach(r => {
          values[r.checkpoint_id] = r.valor;
        });
        setCheckpointValues(values);
      }
      
      // Fetch timeline
      try {
        const timelineRes = await api.get(`/timeline/${id}`);
        setTimelineData(timelineRes.data);
      } catch (e) {
        console.log('Timeline not available');
      }
      
      // Fetch attachments
      try {
        const attachRes = await api.get(`/projects/${id}/attachments`);
        setAttachments(attachRes.data);
      } catch (e) {
        console.log('Attachments not available');
      }
      
    } catch (error) {
      console.error('Failed to fetch project data:', error);
      toast.error('Erro ao carregar dados do projeto');
    } finally {
      setLoading(false);
    }
  };

  // Fetch complete timeline
  const fetchCompleteTimeline = useCallback(async (filtro = null) => {
    setTimelineLoading(true);
    try {
      const url = filtro && filtro !== 'all' 
        ? `/timeline/${id}/complete?filtro_tipo=${filtro}`
        : `/timeline/${id}/complete`;
      const response = await api.get(url);
      setCompleteTimeline(response.data);
      
      // Auto-expand hoje e ontem
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      setExpandedDates(prev => ({
        ...prev,
        [today]: true,
        [yesterday]: true
      }));
    } catch (error) {
      console.error('Failed to fetch complete timeline:', error);
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  // Carregar timeline quando muda para a tab
  useEffect(() => {
    if (activeTab === 'timeline' && !completeTimeline) {
      fetchCompleteTimeline();
    }
  }, [activeTab, completeTimeline, fetchCompleteTimeline]);

  // Planning functions
  const calculateDates = async () => {
    if (!dataEntrega) {
      toast.error('Defina a data de entrega');
      return;
    }

    try {
      const response = await api.post('/planning/calculate', {
        data_entrega: new Date(dataEntrega).toISOString(),
        dias_por_etapa: diasPorEtapa
      });
      
      setPlanning(prev => prev.map(stage => {
        const calculated = response.data[stage.key];
        if (calculated) {
          return {
            ...stage,
            data_inicio_prevista: calculated.data_inicio_prevista,
            data_fim_prevista: calculated.data_fim_prevista,
            dias_previstos: calculated.dias_previstos
          };
        }
        return stage;
      }));
      
      toast.success('Datas calculadas com sucesso');
    } catch (error) {
      console.error('Failed to calculate:', error);
      toast.error('Erro ao calcular datas');
    }
  };

  const updateStageDate = (stageKey, field, value) => {
    setPlanning(prev => prev.map(stage => {
      if (stage.key === stageKey) {
        return { ...stage, [field]: value ? new Date(value).toISOString() : null };
      }
      return stage;
    }));
  };

  const savePlanning = async () => {
    setSavingPlanning(true);
    try {
      // Save planning stages
      await api.post(`/planning/${id}`, {
        stages: planning.map(stage => ({
          ...stage,
          etapa_key: stage.key,
          dias_previstos: diasPorEtapa[stage.key] || stage.dias_previstos || 0
        }))
      });
      
      // Also update the project's data_entrada_confecao if it was set
      if (dataEntradaConfeccao) {
        await api.put(`/projects/${id}`, {
          data_entrada_confecao: new Date(dataEntradaConfeccao).toISOString()
        });
      }
      
      toast.success('Planeamento guardado com sucesso');
      
      const response = await api.get(`/planning/${id}`);
      setPlanning(response.data.planning);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Erro ao guardar planeamento');
    } finally {
      setSavingPlanning(false);
    }
  };

  // Timeline functions
  const addEvent = async () => {
    if (!newEvent.tipo_evento) return;
    
    try {
      await api.post(`/timeline/${id}`, {
        ...newEvent,
        projeto_id: id
      });
      toast.success('Evento adicionado com sucesso');
      setShowAddEvent(false);
      setNewEvent({ tipo_evento: 'nota', tipo_problema: null, descricao: '', impacto_dias: 0 });
      
      const response = await api.get(`/timeline/${id}`);
      setTimelineData(response.data);
      
      // Atualizar timeline completa
      fetchCompleteTimeline(timelineFilter);
    } catch (error) {
      console.error('Failed to add event:', error);
      toast.error('Erro ao adicionar evento');
    }
  };

  const resolveProblema = async (eventId) => {
    try {
      await api.patch(`/timeline/${id}/event/${eventId}`, { resolvido: true });
      toast.success('Problema marcado como resolvido');
      
      const response = await api.get(`/timeline/${id}`);
      setTimelineData(response.data);
      
      // Atualizar timeline completa
      fetchCompleteTimeline(timelineFilter);
    } catch (error) {
      console.error('Failed to resolve problem:', error);
      toast.error('Erro ao resolver problema');
    }
  };

  // Checkpoint functions
  const saveCheckpointResponse = async (checkpointId, value) => {
    setSavingCheckpoint(true);
    try {
      // Check if response already exists
      const existingResponse = checkpointResponses.find(r => r.checkpoint_id === checkpointId);
      
      if (existingResponse) {
        await api.put(`/checkpoints/responses/${existingResponse.id}`, { valor: value });
      } else {
        await api.post('/checkpoints/responses', {
          checkpoint_id: checkpointId,
          projeto_id: id,
          valor: value
        });
      }
      
      toast.success('Checkpoint guardado');
      setCheckpointValues(prev => ({ ...prev, [checkpointId]: value }));
      
      // Refresh responses
      const responsesRes = await api.get(`/checkpoints/responses/project/${id}`);
      setCheckpointResponses(responsesRes.data);
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
      toast.error('Erro ao guardar checkpoint');
    } finally {
      setSavingCheckpoint(false);
    }
  };

  // Attachment functions
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await api.post(`/projects/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Ficheiro carregado com sucesso');
      
      const attachRes = await api.get(`/projects/${id}/attachments`);
      setAttachments(attachRes.data);
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Erro ao carregar ficheiro');
    } finally {
      setUploadingFile(false);
    }
  };

  const deleteAttachment = async (attachmentId) => {
    try {
      await api.delete(`/projects/${id}/attachments/${attachmentId}`);
      toast.success('Ficheiro eliminado');
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      toast.error('Erro ao eliminar ficheiro');
    }
  };

  // Piece Cost functions
  const fetchPieceCostData = async () => {
    try {
      const [configRes, calculationsRes, currentRes] = await Promise.all([
        api.get('/piece-cost/config'),
        api.get(`/piece-cost/${id}`),
        api.get(`/piece-cost/${id}/current`)
      ]);
      
      setPieceCostConfig(configRes.data);
      setPieceCostCalculations(calculationsRes.data);
      setCurrentPieceCost(currentRes.data);
      
      // Set defaults from config
      setPieceCostInput(prev => ({
        ...prev,
        custo_hora: configRes.data.custo_hora_confeccao || 8.0,
        margem: configRes.data.margem_percentagem || 15.0,
        incluir_margem: configRes.data.incluir_margem ?? true
      }));
    } catch (error) {
      console.error('Failed to fetch piece cost data:', error);
    }
  };

  const calculatePieceCost = async () => {
    const payload = {
      modo_calculo: pieceCostMode,
      custo_input: pieceCostMode === 'custo_para_tempo' ? parseFloat(pieceCostInput.custo) || 0 : null,
      tempo_input: pieceCostMode === 'tempo_para_custo' ? parseFloat(pieceCostInput.tempo) || 0 : null,
      custo_hora: parseFloat(pieceCostInput.custo_hora) || 8.0,
      margem_percentagem: parseFloat(pieceCostInput.margem) || 0,
      incluir_margem: pieceCostInput.incluir_margem
    };
    
    try {
      const response = await api.post('/piece-cost/calculate', payload);
      setPieceCostResult(response.data);
      
      // Pre-fill final values with calculated results
      if (pieceCostMode === 'custo_para_tempo') {
        setPieceCostFinal({
          tempo: response.data.tempo_calculado?.toString() || '',
          custo: pieceCostInput.custo
        });
      } else {
        setPieceCostFinal({
          tempo: pieceCostInput.tempo,
          custo: response.data.custo_calculado?.toString() || ''
        });
      }
    } catch (error) {
      console.error('Failed to calculate:', error);
      toast.error('Erro ao calcular');
    }
  };

  const savePieceCost = async (confirm = false) => {
    if (!pieceCostFinal.tempo || !pieceCostFinal.custo) {
      toast.error('Preencha os valores finais');
      return;
    }
    
    setSavingPieceCost(true);
    try {
      const payload = {
        modo_calculo: pieceCostMode,
        custo_input: pieceCostMode === 'custo_para_tempo' ? parseFloat(pieceCostInput.custo) : null,
        tempo_input: pieceCostMode === 'tempo_para_custo' ? parseFloat(pieceCostInput.tempo) : null,
        tempo_calculado: pieceCostResult?.tempo_calculado,
        custo_calculado: pieceCostResult?.custo_calculado,
        tempo_final: parseFloat(pieceCostFinal.tempo),
        custo_final: parseFloat(pieceCostFinal.custo),
        custo_hora: parseFloat(pieceCostInput.custo_hora),
        margem_aplicada: pieceCostInput.incluir_margem ? parseFloat(pieceCostInput.margem) : 0,
        notas: '',
        confirmado: confirm
      };
      
      await api.post(`/piece-cost/${id}`, payload);
      toast.success(confirm ? 'Custo peça confirmado!' : 'Cálculo guardado');
      
      // Refresh data
      await fetchPieceCostData();
      
      // Reset form
      setPieceCostResult(null);
      setPieceCostFinal({ tempo: '', custo: '' });
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Erro ao guardar');
    } finally {
      setSavingPieceCost(false);
    }
  };

  const confirmPieceCost = async (calculationId, tempo, custo) => {
    try {
      await api.patch(`/piece-cost/${id}/${calculationId}/confirm`, {
        tempo_final: tempo,
        custo_final: custo
      });
      toast.success('Custo peça confirmado!');
      await fetchPieceCostData();
    } catch (error) {
      console.error('Failed to confirm:', error);
      toast.error('Erro ao confirmar');
    }
  };

  const deletePieceCostCalculation = async (calculationId) => {
    try {
      await api.delete(`/piece-cost/${id}/${calculationId}`);
      toast.success('Cálculo eliminado');
      await fetchPieceCostData();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Erro ao eliminar');
    }
  };

  // Helper functions
  const getStatusInfo = (status) => {
    const statusMap = {
      'nao_iniciado': { color: 'bg-slate-100 text-slate-500', icon: Circle, label: 'Não iniciado' },
      'dentro_prazo': { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Dentro do prazo' },
      'risco': { color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle, label: 'Em risco' },
      'atrasado': { color: 'bg-red-100 text-red-700', icon: Clock, label: 'Atrasado' },
      'concluido': { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Concluído' }
    };
    return statusMap[status] || statusMap['nao_iniciado'];
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

  // Gantt chart data
  const ganttData = useMemo(() => {
    if (!planning.length) return null;
    
    const dates = planning
      .filter(p => p.data_inicio_prevista && p.data_fim_prevista)
      .flatMap(p => [new Date(p.data_inicio_prevista), new Date(p.data_fim_prevista)]);
    
    if (!dates.length) return null;
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      minDate,
      maxDate,
      totalDays,
      stages: planning.map(stage => {
        if (!stage.data_inicio_prevista || !stage.data_fim_prevista) {
          return { ...stage, left: 0, width: 0 };
        }
        const start = new Date(stage.data_inicio_prevista);
        const end = new Date(stage.data_fim_prevista);
        const left = Math.ceil((start - minDate) / (1000 * 60 * 60 * 24));
        const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        return {
          ...stage,
          left: (left / totalDays) * 100,
          width: (duration / totalDays) * 100
        };
      })
    };
  }, [planning]);

  // Group checkpoints by stage
  const checkpointsByStage = useMemo(() => {
    const grouped = {};
    checkpoints.forEach(cp => {
      if (!grouped[cp.etapa_id]) {
        grouped[cp.etapa_id] = [];
      }
      grouped[cp.etapa_id].push(cp);
    });
    return grouped;
  }, [checkpoints]);

  if (loading) {
    return (
      <MainLayout title="Projeto">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout title="Projeto">
        <div className="text-center text-slate-400">Projeto não encontrado</div>
      </MainLayout>
    );
  }

  const tabs = [
    { id: 'geral', label: 'Dados Gerais', icon: Package },
    { id: 'planeamento', label: 'Planeamento', icon: Calendar },
    { id: 'custo-peca', label: 'Custo Peça', icon: Euro },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'checkpoints', label: 'Checkpoints', icon: CheckSquare },
    { id: 'anexos', label: 'Anexos', icon: Paperclip },
    { id: 'historico', label: 'Histórico', icon: HistoryIcon }
  ];

  const actions = (
    <button
      onClick={() => navigate(`/projects/${id}/edit`)}
      data-testid="edit-project-detail-button"
      className="flex items-center space-x-2 bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
    >
      <Edit className="w-4 h-4" />
      <span>Editar</span>
    </button>
  );

  return (
    <MainLayout title={`Projeto ${project.of_numero}`} actions={actions}>
      <div data-testid="project-detail-page" className="space-y-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Voltar para Projetos</span>
        </button>

        {/* Header Info */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{project.modelo}</h2>
              <p className="text-sm text-slate-500 mt-1">OF: {project.of_numero}</p>
            </div>
            <div className="flex items-center space-x-4">
              {timelineData?.summary?.is_paused && (
                <div className="flex items-center text-yellow-600 text-sm bg-yellow-50 px-3 py-1 rounded-full">
                  <Pause className="w-4 h-4 mr-1" />
                  Pausado
                </div>
              )}
              {timelineData?.summary?.active_problems > 0 && (
                <div className="flex items-center text-red-600 text-sm bg-red-50 px-3 py-1 rounded-full">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {timelineData.summary.active_problems} Problema(s)
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-slate-500">Status</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border mt-1 ${getStatusColor(project.status_projeto)}`}>
                  {getStatusLabel(project.status_projeto)}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Progresso</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{project.progresso_percentagem}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="border-b border-slate-200">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`tab-${tab.id}`}
                    className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {/* Tab: Dados Gerais */}
            {activeTab === 'geral' && (
              <div data-testid="tab-content-geral" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">OF Número</label>
                    <p className="text-sm text-slate-900 mt-1 font-mono">{project.of_numero}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo de Ordem</label>
                    <p className="text-sm text-slate-900 mt-1">
                      {orderTypes.find(t => t.id === project.tipo_ordem_id)?.nome || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</label>
                    <p className="text-sm text-slate-900 mt-1">
                      {brands.find(b => b.id === project.marca_id)?.nome || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Modelo</label>
                    <p className="text-sm text-slate-900 mt-1">{project.modelo}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quantidade</label>
                    <p className="text-sm text-slate-900 mt-1">{project.quantidade?.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</label>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border mt-1 ${getStatusColor(project.status_projeto)}`}>
                      {getStatusLabel(project.status_projeto)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-medium text-slate-700 mb-4">Responsáveis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Comercial Responsável</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {users.find(u => u.id === project.comercial_responsavel_id)?.nome || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Parceiro Confeção</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {partners.find(p => p.id === project.parceiro_confeccao_id)?.nome || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fornecedor Tecido</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {suppliers.find(s => s.id === project.fornecedor_tecido_id)?.nome || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-medium text-slate-700 mb-4">Datas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Data Encomenda</label>
                      <p className="text-sm text-slate-900 mt-1">{formatDate(project.data_encomenda)}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Data Entrada Confeção</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {project.data_entrada_confecao ? formatDate(project.data_entrada_confecao) : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Data Prevista Entrega</label>
                      <p className="text-sm text-slate-900 mt-1">{formatDate(project.data_prevista_entrega)}</p>
                    </div>
                    {project.data_real_entrega && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Data Real Entrega</label>
                        <p className="text-sm text-slate-900 mt-1">{formatDate(project.data_real_entrega)}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-medium text-slate-700 mb-4">Tecido</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Referência Tecido</label>
                      <p className="text-sm text-slate-900 mt-1">{project.referencia_tecido || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Opções de Produção</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {project.producao_confirmada && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">Confirmada</span>
                        )}
                        {project.producao_loteada && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Loteada</span>
                        )}
                        {project.obriga_prototipo && (
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">Protótipo</span>
                        )}
                        {!project.producao_confirmada && !project.producao_loteada && !project.obriga_prototipo && (
                          <span className="text-xs text-slate-400">Nenhuma</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {project.descricao && (
                  <div className="border-t border-slate-200 pt-6">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Descrição</label>
                    <p className="text-sm text-slate-900 mt-1">{project.descricao}</p>
                  </div>
                )}
                {project.observacoes && (
                  <div className="border-t border-slate-200 pt-6">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Observações</label>
                    <p className="text-sm text-slate-900 mt-1">{project.observacoes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Planeamento */}
            {activeTab === 'planeamento' && (
              <div data-testid="tab-content-planeamento" className="space-y-6">
                {/* Key dates and calculation */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Data Entrada Confeção</label>
                    <input
                      type="date"
                      data-testid="data-entrada-confeccao"
                      value={dataEntradaConfeccao}
                      onChange={(e) => setDataEntradaConfeccao(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Data Entrega Final</label>
                    <input
                      type="date"
                      data-testid="data-entrega"
                      value={dataEntrega}
                      onChange={(e) => setDataEntrega(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div className="flex items-end space-x-2 col-span-3">
                    <button
                      data-testid="calculate-btn"
                      onClick={calculateDates}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Calcular
                    </button>
                    <button
                      data-testid="save-planning-btn"
                      onClick={savePlanning}
                      disabled={savingPlanning}
                      className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingPlanning ? 'A guardar...' : 'Guardar'}
                    </button>
                  </div>
                </div>

                {/* Days per stage */}
                <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 self-center">Dias por etapa:</span>
                  {planning.map(stage => (
                    <div key={stage.key} className="flex items-center space-x-1">
                      <span className="text-xs text-slate-500">{stage.nome}:</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={diasPorEtapa[stage.key] ?? stage.dias_previstos ?? 0}
                        onChange={(e) => setDiasPorEtapa(prev => ({ ...prev, [stage.key]: parseInt(e.target.value) || 0 }))}
                        className="w-12 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                  ))}
                </div>

                {/* Planning table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <th className="h-10 px-4 text-left w-40">Etapa</th>
                        <th className="h-10 px-4 text-left">Início Previsto</th>
                        <th className="h-10 px-4 text-left">Fim Previsto</th>
                        <th className="h-10 px-4 text-left">Início Real</th>
                        <th className="h-10 px-4 text-left">Fim Real</th>
                        <th className="h-10 px-4 text-left w-32">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planning.map((stage) => {
                        const status = getStatusInfo(stage.status_calculado);
                        const StatusIcon = status.icon;
                        return (
                          <tr key={stage.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.cor }} />
                                <span className="font-medium text-slate-900">{stage.nome}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="date"
                                value={stage.data_inicio_prevista?.split('T')[0] || ''}
                                onChange={(e) => updateStageDate(stage.key, 'data_inicio_prevista', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="date"
                                value={stage.data_fim_prevista?.split('T')[0] || ''}
                                onChange={(e) => updateStageDate(stage.key, 'data_fim_prevista', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="date"
                                value={stage.data_inicio_real?.split('T')[0] || ''}
                                onChange={(e) => updateStageDate(stage.key, 'data_inicio_real', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="date"
                                value={stage.data_fim_real?.split('T')[0] || ''}
                                onChange={(e) => updateStageDate(stage.key, 'data_fim_real', e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                <span>{status.label}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Gantt Chart - Enhanced Timeline */}
                {ganttData && ganttData.totalDays > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-slate-900">Timeline / Gantt</h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-500">
                        <span className="px-2 py-1 bg-slate-100 rounded">{formatDate(ganttData.minDate)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="px-2 py-1 bg-slate-100 rounded">{formatDate(ganttData.maxDate)}</span>
                        <span className="font-medium text-slate-700">({ganttData.totalDays} dias)</span>
                      </div>
                    </div>
                    
                    {/* Today indicator line */}
                    {(() => {
                      const today = new Date();
                      const todayPosition = ((today - ganttData.minDate) / (ganttData.maxDate - ganttData.minDate)) * 100;
                      const showTodayLine = todayPosition >= 0 && todayPosition <= 100;
                      
                      return (
                        <div className="relative">
                          {/* Timeline header with dates */}
                          <div className="flex items-center mb-3">
                            <div className="w-32 flex-shrink-0" />
                            <div className="flex-1 relative h-6">
                              <div className="absolute inset-0 flex justify-between text-[10px] text-slate-400">
                                <span>{formatDate(ganttData.minDate)}</span>
                                <span>{formatDate(new Date((ganttData.minDate.getTime() + ganttData.maxDate.getTime()) / 2))}</span>
                                <span>{formatDate(ganttData.maxDate)}</span>
                              </div>
                            </div>
                            <div className="w-48 flex-shrink-0" />
                          </div>
                          
                          {/* Stages */}
                          <div className="space-y-1">
                            {ganttData.stages.map((stage, idx) => {
                              const stageStart = stage.data_inicio_prevista ? new Date(stage.data_inicio_prevista) : null;
                              const stageEnd = stage.data_fim_prevista ? new Date(stage.data_fim_prevista) : null;
                              const duration = stageStart && stageEnd ? Math.ceil((stageEnd - stageStart) / (1000 * 60 * 60 * 24)) + 1 : 0;
                              const isCurrentStage = project?.etapa_atual_id === stage.etapa_id;
                              const isPastDue = stageEnd && new Date() > stageEnd && !stage.concluido;
                              
                              return (
                                <div key={stage.key} className={`flex items-center py-1 rounded ${isCurrentStage ? 'bg-blue-50' : ''}`}>
                                  {/* Stage name */}
                                  <div className="w-32 flex-shrink-0 pr-2">
                                    <div className="flex items-center space-x-1">
                                      {isCurrentStage && <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />}
                                      <span className={`text-xs font-medium truncate ${isCurrentStage ? 'text-blue-700' : 'text-slate-700'}`}>
                                        {stage.nome}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Gantt bar area */}
                                  <div className="flex-1 h-8 bg-slate-50 rounded relative border border-slate-100">
                                    {/* Today line */}
                                    {showTodayLine && (
                                      <div 
                                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                                        style={{ left: `${todayPosition}%` }}
                                      >
                                        {idx === 0 && (
                                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1 py-0.5 bg-red-500 text-white text-[9px] rounded whitespace-nowrap">
                                            Hoje
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Stage bar */}
                                    {stage.width > 0 && (
                                      <div
                                        className={`absolute h-full rounded flex items-center px-2 text-white text-[10px] font-medium shadow-sm transition-all hover:shadow-md cursor-pointer group ${
                                          isPastDue ? 'opacity-70' : ''
                                        }`}
                                        style={{
                                          left: `${stage.left}%`,
                                          width: `${Math.max(stage.width, 5)}%`,
                                          backgroundColor: stage.cor || '#6366f1',
                                          minWidth: '50px'
                                        }}
                                        title={`${stage.nome}: ${stageStart ? formatDate(stageStart) : '?'} - ${stageEnd ? formatDate(stageEnd) : '?'}`}
                                      >
                                        <span className="truncate">
                                          {duration}d
                                        </span>
                                        {isPastDue && (
                                          <AlertTriangle className="w-3 h-3 ml-1 flex-shrink-0" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Date details */}
                                  <div className="w-48 flex-shrink-0 pl-3 flex items-center space-x-2">
                                    <div className="flex items-center space-x-1 text-[10px]">
                                      <span className={`px-1.5 py-0.5 rounded ${stageStart ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                        {stageStart ? formatDate(stageStart) : '—'}
                                      </span>
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                                      <span className={`px-1.5 py-0.5 rounded ${stageEnd ? (isPastDue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700') : 'bg-slate-100 text-slate-400'}`}>
                                        {stageEnd ? formatDate(stageEnd) : '—'}
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-medium ${duration > 0 ? 'text-slate-600' : 'text-slate-300'}`}>
                                      ({duration || 0}d)
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Legend */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center space-x-4 text-[10px] text-slate-500">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-0.5 bg-red-500" />
                              <span>Hoje</span>
                            </div>
                            {ganttData.stages.slice(0, 5).map(stage => (
                              <div key={stage.key} className="flex items-center space-x-1">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: stage.cor || '#6366f1' }} />
                                <span>{stage.nome}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Custo Peça */}
            {activeTab === 'custo-peca' && (
              <div data-testid="tab-content-custo-peca" className="space-y-6">
                {/* Current confirmed cost display */}
                {currentPieceCost && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-800">Custo Peça Confirmado</p>
                          <p className="text-xs text-emerald-600">
                            Confirmado em {formatDateTime(currentPieceCost.confirmado_em)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="text-xs text-emerald-600">Tempo/Peça</p>
                          <p className="text-lg font-bold text-emerald-800">{currentPieceCost.tempo_final} min</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-emerald-600">Custo/Peça</p>
                          <p className="text-lg font-bold text-emerald-800">€{currentPieceCost.custo_final?.toFixed(4)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculator Section */}
                <div className="bg-white border border-slate-200 rounded-lg">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calculator className="w-5 h-5 text-slate-500" />
                      <h4 className="font-medium text-slate-900">Calculadora de Custo/Tempo</h4>
                    </div>
                    <button
                      onClick={() => setShowPieceCostConfig(!showPieceCostConfig)}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Config Panel */}
                  {showPieceCostConfig && (
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Custo Hora Confeção (€)
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min={pieceCostConfig.custo_hora_minimo}
                            max={pieceCostConfig.custo_hora_maximo}
                            value={pieceCostInput.custo_hora}
                            onChange={(e) => setPieceCostInput(prev => ({ ...prev, custo_hora: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            Min: €{pieceCostConfig.custo_hora_minimo} | Max: €{pieceCostConfig.custo_hora_maximo}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Margem (%)
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={pieceCostInput.margem}
                            onChange={(e) => setPieceCostInput(prev => ({ ...prev, margem: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pieceCostInput.incluir_margem}
                              onChange={(e) => setPieceCostInput(prev => ({ ...prev, incluir_margem: e.target.checked }))}
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            />
                            <span className="text-sm text-slate-700">Incluir margem no cálculo</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    {/* Mode Selector */}
                    <div className="flex items-center justify-center space-x-2 mb-6">
                      <button
                        onClick={() => {
                          setPieceCostMode('tempo_para_custo');
                          setPieceCostResult(null);
                        }}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                          pieceCostMode === 'tempo_para_custo'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Timer className="w-4 h-4" />
                        <span>Tempo → Custo</span>
                      </button>
                      <ArrowRightLeft className="w-5 h-5 text-slate-400" />
                      <button
                        onClick={() => {
                          setPieceCostMode('custo_para_tempo');
                          setPieceCostResult(null);
                        }}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                          pieceCostMode === 'custo_para_tempo'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Euro className="w-4 h-4" />
                        <span>Custo → Tempo</span>
                      </button>
                    </div>

                    {/* Calculator Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Input Section */}
                      <div className="space-y-4">
                        <h5 className="text-sm font-medium text-slate-700 flex items-center">
                          <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold mr-2">1</span>
                          Inserir Valor
                        </h5>
                        
                        {pieceCostMode === 'tempo_para_custo' ? (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Tempo por Peça (minutos)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                data-testid="piece-time-input"
                                value={pieceCostInput.tempo}
                                onChange={(e) => setPieceCostInput(prev => ({ ...prev, tempo: e.target.value }))}
                                placeholder="Ex: 5.5"
                                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">min</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Custo por Peça (€)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                data-testid="piece-cost-input"
                                value={pieceCostInput.custo}
                                onChange={(e) => setPieceCostInput(prev => ({ ...prev, custo: e.target.value }))}
                                placeholder="Ex: 0.75"
                                className="w-full px-4 py-3 pr-8 border border-slate-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={calculatePieceCost}
                          data-testid="calculate-piece-cost-btn"
                          className="w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Calculator className="w-4 h-4 mr-2" />
                          Calcular
                        </button>
                      </div>

                      {/* Result Section */}
                      <div className="space-y-4">
                        <h5 className="text-sm font-medium text-slate-700 flex items-center">
                          <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mr-2">2</span>
                          Resultado Calculado
                        </h5>

                        {pieceCostResult ? (
                          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                            {pieceCostMode === 'tempo_para_custo' ? (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-slate-600">Custo base:</span>
                                  <span className="font-mono text-slate-900">€{pieceCostResult.custo_sem_margem?.toFixed(4)}</span>
                                </div>
                                {pieceCostInput.incluir_margem && pieceCostResult.margem_valor > 0 && (
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">+ Margem ({pieceCostInput.margem}%):</span>
                                    <span className="text-green-600">€{pieceCostResult.margem_valor?.toFixed(4)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                  <span className="font-medium text-slate-900">Custo Total:</span>
                                  <span className="text-xl font-bold text-blue-600">€{pieceCostResult.custo_calculado?.toFixed(4)}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-slate-600">Tempo calculado:</span>
                                  <span className="text-xl font-bold text-blue-600">{pieceCostResult.tempo_calculado} min</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-600">Custo hora usado:</span>
                                  <span className="font-mono text-slate-700">€{pieceCostInput.custo_hora}/h</span>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="bg-slate-50 rounded-lg p-6 text-center text-slate-400">
                            <Calculator className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Insira um valor e clique em Calcular</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Final Values - Operator Decision */}
                    {pieceCostResult && (
                      <div className="mt-6 pt-6 border-t border-slate-200">
                        <h5 className="text-sm font-medium text-slate-700 flex items-center mb-4">
                          <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold mr-2">3</span>
                          Valores Finais (Decisão do Operador)
                        </h5>
                        
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                          <div className="flex items-start space-x-2">
                            <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-800">
                              Os valores abaixo são sugestões. Pode ajustá-los antes de guardar. 
                              O operador tem sempre a decisão final.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Tempo Final (minutos)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              data-testid="piece-time-final"
                              value={pieceCostFinal.tempo}
                              onChange={(e) => setPieceCostFinal(prev => ({ ...prev, tempo: e.target.value }))}
                              className="w-full px-4 py-3 border border-amber-300 rounded-lg text-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Custo Final (€)
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              data-testid="piece-cost-final"
                              value={pieceCostFinal.custo}
                              onChange={(e) => setPieceCostFinal(prev => ({ ...prev, custo: e.target.value }))}
                              className="w-full px-4 py-3 border border-amber-300 rounded-lg text-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end space-x-3 mt-4">
                          <button
                            onClick={() => savePieceCost(false)}
                            disabled={savingPieceCost}
                            className="inline-flex items-center px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Guardar Rascunho
                          </button>
                          <button
                            onClick={() => savePieceCost(true)}
                            disabled={savingPieceCost}
                            data-testid="confirm-piece-cost-btn"
                            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            {savingPieceCost ? 'A guardar...' : 'Confirmar Valores'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Calculation History */}
                {pieceCostCalculations.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <h4 className="font-medium text-slate-900">Histórico de Cálculos</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {pieceCostCalculations.map(calc => (
                        <div key={calc.id} className={`p-4 hover:bg-slate-50 ${calc.confirmado ? 'bg-emerald-50/50' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {calc.confirmado && (
                                <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                  <Check className="w-3 h-3 mr-1" />
                                  Confirmado
                                </span>
                              )}
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {calc.tempo_final} min = €{calc.custo_final?.toFixed(4)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {calc.modo_calculo === 'tempo_para_custo' ? 'Tempo → Custo' : 'Custo → Tempo'}
                                  {' • '}€{calc.custo_hora}/h
                                  {calc.margem_aplicada > 0 && ` • +${calc.margem_aplicada}% margem`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-400">{formatDateTime(calc.criado_em)}</span>
                              {!calc.confirmado && (
                                <>
                                  <button
                                    onClick={() => confirmPieceCost(calc.id, calc.tempo_final, calc.custo_final)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                    title="Confirmar"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deletePieceCostCalculation(calc.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Help Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Como usar esta calculadora:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        <li><strong>Tempo → Custo:</strong> Insira quanto tempo demora a fazer uma peça (minutos) para calcular o custo</li>
                        <li><strong>Custo → Tempo:</strong> Insira quanto quer cobrar por peça (€) para calcular o tempo necessário</li>
                        <li>Ajuste o <strong>Custo Hora</strong> e <strong>Margem</strong> nas configurações conforme o parceiro de confeção</li>
                        <li>Os valores confirmados são usados no simulador de produção</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Timeline */}
            {activeTab === 'timeline' && (
              <div data-testid="tab-content-timeline" className="space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    data-testid="quick-pause-btn"
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'pausa', tipo_problema: null, descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-3 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors flex items-center justify-center border border-yellow-200"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pausar
                  </button>
                  <button
                    data-testid="quick-resume-btn"
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'retoma', tipo_problema: null, descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-3 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center border border-green-200"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Retomar
                  </button>
                  <button
                    data-testid="quick-problem-btn"
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'problema', tipo_problema: 'outro', descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-3 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center border border-red-200"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Problema
                  </button>
                  <button
                    data-testid="quick-note-btn"
                    onClick={() => {
                      setNewEvent({ tipo_evento: 'nota', tipo_problema: null, descricao: '', impacto_dias: 0 });
                      setShowAddEvent(true);
                    }}
                    className="p-3 text-sm bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center border border-slate-200"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Nota
                  </button>
                </div>

                {/* Estatísticas da Timeline */}
                {completeTimeline?.estatisticas && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-700">{completeTimeline.estatisticas.total_eventos}</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">Total de Eventos</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <Pencil className="w-5 h-5 text-purple-600" />
                        <span className="text-2xl font-bold text-purple-700">{completeTimeline.estatisticas.total_alteracoes}</span>
                      </div>
                      <p className="text-xs text-purple-600 mt-1">Alterações</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                        <span className="text-2xl font-bold text-emerald-700">{completeTimeline.estatisticas.checkpoints_respondidos}</span>
                      </div>
                      <p className="text-xs text-emerald-600 mt-1">Checkpoints</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <User className="w-5 h-5 text-amber-600" />
                        <span className="text-2xl font-bold text-amber-700">{completeTimeline.estatisticas.autores_unicos}</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">Participantes</p>
                    </div>
                    {completeTimeline.estatisticas.problemas_ativos > 0 && (
                      <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <span className="text-2xl font-bold text-red-700">{completeTimeline.estatisticas.problemas_ativos}</span>
                        </div>
                        <p className="text-xs text-red-600 mt-1">Problemas Ativos</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Filtros e Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Filtrar por:</span>
                    {[
                      { value: 'all', label: 'Todos', icon: Activity },
                      { value: 'timeline', label: 'Eventos', icon: Flag },
                      { value: 'history', label: 'Alterações', icon: Pencil },
                      { value: 'checkpoint', label: 'Checkpoints', icon: CheckSquare }
                    ].map(filter => (
                      <button
                        key={filter.value}
                        onClick={() => {
                          setTimelineFilter(filter.value);
                          fetchCompleteTimeline(filter.value);
                        }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          timelineFilter === filter.value
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <filter.icon className="w-3.5 h-3.5 mr-1.5" />
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchCompleteTimeline(timelineFilter)}
                      disabled={timelineLoading}
                      className="inline-flex items-center px-3 py-1.5 text-slate-600 hover:bg-white rounded-lg text-sm border border-slate-200"
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${timelineLoading ? 'animate-spin' : ''}`} />
                      Atualizar
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

                {/* Active Problems Alert */}
                {completeTimeline?.estatisticas?.problemas_ativos > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="font-medium text-red-800 mb-3 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Problemas Ativos ({completeTimeline.estatisticas.problemas_ativos})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {completeTimeline.eventos
                        .filter(e => e.tipo === 'problema' && !e.resolvido)
                        .map(problem => (
                          <div key={problem.id} className="flex items-start justify-between p-3 bg-white rounded-lg border border-red-100">
                            <div className="flex-1">
                              <p className="text-sm text-slate-900">{problem.descricao || 'Sem descrição'}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {problem.subtipo_label || problem.subtipo}
                                {problem.impacto_dias > 0 && ` • Impacto: +${problem.impacto_dias} dias`}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">por {problem.autor_nome}</p>
                            </div>
                            <button
                              onClick={() => resolveProblema(problem.id)}
                              className="ml-2 p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Marcar como resolvido"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Timeline Completa Agrupada por Data */}
                <div className="space-y-4">
                  {timelineLoading ? (
                    <div className="text-center text-slate-400 py-12 bg-slate-50 rounded-xl">
                      <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                      A carregar timeline...
                    </div>
                  ) : !completeTimeline?.eventos?.length ? (
                    <div className="text-center text-slate-400 py-12 bg-slate-50 rounded-xl">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Nenhum evento registado
                    </div>
                  ) : (
                    Object.entries(completeTimeline.eventos_por_data || {}).map(([date, events]) => {
                      const isExpanded = expandedDates[date] !== false;
                      const isToday = date === new Date().toISOString().split('T')[0];
                      const isYesterday = date === new Date(Date.now() - 86400000).toISOString().split('T')[0];
                      
                      // Formatar data de forma amigável
                      const formatDateLabel = (dateStr) => {
                        if (dateStr === 'Sem data') return dateStr;
                        if (isToday) return 'Hoje';
                        if (isYesterday) return 'Ontem';
                        const d = new Date(dateStr);
                        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
                        return d.toLocaleDateString('pt-PT', options);
                      };
                      
                      return (
                        <div key={date} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          {/* Date Header */}
                          <button
                            onClick={() => setExpandedDates(prev => ({ ...prev, [date]: !isExpanded }))}
                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ${
                              isToday ? 'bg-blue-50 border-b border-blue-100' : 
                              isYesterday ? 'bg-slate-50 border-b border-slate-100' : 'border-b border-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              <Calendar className={`w-4 h-4 ${isToday ? 'text-blue-600' : 'text-slate-400'}`} />
                              <span className={`font-medium capitalize ${isToday ? 'text-blue-700' : 'text-slate-800'}`}>
                                {formatDateLabel(date)}
                              </span>
                              {isToday && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  Hoje
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                              {events.length} {events.length === 1 ? 'evento' : 'eventos'}
                            </span>
                          </button>
                          
                          {/* Events */}
                          {isExpanded && (
                            <div className="divide-y divide-slate-100">
                              {events.map((event, idx) => {
                                // Ícones por tipo
                                const getIcon = () => {
                                  const iconMap = {
                                    'inicio': Play,
                                    'pausa': Pause,
                                    'retoma': Play,
                                    'problema': AlertTriangle,
                                    'problema_resolvido': CheckCircle2,
                                    'mudanca_etapa': ArrowRight,
                                    'conclusao': Flag,
                                    'nota': MessageSquare,
                                    'alteracao': Pencil,
                                    'checkpoint': CheckSquare,
                                    'criacao': PlusCircle
                                  };
                                  return iconMap[event.tipo] || Activity;
                                };
                                const EventIcon = getIcon();
                                
                                return (
                                  <div 
                                    key={event.id} 
                                    className={`px-4 py-4 hover:bg-slate-50/50 transition-colors ${
                                      event.importancia === 'alta' ? 'bg-amber-50/30' : ''
                                    }`}
                                  >
                                    <div className="flex items-start gap-4">
                                      {/* Icon */}
                                      <div 
                                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                                        style={{ backgroundColor: event.tipo_cor || '#64748B' }}
                                      >
                                        <EventIcon className="w-5 h-5 text-white" />
                                      </div>
                                      
                                      {/* Content */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span 
                                                className="font-semibold text-sm"
                                                style={{ color: event.tipo_cor || '#334155' }}
                                              >
                                                {event.tipo_label}
                                              </span>
                                              {event.subtipo_label && (
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                  {event.subtipo_label}
                                                </span>
                                              )}
                                              {event.etapa_nome && (
                                                <span 
                                                  className="text-xs px-2 py-0.5 rounded-full text-white"
                                                  style={{ backgroundColor: event.etapa_cor || '#6366F1' }}
                                                >
                                                  {event.etapa_nome}
                                                </span>
                                              )}
                                              {event.source === 'checkpoint' && (
                                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                                  Checkpoint
                                                </span>
                                              )}
                                              {event.importancia === 'alta' && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                                  Importante
                                                </span>
                                              )}
                                            </div>
                                            
                                            {/* Description */}
                                            {event.descricao && (
                                              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                                                {event.descricao}
                                              </p>
                                            )}
                                            
                                            {/* Checkpoint value */}
                                            {event.source === 'checkpoint' && event.valor && (
                                              <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xs text-slate-500">{event.checkpoint_nome}:</span>
                                                <span className="text-sm font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                                  {event.valor}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {/* History change details */}
                                            {event.source === 'history' && event.valor_anterior && event.valor_novo && (
                                              <div className="mt-2 flex items-center gap-2 text-sm">
                                                <span className="text-slate-400 line-through">{event.valor_anterior}</span>
                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                <span className="text-slate-700 font-medium">{event.valor_novo}</span>
                                              </div>
                                            )}
                                            
                                            {/* Impact days */}
                                            {event.impacto_dias > 0 && (
                                              <p className="text-xs text-red-600 mt-2 flex items-center">
                                                <Clock className="w-3 h-3 mr-1" />
                                                Impacto: +{event.impacto_dias} dias
                                              </p>
                                            )}
                                          </div>
                                          
                                          {/* Timestamp */}
                                          <span className="text-xs text-slate-400 whitespace-nowrap">
                                            {event.data ? new Date(event.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''}
                                          </span>
                                        </div>
                                        
                                        {/* Author info */}
                                        <div className="mt-3 flex items-center gap-2">
                                          <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center">
                                            <User className="w-3.5 h-3.5 text-slate-500" />
                                          </div>
                                          <span className="text-xs text-slate-500">
                                            <span className="font-medium text-slate-700">{event.autor_nome}</span>
                                            {event.autor_email && (
                                              <span className="text-slate-400 ml-1">({event.autor_email})</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {/* Actions for problems */}
                                      {event.tipo === 'problema' && !event.resolvido && (
                                        <button
                                          onClick={() => resolveProblema(event.id)}
                                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0"
                                          title="Marcar como resolvido"
                                        >
                                          <CheckCircle2 className="w-5 h-5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab: Checkpoints */}
            {activeTab === 'checkpoints' && (
              <div data-testid="tab-content-checkpoints" className="space-y-6">
                {/* Mensagem informativa */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Como funcionam os Checkpoints?</p>
                      <p className="text-blue-600">
                        Os checkpoints são configurados por <strong>Etapa</strong> em Configurações → Checkpoints. 
                        Aparecem aqui automaticamente quando o projeto passa por cada etapa.
                      </p>
                    </div>
                  </div>
                </div>

                {planning.length > 0 ? (
                  <>
                    {/* Mostrar todas as etapas */}
                    {planning.map(stage => {
                      const stageCheckpoints = checkpointsByStage[stage.etapa_id] || [];
                      const isCurrentStage = project?.etapa_atual_id === stage.etapa_id;
                      
                      return (
                        <div key={stage.key} className={`border rounded-lg overflow-hidden ${
                          isCurrentStage ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
                        }`}>
                          <div className={`px-4 py-3 border-b flex items-center justify-between ${
                            isCurrentStage ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: stage.cor }} />
                              <h4 className="font-medium text-slate-900">{stage.nome}</h4>
                              {isCurrentStage && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  Etapa Atual
                                </span>
                              )}
                              <span className="ml-2 text-xs text-slate-500">
                                ({stageCheckpoints.length} {stageCheckpoints.length === 1 ? 'checkpoint' : 'checkpoints'})
                              </span>
                            </div>
                          </div>
                          
                          <div className="p-4">
                            {stageCheckpoints.length > 0 ? (
                              <div className="space-y-4">
                                {stageCheckpoints.map(checkpoint => {
                                  const value = checkpointValues[checkpoint.id] || '';
                                  const response = checkpointResponses.find(r => r.checkpoint_id === checkpoint.id);
                                  
                                  return (
                                    <div key={checkpoint.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                                      <div className="flex-1">
                                        <div className="flex items-center">
                                          <span className="text-sm font-medium text-slate-900">{checkpoint.nome}</span>
                                          {checkpoint.obrigatorio && (
                                            <span className="ml-2 text-xs text-red-500">*</span>
                                          )}
                                          <span className="ml-2 text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded">
                                            {checkpoint.tipo_resposta}
                                          </span>
                                        </div>
                                        
                                        <div className="mt-2">
                                          {checkpoint.tipo_resposta === 'checkbox' ? (
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={value === 'true'}
                                                onChange={(e) => {
                                                  const newValue = e.target.checked ? 'true' : 'false';
                                                  setCheckpointValues(prev => ({ ...prev, [checkpoint.id]: newValue }));
                                                  saveCheckpointResponse(checkpoint.id, newValue);
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                              />
                                              <span className="text-sm text-slate-600">
                                                {value === 'true' ? 'Sim' : 'Não'}
                                              </span>
                                            </label>
                                          ) : checkpoint.tipo_resposta === 'data' ? (
                                            <input
                                              type="date"
                                              value={value?.split('T')[0] || ''}
                                              onChange={(e) => {
                                                setCheckpointValues(prev => ({ ...prev, [checkpoint.id]: e.target.value }));
                                              }}
                                              onBlur={(e) => saveCheckpointResponse(checkpoint.id, e.target.value)}
                                              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                                            />
                                          ) : checkpoint.tipo_resposta === 'numero' ? (
                                            <input
                                              type="number"
                                              value={value || ''}
                                              onChange={(e) => setCheckpointValues(prev => ({ ...prev, [checkpoint.id]: e.target.value }))}
                                              onBlur={(e) => saveCheckpointResponse(checkpoint.id, e.target.value)}
                                              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 w-32"
                                            />
                                          ) : checkpoint.tipo_resposta === 'texto_longo' ? (
                                            <textarea
                                              value={value || ''}
                                              onChange={(e) => setCheckpointValues(prev => ({ ...prev, [checkpoint.id]: e.target.value }))}
                                              onBlur={(e) => saveCheckpointResponse(checkpoint.id, e.target.value)}
                                              rows={2}
                                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                                            />
                                          ) : checkpoint.tipo_resposta === 'escolha_unica' && checkpoint.opcoes ? (
                                            <select
                                              value={value || ''}
                                              onChange={(e) => {
                                                setCheckpointValues(prev => ({ ...prev, [checkpoint.id]: e.target.value }));
                                                saveCheckpointResponse(checkpoint.id, e.target.value);
                                              }}
                                              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                                            >
                                              <option value="">Selecionar...</option>
                                              {checkpoint.opcoes.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                              ))}
                                            </select>
                                          ) : (
                                            <input
                                              type="text"
                                              value={value || ''}
                                              onChange={(e) => setCheckpointValues(prev => ({ ...prev, [checkpoint.id]: e.target.value }))}
                                              onBlur={(e) => saveCheckpointResponse(checkpoint.id, e.target.value)}
                                              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
                                            />
                                          )}
                                        </div>
                                        
                                        {response && (
                                          <p className="text-xs text-slate-400 mt-2">
                                            Respondido em {formatDateTime(response.data_resposta)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-slate-400">
                                <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Sem checkpoints configurados para esta etapa</p>
                                <button
                                  onClick={() => navigate('/checkpoints')}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Configurar Checkpoints →
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500 mb-2">Sem etapas de planeamento configuradas</p>
                    <p className="text-sm text-slate-400 mb-4">
                      Configure primeiro as etapas do projeto e depois adicione checkpoints
                    </p>
                    <button
                      onClick={() => navigate('/checkpoints')}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm"
                    >
                      Configurar Checkpoints
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Anexos */}
            {activeTab === 'anexos' && (
              <div data-testid="tab-content-anexos" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-slate-900">Ficheiros Anexos</h4>
                  <label className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingFile ? 'A carregar...' : 'Carregar Ficheiro'}
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </label>
                </div>
                
                {attachments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {attachments.map(attachment => (
                      <div key={attachment.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-8 h-8 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{attachment.nome}</p>
                            <p className="text-xs text-slate-500">
                              {attachment.tamanho ? `${(attachment.tamanho / 1024).toFixed(1)} KB` : ''} • {formatDateTime(attachment.criado_em)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {attachment.url && (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => deleteAttachment(attachment.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-12 bg-slate-50 rounded-lg">
                    <Paperclip className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum ficheiro anexado</p>
                    <p className="text-xs mt-1">Clique em "Carregar Ficheiro" para adicionar</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Histórico */}
            {activeTab === 'historico' && (
              <div data-testid="tab-content-historico">
                {history.length > 0 ? (
                  <div className="space-y-2">
                    {history.map((entry, idx) => (
                      <div key={idx} className="border-l-2 border-slate-200 pl-4 py-2 hover:bg-slate-50 rounded-r-lg">
                        <p className="text-xs text-slate-500">{formatDateTime(entry.data)}</p>
                        <p className="text-sm text-slate-700 mt-1">
                          <span className="font-medium">{entry.campo}</span> alterado
                        </p>
                        <div className="text-xs text-slate-500 mt-1 font-mono">
                          <span className="text-red-500 line-through">{entry.valor_anterior || '-'}</span>
                          {' → '}
                          <span className="text-green-600">{entry.valor_novo}</span>
                        </div>
                        {entry.alterado_por && (
                          <p className="text-xs text-slate-400 mt-1">por {entry.alterado_por}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">Sem histórico de alterações</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de Evento *</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de Problema</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Impacto Estimado (dias)</label>
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
    </MainLayout>
  );
};

export default ProjectDetail;
