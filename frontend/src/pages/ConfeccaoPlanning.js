import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import GanttChart from '@/components/GanttChart';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  BarChart3, Users, Calendar, Play, Calculator,
  ChevronDown, ChevronUp, Check, AlertTriangle, Clock,
  Plus, X, Bell, BellRing, GripVertical,
  Move, Bookmark, CheckCircle2, XCircle, RefreshCw,
  Star, MessageSquare, Send, FileCheck, Search
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/helpers';

const ConfeccaoPlanning = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [periodo, setPeriodo] = useState('30d');
  
  // Simulator state
  const [projects, setProjects] = useState([]);
  const [simulatorData, setSimulatorData] = useState(null);
  const [simulatorForm, setSimulatorForm] = useState({
    projeto_id: '',
    quantidade: 200,
    tempo_peca: 1.1,
    eficiencia: 0.9,
    data_inicio: ''
  });
  const [simulating, setSimulating] = useState(false);
  const [sortBy, setSortBy] = useState('mais_disponivel');
  const [markedForNegotiation, setMarkedForNegotiation] = useState({});
  const [expandedConfeccao, setExpandedConfeccao] = useState(null);
  const [confeccaoSearch, setConfeccaoSearch] = useState('');
  
  // Calendar state
  const [calendarData, setCalendarData] = useState(null);
  const [viewMode, setViewMode] = useState('gantt');
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  
  // Reservas state
  const [reservas, setReservas] = useState([]);
  const [showReservaModal, setShowReservaModal] = useState(false);
  const [reservaForm, setReservaForm] = useState({
    confeccao_id: '',
    projeto_id: '',
    descricao: '',
    quantidade_pecas: 500,
    tempo_peca: 1.2,
    data_inicio: '',
    data_fim: '',
    prioridade: 'media'
  });
  const [confeccoes, setConfeccoes] = useState([]);
  
  // Negociacoes state
  const [negociacoes, setNegociacoes] = useState([]);
  const [negociacoesStats, setNegociacoesStats] = useState(null);
  const [negociacaoFilter, setNegociacaoFilter] = useState('');
  const [showNegociacaoModal, setShowNegociacaoModal] = useState(false);
  const [editingNegociacao, setEditingNegociacao] = useState(null);
  const [negociacaoForm, setNegociacaoForm] = useState({
    confeccao_id: '',
    projeto_id: '',
    quantidade_pecas: 500,
    tempo_peca_estimado: 1.2,
    data_inicio_pretendida: '',
    data_fim_pretendida: '',
    notas: '',
    prioridade: 'media'
  });
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchData();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [activeTab, periodo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const confRes = await api.get('/partners/');
      setConfeccoes(confRes.data.filter(p => p.tipo_servico === 'confeccao' && p.ativo));
      
      if (activeTab === 'dashboard') {
        const response = await api.get(`/capacity/confeccao-planning/dashboard?periodo=${periodo}`);
        setDashboardData(response.data);
      } else if (activeTab === 'simulator') {
        const projectsRes = await api.get('/projects/');
        setProjects(projectsRes.data.filter(p => p.status_projeto !== 'concluido'));
      } else if (activeTab === 'calendar') {
        const [calResponse, reservasRes] = await Promise.all([
          api.get('/capacity/confeccao-planning/calendar'),
          api.get('/reservas/reservas')
        ]);
        setCalendarData(calResponse.data);
        setReservas(reservasRes.data);
      } else if (activeTab === 'reservas') {
        const reservasRes = await api.get('/reservas/reservas');
        setReservas(reservasRes.data);
      } else if (activeTab === 'negociacoes') {
        const [negRes, statsRes] = await Promise.all([
          api.get('/reservas/negociacoes'),
          api.get('/reservas/negociacoes/stats')
        ]);
        setNegociacoes(negRes.data);
        setNegociacoesStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get('/reservas/notifications?limit=20'),
        api.get('/reservas/notifications/unread-count')
      ]);
      setNotifications(notifRes.data);
      setUnreadCount(countRes.data.unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const runSimulation = async () => {
    if (!simulatorForm.quantidade) {
      toast.error('Defina a quantidade de pecas');
      return;
    }
    
    setSimulating(true);
    try {
      const params = new URLSearchParams({
        quantidade: simulatorForm.quantidade.toString(),
        tempo_peca: simulatorForm.tempo_peca.toString(),
        eficiencia: simulatorForm.eficiencia.toString()
      });
      
      if (simulatorForm.projeto_id) {
        params.append('projeto_id', simulatorForm.projeto_id);
      }
      if (simulatorForm.data_inicio) {
        params.append('data_inicio', simulatorForm.data_inicio);
      }
      
      const response = await api.post(`/capacity/confeccao-planning/simulate?${params}`);
      setSimulatorData(response.data);
      toast.success('Simulacao concluida');
    } catch (error) {
      console.error('Failed to simulate:', error);
      toast.error('Erro na simulacao');
    } finally {
      setSimulating(false);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e, item, type) => {
    setDragging({ item, type });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, confeccaoId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(confeccaoId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e, targetConfeccaoId) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!dragging) return;
    
    const { item, type } = dragging;
    
    if (type === 'reserva' && item.confeccao_id !== targetConfeccaoId) {
      try {
        await api.post(`/reservas/reservas/move?reserva_id=${item.id}&nova_confeccao_id=${targetConfeccaoId}`);
        toast.success(`Reserva movida para ${confeccoes.find(c => c.id === targetConfeccaoId)?.nome}`);
        fetchData();
        fetchNotifications();
      } catch (error) {
        toast.error('Erro ao mover reserva');
      }
    } else if (type === 'trabalho') {
      try {
        await api.put(`/projects/${item.id}`, { parceiro_confeccao_id: targetConfeccaoId });
        toast.success(`Trabalho movido para ${confeccoes.find(c => c.id === targetConfeccaoId)?.nome}`);
        fetchData();
        fetchNotifications();
      } catch (error) {
        toast.error('Erro ao mover trabalho');
      }
    }
    
    setDragging(null);
  };

  const handleGanttMoveItem = async (item, type, targetConfeccaoId) => {
    if (type === 'reserva') {
      try {
        await api.post(`/reservas/reservas/move?reserva_id=${item.id}&nova_confeccao_id=${targetConfeccaoId}`);
        toast.success(`Reserva movida`);
        fetchData();
      } catch (error) {
        toast.error('Erro ao mover reserva');
      }
    } else if (type === 'trabalho') {
      try {
        await api.put(`/projects/${item.id}`, { parceiro_confeccao_id: targetConfeccaoId });
        toast.success(`Trabalho movido`);
        fetchData();
      } catch (error) {
        toast.error('Erro ao mover trabalho');
      }
    }
  };

  const handleGanttResizeItem = async (item, type, newStartDate, newEndDate) => {
    const startStr = newStartDate.toISOString();
    const endStr = newEndDate.toISOString();
    
    if (type === 'reserva') {
      try {
        await api.post(`/reservas/reservas/${item.id}/resize?data_inicio=${encodeURIComponent(startStr)}&data_fim=${encodeURIComponent(endStr)}`);
        toast.success('Reserva redimensionada');
        fetchData();
      } catch (error) {
        toast.error('Erro ao redimensionar reserva');
      }
    } else if (type === 'trabalho') {
      try {
        await api.post(`/reservas/trabalhos/${item.id}/resize?data_inicio=${encodeURIComponent(startStr)}&data_fim=${encodeURIComponent(endStr)}`);
        toast.success('Trabalho redimensionado');
        fetchData();
      } catch (error) {
        toast.error('Erro ao redimensionar trabalho');
      }
    }
  };

  const handleGanttItemClick = (item, type) => {
    console.log('Clicked:', type, item);
  };

  // Handle date update from Gantt edit modal
  const handleGanttUpdateDates = async (item, type, dataInicio, dataFim) => {
    const startStr = new Date(dataInicio).toISOString();
    const endStr = new Date(dataFim).toISOString();
    
    if (type === 'reserva') {
      try {
        await api.post(`/reservas/reservas/${item.id}/resize?data_inicio=${encodeURIComponent(startStr)}&data_fim=${encodeURIComponent(endStr)}`);
        toast.success('Datas da reserva atualizadas');
        fetchData();
      } catch (error) {
        toast.error('Erro ao atualizar reserva');
      }
    } else if (type === 'trabalho') {
      try {
        await api.post(`/reservas/trabalhos/${item.id}/resize?data_inicio=${encodeURIComponent(startStr)}&data_fim=${encodeURIComponent(endStr)}`);
        toast.success('Datas do trabalho atualizadas');
        fetchData();
      } catch (error) {
        toast.error('Erro ao atualizar trabalho');
      }
    }
  };

  // Handle delete from Gantt edit modal
  const handleGanttDeleteItem = async (item, type) => {
    if (type === 'reserva') {
      try {
        await api.delete(`/reservas/reservas/${item.id}`);
        toast.success('Reserva eliminada');
        fetchData();
      } catch (error) {
        toast.error('Erro ao eliminar reserva');
      }
    }
  };

  // Reserva handlers
  const handleCreateReserva = async (e) => {
    e.preventDefault();
    try {
      await api.post('/reservas/reservas', reservaForm);
      toast.success('Reserva criada com sucesso');
      setShowReservaModal(false);
      setReservaForm({
        confeccao_id: '',
        projeto_id: '',
        descricao: '',
        quantidade_pecas: 500,
        tempo_peca: 1.2,
        data_inicio: '',
        data_fim: '',
        prioridade: 'media'
      });
      fetchData();
      fetchNotifications();
    } catch (error) {
      toast.error('Erro ao criar reserva');
    }
  };

  const handleConfirmReserva = async (reservaId) => {
    try {
      await api.post(`/reservas/reservas/${reservaId}/confirm`);
      toast.success('Reserva confirmada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao confirmar reserva');
    }
  };

  const handleDeleteReserva = async (reservaId) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta reserva?')) return;
    try {
      await api.delete(`/reservas/reservas/${reservaId}`);
      toast.success('Reserva eliminada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao eliminar reserva');
    }
  };

  // Negociacao handlers
  const handleCreateNegociacao = async (e) => {
    e.preventDefault();
    try {
      await api.post('/reservas/negociacoes', negociacaoForm);
      toast.success('Negociacao criada');
      setShowNegociacaoModal(false);
      setNegociacaoForm({
        confeccao_id: '',
        projeto_id: '',
        quantidade_pecas: 500,
        tempo_peca_estimado: 1.2,
        data_inicio_pretendida: '',
        data_fim_pretendida: '',
        notas: '',
        prioridade: 'media'
      });
      fetchData();
    } catch (error) {
      toast.error('Erro ao criar negociacao');
    }
  };

  const handleIniciarNegociacao = async (negId) => {
    try {
      await api.post(`/reservas/negociacoes/${negId}/iniciar`);
      toast.success('Negociacao iniciada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao iniciar negociacao');
    }
  };

  const handleAprovarNegociacao = async (negociacao) => {
    try {
      const params = new URLSearchParams();
      if (negociacao.data_inicio_pretendida) {
        params.append('data_inicio_acordada', negociacao.data_inicio_pretendida);
      }
      if (negociacao.data_fim_pretendida) {
        params.append('data_fim_acordada', negociacao.data_fim_pretendida);
      }
      
      await api.post(`/reservas/negociacoes/${negociacao.id}/aprovar?${params}`);
      toast.success('Negociacao aprovada e reserva criada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao aprovar negociacao');
    }
  };

  const handleRejeitarNegociacao = async (negId) => {
    const motivo = prompt('Motivo da rejeicao (opcional):');
    try {
      const params = motivo ? `?motivo=${encodeURIComponent(motivo)}` : '';
      await api.post(`/reservas/negociacoes/${negId}/rejeitar${params}`);
      toast.success('Negociacao rejeitada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao rejeitar negociacao');
    }
  };

  const handleDeleteNegociacao = async (negId) => {
    if (!window.confirm('Eliminar esta negociacao?')) return;
    try {
      await api.delete(`/reservas/negociacoes/${negId}`);
      toast.success('Negociacao eliminada');
      fetchData();
    } catch (error) {
      toast.error('Erro ao eliminar negociacao');
    }
  };

  // Create negociacao from simulation
  const criarNegociacaoFromSimulation = (confeccao) => {
    setNegociacaoForm({
      confeccao_id: confeccao.confeccao.id,
      projeto_id: simulatorForm.projeto_id || '',
      quantidade_pecas: simulatorForm.quantidade,
      tempo_peca_estimado: simulatorForm.tempo_peca,
      data_inicio_pretendida: '',
      data_fim_pretendida: '',
      notas: `Simulacao: ${confeccao.simulacao.tempo_dias} dias estimados`,
      prioridade: 'media'
    });
    setShowNegociacaoModal(true);
  };

  // Notification handlers
  const markNotificationRead = async (notifId) => {
    try {
      await api.patch(`/reservas/notifications/${notifId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.post('/reservas/notifications/mark-all-read');
      fetchNotifications();
      toast.success('Todas notificacoes marcadas como lidas');
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  };

  const checkOverload = async () => {
    try {
      const response = await api.post('/reservas/check-overload');
      toast.success(`Verificacao concluida: ${response.data.notifications_created} alertas criados`);
      fetchNotifications();
    } catch (error) {
      toast.error('Erro na verificacao');
    }
  };

  const checkDeadlines = async () => {
    try {
      const response = await api.post('/reservas/check-deadlines');
      toast.success(`Verificacao concluida: ${response.data.notifications_created} alertas criados`);
      fetchNotifications();
    } catch (error) {
      toast.error('Erro na verificacao');
    }
  };

  // Sort and filter simulations
  const sortedSimulations = useMemo(() => {
    if (!simulatorData?.simulacoes) return [];
    
    let sorted = [...simulatorData.simulacoes];
    
    // Filter by search
    if (confeccaoSearch) {
      const term = confeccaoSearch.toLowerCase();
      sorted = sorted.filter(s => 
        s.confeccao.nome.toLowerCase().includes(term)
      );
    }
    
    switch (sortBy) {
      case 'menos_ocupado':
        sorted.sort((a, b) => b.simulacao.disponibilidade_atual - a.simulacao.disponibilidade_atual);
        break;
      case 'maior_capacidade':
        sorted.sort((a, b) => b.capacidade.capacidade_hora_mes - a.capacidade.capacidade_hora_mes);
        break;
      case 'menor_tempo':
        sorted.sort((a, b) => a.simulacao.tempo_dias - b.simulacao.tempo_dias);
        break;
      case 'melhor_qualidade':
        sorted.sort((a, b) => (b.confeccao.taxa_qualidade || 0) - (a.confeccao.taxa_qualidade || 0));
        break;
      default:
        sorted.sort((a, b) => b.simulacao.disponibilidade_depois - a.simulacao.disponibilidade_depois);
    }
    
    return sorted;
  }, [simulatorData, sortBy, confeccaoSearch]);

  // Filter negociacoes
  const filteredNegociacoes = useMemo(() => {
    if (!negociacaoFilter) return negociacoes;
    return negociacoes.filter(n => n.status === negociacaoFilter);
  }, [negociacoes, negociacaoFilter]);

  const getDisponibilidadeColor = (value) => {
    if (value >= 50) return 'text-green-600';
    if (value >= 20) return 'text-yellow-600';
    if (value >= 0) return 'text-orange-600';
    return 'text-red-600';
  };

  const getQualidadeStars = (taxa) => {
    const stars = Math.round((taxa || 0) / 20);
    return Array(5).fill(0).map((_, i) => (
      <Star 
        key={i} 
        className={`w-3 h-3 ${i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} 
      />
    ));
  };

  const getNegociacaoStatusColor = (status) => {
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'em_negociacao': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'aprovada': return 'bg-green-100 text-green-700 border-green-200';
      case 'rejeitada': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getNegociacaoStatusLabel = (status) => {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'em_negociacao': return 'Em Negociacao';
      case 'aprovada': return 'Aprovada';
      case 'rejeitada': return 'Rejeitada';
      default: return status;
    }
  };

  const getNotificationIcon = (tipo) => {
    switch (tipo) {
      case 'sobrecarga': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'conflito': return <XCircle className="w-4 h-4 text-orange-500" />;
      case 'prazo': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'capacidade': return <BarChart3 className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  // Calculate total hours
  const totalHoras = useMemo(() => {
    return Math.round(simulatorForm.quantidade * simulatorForm.tempo_peca / simulatorForm.eficiencia);
  }, [simulatorForm]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'simulator', label: 'Simulador', icon: Calculator },
    { id: 'negociacoes', label: 'Negociacoes', icon: MessageSquare, badge: negociacoesStats?.pendentes + negociacoesStats?.em_negociacao },
    { id: 'reservas', label: 'Reservas', icon: Bookmark },
    { id: 'calendar', label: 'Calendario', icon: Calendar }
  ];

  return (
    <MainLayout title="Planeamento de Confeccoes">
      <div data-testid="confeccao-planning-page" className="space-y-6">
        {/* Header with notifications */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={checkOverload}
              className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 flex items-center space-x-1"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Verificar Sobrecarga</span>
            </button>
            <button
              onClick={checkDeadlines}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center space-x-1"
            >
              <Clock className="w-4 h-4" />
              <span>Verificar Prazos</span>
            </button>
          </div>
          
          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-slate-100 rounded-lg"
            >
              {unreadCount > 0 ? (
                <BellRing className="w-6 h-6 text-orange-500" />
              ) : (
                <Bell className="w-6 h-6 text-slate-500" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <span className="font-medium text-slate-900">Notificacoes</span>
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Marcar todas como lidas
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={`px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                          !notif.lida ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {getNotificationIcon(notif.tipo)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!notif.lida ? 'font-medium' : ''} text-slate-900`}>
                              {notif.titulo}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {notif.mensagem}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {formatDateTime(notif.criado_em)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      Sem notificacoes
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="border-b border-slate-200 px-2">
            <div className="flex space-x-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`tab-${tab.id}`}
                    className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-400">A carregar...</div>
            </div>
          ) : (
            <div className="p-6">
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && dashboardData && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-slate-900">Capacidade Produtiva</h3>
                    <div className="flex space-x-2">
                      {['7d', '30d', '90d'].map(p => (
                        <button
                          key={p}
                          onClick={() => setPeriodo(p)}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            periodo === p 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {p === '7d' ? 'Semana' : p === '30d' ? '30 Dias' : '90 Dias'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 text-center">
                      <p className="text-sm text-blue-600 font-medium">Confecoes Ativas</p>
                      <p className="text-3xl font-bold text-blue-700 mt-2">{dashboardData.kpis.confeccoes_ativas}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 text-center">
                      <p className="text-sm text-green-600 font-medium">Trabalhos em Curso</p>
                      <p className="text-3xl font-bold text-green-700 mt-2">{dashboardData.kpis.trabalhos_em_curso}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 text-center">
                      <p className="text-sm text-purple-600 font-medium">Total Trabalhadores</p>
                      <p className="text-3xl font-bold text-purple-700 mt-2">{dashboardData.kpis.total_trabalhadores}</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 text-center">
                      <p className="text-sm text-orange-600 font-medium">Sem Confecao</p>
                      <p className="text-3xl font-bold text-orange-700 mt-2">{dashboardData.kpis.sem_confeccao || 0}</p>
                    </div>
                  </div>

                  {/* Projects sem confecao - lista */}
                  {dashboardData.projects_sem_confeccao?.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                          <h4 className="font-medium text-orange-900">Projetos sem Confecao Atribuida</h4>
                        </div>
                        <span className="text-xs text-orange-600">Ordenados por prazo de entrega</span>
                      </div>
                      <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-orange-100/50 text-orange-800 text-xs">
                              <th className="px-3 py-2 text-left">OF</th>
                              <th className="px-3 py-2 text-left">Modelo</th>
                              <th className="px-3 py-2 text-left">Qtd</th>
                              <th className="px-3 py-2 text-left">Progresso</th>
                              <th className="px-3 py-2 text-left">Prazo Entrega</th>
                              <th className="px-3 py-2 text-center">Acao</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-orange-100">
                            {dashboardData.projects_sem_confeccao.map((p, idx) => (
                              <tr key={idx} className="hover:bg-orange-50/50">
                                <td className="px-3 py-2 font-mono text-xs">{p.of_numero}</td>
                                <td className="px-3 py-2">{p.modelo}</td>
                                <td className="px-3 py-2">{p.quantidade?.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                      <div 
                                        className="bg-orange-500 h-1.5 rounded-full" 
                                        style={{ width: `${p.progresso || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-600">{p.progresso || 0}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {p.data_prevista_entrega ? formatDate(p.data_prevista_entrega) : '-'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => {
                                      setSimulatorForm(prev => ({
                                        ...prev,
                                        projeto_id: p.id,
                                        quantidade: p.quantidade || 100
                                      }));
                                      setActiveTab('simulator');
                                    }}
                                    className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                                  >
                                    Simular
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Capacity bars */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-4">Ocupacao por Confeccao</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dashboardData.confeccoes.map(conf => {
                        const ocupado = 100 - conf.disponibilidade_atual;
                        const disponivel = conf.disponibilidade_atual;
                        const taxaOcupacao = conf.taxa_ocupacao || 100;
                        const capacidadeTotal = conf.capacidade_total_mes || conf.capacidade_hora_mes;
                        const capacidadeDisponivel = conf.capacidade_disponivel_mes || conf.capacidade_hora_mes;
                        
                        return (
                          <div key={conf.id} className="bg-slate-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-slate-900">{conf.nome}</span>
                              <div className="flex items-center space-x-2">
                                <div className="flex">{getQualidadeStars(conf.taxa_qualidade)}</div>
                                <span className="text-xs text-slate-500">{conf.num_trabalhadores} trab.</span>
                              </div>
                            </div>
                            
                            {/* Capacidade info */}
                            <div className="flex justify-between text-xs text-slate-500 mb-2 bg-white rounded p-2">
                              <div>
                                <span className="text-slate-400">Total:</span>
                                <span className="ml-1 text-slate-600">{capacidadeTotal}h</span>
                              </div>
                              <div>
                                <span className="text-emerald-500 font-medium">Disp.:</span>
                                <span className="ml-1 text-emerald-600 font-medium">{capacidadeDisponivel}h</span>
                                <span className="text-slate-400 ml-1">({taxaOcupacao}%)</span>
                              </div>
                            </div>
                            
                            <div className="flex h-24 space-x-1 items-end">
                              <div className="flex-1 flex flex-col items-center">
                                <div 
                                  className="w-full bg-green-500 rounded-t transition-all"
                                  style={{ height: `${Math.max(disponivel, 5)}%` }}
                                />
                                <span className="text-xs text-green-600 mt-1">{Math.round(disponivel)}%</span>
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <div 
                                  className="w-full bg-red-500 rounded-t transition-all"
                                  style={{ height: `${Math.max(ocupado, 5)}%` }}
                                />
                                <span className="text-xs text-red-600 mt-1">{Math.round(ocupado)}%</span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                              <span>Disponivel</span>
                              <span>Ocupado</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SIMULATOR TAB */}
              {activeTab === 'simulator' && (
                <div className="space-y-6">
                  {/* Simulator form */}
                  <div className="bg-slate-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-slate-900 mb-4">Simular Novo Trabalho</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Projecto</label>
                        <select
                          value={simulatorForm.projeto_id}
                          onChange={async (e) => {
                            const projectId = e.target.value;
                            const project = projects.find(p => p.id === projectId);
                            
                            let tempoPeca = simulatorForm.tempo_peca;
                            let tempoFromProject = false;
                            
                            // Try to get tempo_peca from piece_cost
                            if (projectId) {
                              try {
                                const costRes = await api.get(`/piece-cost/${projectId}/current`);
                                if (costRes.data?.tempo_final) {
                                  // Convert minutes to hours
                                  tempoPeca = costRes.data.tempo_final / 60;
                                  tempoFromProject = true;
                                }
                              } catch (e) {
                                console.log('No piece cost for project');
                              }
                            }
                            
                            setSimulatorForm({
                              ...simulatorForm,
                              projeto_id: projectId,
                              quantidade: project?.quantidade || simulatorForm.quantidade,
                              tempo_peca: tempoPeca,
                              tempo_from_project: tempoFromProject
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Selecionar...</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.of_numero}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Quant. Pecas</label>
                        <input
                          type="number"
                          value={simulatorForm.quantidade}
                          onChange={(e) => setSimulatorForm({...simulatorForm, quantidade: parseInt(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Tempo/Peca (h)
                          {simulatorForm.tempo_from_project && (
                            <span className="ml-2 text-xs text-green-600 font-normal">(da OF)</span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={simulatorForm.tempo_peca}
                            onChange={(e) => setSimulatorForm({...simulatorForm, tempo_peca: parseFloat(e.target.value) || 0, tempo_from_project: false})}
                            className={`w-full px-3 py-2 border rounded-lg text-sm ${
                              simulatorForm.tempo_from_project 
                                ? 'border-green-300 bg-green-50' 
                                : 'border-slate-300'
                            }`}
                          />
                          {!simulatorForm.tempo_from_project && simulatorForm.projeto_id && (
                            <div className="absolute -bottom-5 left-0 text-xs text-amber-600">
                              Tempo nao definido na OF
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Eficiencia</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="1"
                          value={simulatorForm.eficiencia}
                          onChange={(e) => setSimulatorForm({...simulatorForm, eficiencia: parseFloat(e.target.value) || 0})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Total H/s</label>
                        <input
                          type="text"
                          readOnly
                          value={totalHoras}
                          className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg text-sm text-slate-700"
                        />
                      </div>
                      
                      <div>
                        <button
                          onClick={runSimulation}
                          disabled={simulating}
                          data-testid="simulate-btn"
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                        >
                          <Play className="w-4 h-4" />
                          <span>{simulating ? 'A simular...' : 'Simular'}</span>
                        </button>
                      </div>
                    </div>
                    
                    {simulatorData && (
                      <div className="mt-4 text-center">
                        <span className="text-2xl font-bold text-red-600">
                          Assumir que sao {Math.round(simulatorData.trabalho.horas_totais)} horas
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Search and Sort options */}
                  {simulatorData && (
                    <div className="flex justify-between items-center">
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Pesquisar confeccao..."
                          value={confeccaoSearch}
                          onChange={(e) => setConfeccaoSearch(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-slate-500">Ordenar por:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                        >
                          <option value="mais_disponivel">Mais disponivel</option>
                          <option value="menos_ocupado">Menos ocupado</option>
                          <option value="maior_capacidade">Maior capacidade</option>
                          <option value="menor_tempo">Menor tempo</option>
                          <option value="melhor_qualidade">Melhor qualidade</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Simulation results */}
                  {simulatorData && (
                    <div className="space-y-3">
                      {sortedSimulations.map((sim) => (
                        <div 
                          key={sim.confeccao.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            sim.simulacao.pode_aceitar 
                              ? 'border-slate-200 bg-white' 
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                              <div>
                                <h4 className="font-semibold text-slate-900 text-lg">
                                  {sim.confeccao.nome}
                                </h4>
                                <div className="flex items-center space-x-4 text-sm text-slate-500 mt-1">
                                  <span>Trabalhadores: {sim.capacidade.num_trabalhadores}</span>
                                  <span>Tempo: {sim.simulacao.tempo_dias} dias</span>
                                  <div className="flex items-center space-x-1">
                                    <span>Qualidade:</span>
                                    <div className="flex">{getQualidadeStars(sim.confeccao.taxa_qualidade)}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-sm">
                                <div className="text-slate-500">
                                  Cap. Total: <span className="text-slate-400">{sim.capacidade.capacidade_total_mes}h</span>
                                  <span className="mx-2">|</span>
                                  <span className="text-emerald-600 font-medium">
                                    Disponível: {sim.capacidade.capacidade_disponivel_mes || sim.capacidade.capacidade_hora_mes}h
                                  </span>
                                  <span className="text-slate-400 ml-1">({sim.capacidade.taxa_ocupacao || 100}%)</span>
                                </div>
                                <div className="flex space-x-4 mt-1">
                                  <span>Em curso: <span className="text-yellow-600 font-medium">{sim.capacidade.horas_em_curso}h</span></span>
                                  <span>Aprovados: <span className="text-green-600 font-medium">{sim.capacidade.horas_aprovadas}h</span></span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-6">
                              <div className="text-right">
                                <div className={`text-lg font-bold ${getDisponibilidadeColor(sim.simulacao.disponibilidade_atual)}`}>
                                  Disponibilidade {Math.round(sim.simulacao.disponibilidade_atual)}%
                                </div>
                                <div className={`text-sm ${getDisponibilidadeColor(sim.simulacao.disponibilidade_depois)}`}>
                                  Depois {Math.round(sim.simulacao.disponibilidade_depois)}%
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-center space-y-1">
                                <span className="text-xs text-slate-500">Negociar?</span>
                                <button
                                  onClick={() => {
                                    setMarkedForNegotiation(prev => ({
                                      ...prev,
                                      [sim.confeccao.id]: !prev[sim.confeccao.id]
                                    }));
                                    if (!markedForNegotiation[sim.confeccao.id]) {
                                      criarNegociacaoFromSimulation(sim);
                                    }
                                  }}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    markedForNegotiation[sim.confeccao.id]
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-300 hover:border-blue-400'
                                  }`}
                                >
                                  {markedForNegotiation[sim.confeccao.id] && <Check className="w-3 h-3" />}
                                </button>
                              </div>
                              
                              <button
                                onClick={() => setExpandedConfeccao(expandedConfeccao === sim.confeccao.id ? null : sim.confeccao.id)}
                                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                              >
                                <span>Ver mais</span>
                                {expandedConfeccao === sim.confeccao.id ? (
                                  <ChevronUp className="w-4 h-4 ml-1" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 ml-1" />
                                )}
                              </button>
                            </div>
                          </div>
                          
                          {expandedConfeccao === sim.confeccao.id && sim.trabalhos_atuais.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <h5 className="text-sm font-medium text-slate-700 mb-2">Trabalhos Atuais</h5>
                              <div className="space-y-1">
                                {sim.trabalhos_atuais.map((t, i) => (
                                  <div key={i} className="flex items-center justify-between text-sm text-slate-600">
                                    <span className="font-mono">{t.of_numero}</span>
                                    <span>{t.quantidade?.toLocaleString()} pecas</span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      t.status === 'ativo' ? 'bg-blue-100 text-blue-700' :
                                      t.status === 'atrasado' ? 'bg-red-100 text-red-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {t.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* NEGOCIACOES TAB */}
              {activeTab === 'negociacoes' && (
                <div className="space-y-6">
                  {/* Stats */}
                  {negociacoesStats && (
                    <div className="grid grid-cols-5 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-slate-700">{negociacoesStats.total}</p>
                        <p className="text-xs text-slate-500">Total</p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-700">{negociacoesStats.pendentes}</p>
                        <p className="text-xs text-yellow-600">Pendentes</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">{negociacoesStats.em_negociacao}</p>
                        <p className="text-xs text-blue-600">Em Negociacao</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-700">{negociacoesStats.aprovadas}</p>
                        <p className="text-xs text-green-600">Aprovadas</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-red-700">{negociacoesStats.rejeitadas}</p>
                        <p className="text-xs text-red-600">Rejeitadas</p>
                      </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-500">Filtrar:</span>
                      <select
                        value={negociacaoFilter}
                        onChange={(e) => setNegociacaoFilter(e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                      >
                        <option value="">Todos</option>
                        <option value="pendente">Pendentes</option>
                        <option value="em_negociacao">Em Negociacao</option>
                        <option value="aprovada">Aprovadas</option>
                        <option value="rejeitada">Rejeitadas</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setShowNegociacaoModal(true)}
                      data-testid="create-negociacao-btn"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nova Negociacao</span>
                    </button>
                  </div>
                  
                  {/* Negociacoes List */}
                  {filteredNegociacoes.length > 0 ? (
                    <div className="space-y-3">
                      {filteredNegociacoes.map(neg => (
                        <div key={neg.id} className="bg-white border border-slate-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="font-medium text-slate-900">{neg.confeccao_nome}</span>
                                <span className={`px-2 py-0.5 rounded text-xs border ${getNegociacaoStatusColor(neg.status)}`}>
                                  {getNegociacaoStatusLabel(neg.status)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  neg.prioridade === 'alta' ? 'bg-red-100 text-red-700' :
                                  neg.prioridade === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {neg.prioridade}
                                </span>
                                <div className="flex">{getQualidadeStars(neg.confeccao_taxa_qualidade)}</div>
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-slate-500 mt-2">
                                {neg.projeto_of !== '-' && (
                                  <span>Projeto: <span className="font-mono">{neg.projeto_of}</span></span>
                                )}
                                <span>{neg.quantidade_pecas?.toLocaleString()} pecas</span>
                                <span>{Math.round(neg.horas_totais)}h estimadas</span>
                                <span>{neg.tempo_peca_estimado}h/peca</span>
                              </div>
                              {neg.notas && (
                                <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded">{neg.notas}</p>
                              )}
                              {neg.resposta_confeccao && (
                                <p className="text-sm text-slate-600 mt-2 bg-blue-50 p-2 rounded">
                                  <span className="font-medium">Resposta:</span> {neg.resposta_confeccao}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              {neg.status === 'pendente' && (
                                <button
                                  onClick={() => handleIniciarNegociacao(neg.id)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                  title="Iniciar Negociacao"
                                >
                                  <Send className="w-5 h-5" />
                                </button>
                              )}
                              {neg.status === 'em_negociacao' && (
                                <>
                                  <button
                                    onClick={() => handleAprovarNegociacao(neg)}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                    title="Aprovar"
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleRejeitarNegociacao(neg.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                    title="Rejeitar"
                                  >
                                    <XCircle className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteNegociacao(neg.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="Eliminar"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Sem negociacoes {negociacaoFilter && `com status "${negociacaoFilter}"`}</p>
                    </div>
                  )}
                </div>
              )}

              {/* RESERVAS TAB */}
              {activeTab === 'reservas' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-slate-900">Reservas de Capacidade</h3>
                    <button
                      onClick={() => setShowReservaModal(true)}
                      data-testid="create-reserva-btn"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nova Reserva</span>
                    </button>
                  </div>
                  
                  {reservas.length > 0 ? (
                    <div className="space-y-3">
                      {reservas.map(reserva => (
                        <div key={reserva.id} className="bg-white border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-3">
                                <span className="font-medium text-slate-900">{reserva.descricao}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  reserva.status === 'confirmada' ? 'bg-green-100 text-green-700' :
                                  reserva.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {reserva.status}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  reserva.prioridade === 'alta' ? 'bg-red-100 text-red-700' :
                                  reserva.prioridade === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {reserva.prioridade}
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-slate-500 mt-2">
                                <span>Confeccao: {reserva.confeccao_nome}</span>
                                <span>{reserva.quantidade_pecas?.toLocaleString()} pecas</span>
                                <span>{Math.round(reserva.horas_totais)}h</span>
                                <span>{formatDate(reserva.data_inicio)} - {formatDate(reserva.data_fim)}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {reserva.status === 'pendente' && (
                                <button
                                  onClick={() => handleConfirmReserva(reserva.id)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                  title="Confirmar"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteReserva(reserva.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Eliminar"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Sem reservas de capacidade</p>
                    </div>
                  )}
                </div>
              )}

              {/* CALENDAR TAB */}
              {activeTab === 'calendar' && calendarData && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-sm text-slate-500">
                      <Move className="w-4 h-4" />
                      <span>Arraste trabalhos/reservas para reorganizar.</span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setViewMode('gantt')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          viewMode === 'gantt' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Timeline
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          viewMode === 'list' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Lista
                      </button>
                    </div>
                  </div>

                  {viewMode === 'gantt' && (
                    <GanttChart
                      confeccoes={calendarData.confeccoes}
                      reservas={reservas}
                      onMoveItem={handleGanttMoveItem}
                      onResizeItem={handleGanttResizeItem}
                      onItemClick={handleGanttItemClick}
                      onUpdateDates={handleGanttUpdateDates}
                      onDeleteItem={handleGanttDeleteItem}
                    />
                  )}
                  
                  {viewMode === 'list' && (
                    <div className="space-y-4">
                      {calendarData.confeccoes.map(conf => (
                        <div 
                          key={conf.confeccao.id} 
                          className={`bg-white border rounded-lg overflow-hidden transition-colors ${
                            dropTarget === conf.confeccao.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                          }`}
                          onDragOver={(e) => handleDragOver(e, conf.confeccao.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, conf.confeccao.id)}
                        >
                          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-slate-900">{conf.confeccao.nome}</span>
                              <span className="text-xs text-slate-500">
                                Capacidade: {conf.confeccao.capacidade_pecas_mes?.toLocaleString()} pecas/mes
                              </span>
                            </div>
                            <span className="text-sm text-slate-600">{conf.total_trabalhos} trabalhos</span>
                          </div>
                          
                          <div className="p-4 min-h-[80px]">
                            {conf.eventos.length > 0 || reservas.filter(r => r.confeccao_id === conf.confeccao.id).length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {conf.eventos.map(evento => (
                                  <div
                                    key={evento.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, evento, 'trabalho')}
                                    className="px-3 py-2 rounded-lg text-white text-sm cursor-move hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: evento.cor }}
                                  >
                                    <div className="flex items-center space-x-1">
                                      <GripVertical className="w-3 h-3 opacity-50" />
                                      <span className="font-medium">{evento.modelo || evento.of_numero}</span>
                                    </div>
                                    <div className="text-xs opacity-80 mt-1">
                                      {evento.quantidade?.toLocaleString()} pecas | {evento.dias_estimados}d
                                    </div>
                                  </div>
                                ))}
                                
                                {reservas
                                  .filter(r => r.confeccao_id === conf.confeccao.id)
                                  .map(reserva => (
                                    <div
                                      key={reserva.id}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, reserva, 'reserva')}
                                      className={`px-3 py-2 rounded-lg text-sm cursor-move hover:opacity-90 border-2 border-dashed ${
                                        reserva.status === 'confirmada' 
                                          ? 'bg-green-50 border-green-400 text-green-800'
                                          : 'bg-yellow-50 border-yellow-400 text-yellow-800'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-1">
                                        <GripVertical className="w-3 h-3 opacity-50" />
                                        <Bookmark className="w-3 h-3" />
                                        <span className="font-medium">{reserva.descricao}</span>
                                      </div>
                                      <div className="text-xs opacity-80 mt-1">
                                        {reserva.quantidade_pecas?.toLocaleString()} pecas
                                      </div>
                                    </div>
                                  ))
                                }
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400 text-center py-2">
                                Arraste trabalhos para aqui
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reserva Modal */}
      {showReservaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Nova Reserva de Capacidade</h2>
              <button onClick={() => setShowReservaModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleCreateReserva} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confeccao *</label>
                <select
                  value={reservaForm.confeccao_id}
                  onChange={(e) => setReservaForm({...reservaForm, confeccao_id: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Selecionar...</option>
                  {confeccoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descricao *</label>
                <input
                  type="text"
                  value={reservaForm.descricao}
                  onChange={(e) => setReservaForm({...reservaForm, descricao: e.target.value})}
                  required
                  placeholder="Ex: Reserva colecao Inverno"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantidade Pecas *</label>
                  <input
                    type="number"
                    value={reservaForm.quantidade_pecas}
                    onChange={(e) => setReservaForm({...reservaForm, quantidade_pecas: parseInt(e.target.value) || 0})}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tempo/Peca (h)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={reservaForm.tempo_peca}
                    onChange={(e) => setReservaForm({...reservaForm, tempo_peca: parseFloat(e.target.value) || 1.2})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Data Inicio *</label>
                  <input
                    type="date"
                    value={reservaForm.data_inicio}
                    onChange={(e) => setReservaForm({...reservaForm, data_inicio: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Data Fim *</label>
                  <input
                    type="date"
                    value={reservaForm.data_fim}
                    onChange={(e) => setReservaForm({...reservaForm, data_fim: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Prioridade</label>
                <select
                  value={reservaForm.prioridade}
                  onChange={(e) => setReservaForm({...reservaForm, prioridade: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Criar Reserva
                </button>
                <button
                  type="button"
                  onClick={() => setShowReservaModal(false)}
                  className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Negociacao Modal */}
      {showNegociacaoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Nova Negociacao</h2>
              <button onClick={() => setShowNegociacaoModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleCreateNegociacao} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confeccao *</label>
                <select
                  value={negociacaoForm.confeccao_id}
                  onChange={(e) => setNegociacaoForm({...negociacaoForm, confeccao_id: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Selecionar...</option>
                  {confeccoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Projeto (opcional)</label>
                <select
                  value={negociacaoForm.projeto_id}
                  onChange={(e) => setNegociacaoForm({...negociacaoForm, projeto_id: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Nenhum</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.of_numero} - {p.modelo}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantidade Pecas *</label>
                  <input
                    type="number"
                    value={negociacaoForm.quantidade_pecas}
                    onChange={(e) => setNegociacaoForm({...negociacaoForm, quantidade_pecas: parseInt(e.target.value) || 0})}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Tempo/Peca (h)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={negociacaoForm.tempo_peca_estimado}
                    onChange={(e) => setNegociacaoForm({...negociacaoForm, tempo_peca_estimado: parseFloat(e.target.value) || 1.2})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Data Inicio Pretendida</label>
                  <input
                    type="date"
                    value={negociacaoForm.data_inicio_pretendida}
                    onChange={(e) => setNegociacaoForm({...negociacaoForm, data_inicio_pretendida: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Data Fim Pretendida</label>
                  <input
                    type="date"
                    value={negociacaoForm.data_fim_pretendida}
                    onChange={(e) => setNegociacaoForm({...negociacaoForm, data_fim_pretendida: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
                <textarea
                  value={negociacaoForm.notas}
                  onChange={(e) => setNegociacaoForm({...negociacaoForm, notas: e.target.value})}
                  rows={3}
                  placeholder="Detalhes adicionais..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Prioridade</label>
                <select
                  value={negociacaoForm.prioridade}
                  onChange={(e) => setNegociacaoForm({...negociacaoForm, prioridade: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Criar Negociacao
                </button>
                <button
                  type="button"
                  onClick={() => setShowNegociacaoModal(false)}
                  className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default ConfeccaoPlanning;
