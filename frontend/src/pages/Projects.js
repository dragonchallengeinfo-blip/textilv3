import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { useProjectsRealtime } from '@/hooks/useWebSocket';
import { 
  Plus, Search, Settings, Eye, Edit, Clock, Calendar, 
  ChevronDown, ChevronUp, Tag, AlertTriangle, Filter, X,
  ChevronLeft, ChevronRight, Download, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { formatDate, getStatusColor, getStatusLabel } from '@/utils/helpers';
import { toast } from 'sonner';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [brands, setBrands] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'data_prevista_entrega', direction: 'asc' });
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  const [filters, setFilters] = useState({
    status: '',
    marca_id: '',
    tipo_ordem_id: '',
    comercial_id: '',
    confeccao_id: '',
    data_entrega_inicio: '',
    data_entrega_fim: '',
    urgencia: ''
  });

  // Função para recarregar projetos
  const fetchProjects = useCallback(async () => {
    try {
      const projectsRes = await api.get('/projects/');
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  }, []);

  // ========== WEBSOCKET: Auto-refresh quando projetos mudam ==========
  const { isConnected, lastUpdate, updateCount } = useProjectsRealtime(fetchProjects);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, brandsRes, orderTypesRes, partnersRes, usersRes] = await Promise.all([
        api.get('/projects/'),
        api.get('/brands/'),
        api.get('/order-types/'),
        api.get('/partners/'),
        api.get('/users/')
      ]);
      setProjects(projectsRes.data);
      setBrands(brandsRes.data);
      setOrderTypes(orderTypesRes.data);
      setPartners(partnersRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get confeccoes from partners
  const confeccoes = useMemo(() => {
    return partners.filter(p => p.tipo_servico === 'confeccao' && p.ativo);
  }, [partners]);

  // Get comerciais from users
  const comerciais = useMemo(() => {
    return users.filter(u => u.role === 'comercial' || u.role === 'administrador');
  }, [users]);

  // Helper functions
  const getBrandName = (marcaId) => {
    const brand = brands.find(b => b.id === marcaId);
    return brand?.nome || '-';
  };

  const getOrderTypeName = (tipoId) => {
    const type = orderTypes.find(t => t.id === tipoId);
    return type?.nome || '-';
  };

  const getPartnerName = (partnerId) => {
    const partner = partners.find(p => p.id === partnerId);
    return partner?.nome || '-';
  };

  const getComercialName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.nome || '-';
  };

  const getDaysRemaining = (deliveryDate) => {
    if (!deliveryDate) return null;
    const today = new Date();
    const delivery = new Date(deliveryDate);
    const diffTime = delivery - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyLevel = (days) => {
    if (days === null) return 'none';
    if (days < 0) return 'atrasado';
    if (days <= 3) return 'critico';
    if (days <= 7) return 'urgente';
    if (days <= 14) return 'atencao';
    return 'normal';
  };

  const getDaysRemainingStyle = (days) => {
    if (days === null) return 'text-slate-400';
    if (days < 0) return 'text-red-600 font-semibold';
    if (days <= 3) return 'text-red-500';
    if (days <= 7) return 'text-yellow-600';
    return 'text-slate-600';
  };

  const getDaysRemainingText = (days) => {
    if (days === null) return '-';
    if (days < 0) return `${Math.abs(days)}d atrasado`;
    if (days === 0) return 'Hoje';
    return `${days}d`;
  };

  // Sort function
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1); // Reset to first page on sort
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: '',
      marca_id: '',
      tipo_ordem_id: '',
      comercial_id: '',
      confeccao_id: '',
      data_entrega_inicio: '',
      data_entrega_fim: '',
      urgencia: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== '').length;
  }, [filters]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search filter (OF/modelo)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.of_numero.toLowerCase().includes(term) ||
        p.modelo?.toLowerCase().includes(term) ||
        getBrandName(p.marca_id).toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filters.status) {
      result = result.filter(p => p.status_projeto === filters.status);
    }

    // Brand filter
    if (filters.marca_id) {
      result = result.filter(p => p.marca_id === filters.marca_id);
    }

    // Order type filter
    if (filters.tipo_ordem_id) {
      result = result.filter(p => p.tipo_ordem_id === filters.tipo_ordem_id);
    }

    // Comercial filter
    if (filters.comercial_id) {
      result = result.filter(p => p.comercial_responsavel_id === filters.comercial_id);
    }

    // Confeccao filter
    if (filters.confeccao_id) {
      result = result.filter(p => p.parceiro_confeccao_id === filters.confeccao_id);
    }

    // Date range filter - inicio
    if (filters.data_entrega_inicio) {
      const startDate = new Date(filters.data_entrega_inicio);
      result = result.filter(p => {
        if (!p.data_prevista_entrega) return false;
        return new Date(p.data_prevista_entrega) >= startDate;
      });
    }

    // Date range filter - fim
    if (filters.data_entrega_fim) {
      const endDate = new Date(filters.data_entrega_fim);
      result = result.filter(p => {
        if (!p.data_prevista_entrega) return false;
        return new Date(p.data_prevista_entrega) <= endDate;
      });
    }

    // Urgency filter
    if (filters.urgencia) {
      result = result.filter(p => {
        const days = getDaysRemaining(p.data_prevista_entrega);
        const urgency = getUrgencyLevel(days);
        return urgency === filters.urgencia;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Special sorting for computed values
      if (sortConfig.key === 'dias_restantes') {
        aVal = getDaysRemaining(a.data_prevista_entrega);
        bVal = getDaysRemaining(b.data_prevista_entrega);
      } else if (sortConfig.key === 'marca') {
        aVal = getBrandName(a.marca_id);
        bVal = getBrandName(b.marca_id);
      } else if (sortConfig.key === 'comercial') {
        aVal = getComercialName(a.comercial_responsavel_id);
        bVal = getComercialName(b.comercial_responsavel_id);
      } else if (sortConfig.key === 'confeccao') {
        aVal = getPartnerName(a.parceiro_confeccao_id);
        bVal = getPartnerName(b.parceiro_confeccao_id);
      } else if (sortConfig.key === 'tipo') {
        aVal = getOrderTypeName(a.tipo_ordem_id);
        bVal = getOrderTypeName(b.tipo_ordem_id);
      }

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [projects, searchTerm, filters, sortConfig, brands, users, partners, orderTypes]);

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProjects.slice(start, start + itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp className="w-3 h-3 inline ml-1 text-slate-300" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline ml-1 text-blue-600" /> 
      : <ChevronDown className="w-4 h-4 inline ml-1 text-blue-600" />;
  };

  const SortableHeader = ({ columnKey, children, className = "" }) => (
    <th 
      className={`h-10 px-4 text-left cursor-pointer hover:bg-slate-100 select-none ${className}`}
      onClick={() => handleSort(columnKey)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon columnKey={columnKey} />
      </div>
    </th>
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.confeccao_id) params.append('confeccao_id', filters.confeccao_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.marca_id) params.append('marca_id', filters.marca_id);
      if (filters.tipo_ordem_id) params.append('tipo_ordem_id', filters.tipo_ordem_id);
      if (filters.comercial_id) params.append('comercial_id', filters.comercial_id);
      if (filters.data_entrega_inicio) params.append('data_inicio', filters.data_entrega_inicio);
      if (filters.data_entrega_fim) params.append('data_fim', filters.data_entrega_fim);
      
      const response = await api.get(`/export/projects?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'projetos_export.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Exportação concluída!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const actions = (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleExport}
        disabled={exporting}
        data-testid="export-projects-button"
        className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2 disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        <span>{exporting ? 'A exportar...' : 'Exportar'}</span>
      </button>
      <button
        onClick={() => navigate('/projects/new')}
        data-testid="create-project-button"
        className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Novo Projeto</span>
      </button>
    </div>
  );

  if (loading) {
    return (
      <MainLayout title="Projetos" actions={actions}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Projetos" actions={actions}>
      <div data-testid="projects-page" className="space-y-4">
        {/* Indicador de tempo real */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <Wifi className="w-3 h-3" />
                <span>Tempo real ativo</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                <WifiOff className="w-3 h-3" />
                <span>A ligar...</span>
              </span>
            )}
            {lastUpdate && (
              <span className="text-xs text-slate-400">
                Última atualização: {lastUpdate.toLocaleTimeString('pt-PT')}
              </span>
            )}
            {updateCount > 0 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                {updateCount} {updateCount === 1 ? 'atualização' : 'atualizações'} recebidas
              </span>
            )}
          </div>
          <button
            onClick={fetchProjects}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          {/* Main filter row */}
          <div className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="OF/modelo, cliente/marca/responsavel..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  data-testid="search-projects-input"
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                />
              </div>

              {/* Quick filters */}
              <select
                value={filters.status}
                onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(1); }}
                data-testid="filter-status"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">Todos os estados</option>
                <option value="ativo">Ativo</option>
                <option value="rascunho">Rascunho</option>
                <option value="atrasado">Atrasado</option>
                <option value="concluido">Concluido</option>
                <option value="bloqueado">Bloqueado</option>
              </select>

              <select
                value={filters.tipo_ordem_id}
                onChange={(e) => { setFilters({ ...filters, tipo_ordem_id: e.target.value }); setCurrentPage(1); }}
                data-testid="filter-tipo"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">Todos os tipos</option>
                {orderTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.nome}</option>
                ))}
              </select>

              <select
                value={filters.comercial_id}
                onChange={(e) => { setFilters({ ...filters, comercial_id: e.target.value }); setCurrentPage(1); }}
                data-testid="filter-comercial"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">Comercial: Todos</option>
                {comerciais.map(user => (
                  <option key={user.id} value={user.id}>{user.nome}</option>
                ))}
              </select>

              <select
                value={filters.confeccao_id}
                onChange={(e) => { setFilters({ ...filters, confeccao_id: e.target.value }); setCurrentPage(1); }}
                data-testid="filter-confeccao"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">Confecao: Todos</option>
                {confeccoes.map(conf => (
                  <option key={conf.id} value={conf.id}>{conf.nome}</option>
                ))}
              </select>

              <select
                value={filters.urgencia}
                onChange={(e) => { setFilters({ ...filters, urgencia: e.target.value }); setCurrentPage(1); }}
                data-testid="filter-urgencia"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">Urgencia: Todos</option>
                <option value="atrasado">Atrasado</option>
                <option value="critico">Critico (0-3 dias)</option>
                <option value="urgente">Urgente (4-7 dias)</option>
                <option value="atencao">Atencao (8-14 dias)</option>
                <option value="normal">Normal (+14 dias)</option>
              </select>

              {/* Toggle advanced filters */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors flex items-center space-x-1 ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filtros</span>
                {activeFiltersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Clear filters */}
              {(activeFiltersCount > 0 || searchTerm) && (
                <button
                  onClick={clearFilters}
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <X className="w-4 h-4" />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>

          {/* Advanced filters row */}
          {showFilters && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={filters.marca_id}
                  onChange={(e) => { setFilters({ ...filters, marca_id: e.target.value }); setCurrentPage(1); }}
                  data-testid="filter-marca"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
                >
                  <option value="">Marca: Todas</option>
                  {brands.filter(b => b.ativo).map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.nome}</option>
                  ))}
                </select>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-500">Dt Entrega:</span>
                  <input
                    type="date"
                    value={filters.data_entrega_inicio}
                    onChange={(e) => { setFilters({ ...filters, data_entrega_inicio: e.target.value }); setCurrentPage(1); }}
                    data-testid="filter-data-inicio"
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="date"
                    value={filters.data_entrega_fim}
                    onChange={(e) => { setFilters({ ...filters, data_entrega_fim: e.target.value }); setCurrentPage(1); }}
                    data-testid="filter-data-fim"
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Projects Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <SortableHeader columnKey="of_numero">OF</SortableHeader>
                  <SortableHeader columnKey="quantidade" className="text-right">Qtd</SortableHeader>
                  <SortableHeader columnKey="marca">Marca</SortableHeader>
                  <SortableHeader columnKey="tipo">Tipo</SortableHeader>
                  <SortableHeader columnKey="comercial">Comercial</SortableHeader>
                  <SortableHeader columnKey="confeccao">Confecao</SortableHeader>
                  <SortableHeader columnKey="progresso_percentagem" className="text-center">Progresso</SortableHeader>
                  <SortableHeader columnKey="data_prevista_entrega">Entrega</SortableHeader>
                  <SortableHeader columnKey="dias_restantes" className="text-center">Falta</SortableHeader>
                  <SortableHeader columnKey="status_projeto" className="text-center">Estado</SortableHeader>
                  <th className="h-10 px-4 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.length > 0 ? (
                  paginatedProjects.map((project) => {
                    const daysRemaining = getDaysRemaining(project.data_prevista_entrega);
                    
                    return (
                      <tr 
                        key={project.id} 
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">{project.of_numero}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-mono">
                          {project.quantidade?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-700">{getBrandName(project.marca_id)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {getOrderTypeName(project.tipo_ordem_id)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {getComercialName(project.comercial_responsavel_id)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {getPartnerName(project.parceiro_confeccao_id)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  project.progresso_percentagem >= 100 ? 'bg-green-500' :
                                  project.progresso_percentagem >= 50 ? 'bg-blue-500' :
                                  project.progresso_percentagem >= 25 ? 'bg-yellow-500' :
                                  'bg-slate-300'
                                }`}
                                style={{ width: `${Math.min(project.progresso_percentagem, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-8 text-right">
                              {Math.round(project.progresso_percentagem)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1 text-slate-600">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(project.data_prevista_entrega)}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-center ${getDaysRemainingStyle(daysRemaining)}`}>
                          <div className="flex items-center justify-center space-x-1">
                            {daysRemaining !== null && daysRemaining <= 3 && (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            <span>{getDaysRemainingText(daysRemaining)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${getStatusColor(project.status_projeto)}`}>
                            {getStatusLabel(project.status_projeto)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => navigate(`/projects/${project.id}`)}
                              data-testid={`view-project-${project.id}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/projects/${project.id}/edit`)}
                              data-testid={`edit-project-${project.id}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/projects/${project.id}`)}
                              data-testid={`settings-project-${project.id}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title="Definicoes"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="11" className="py-8 text-center text-slate-400">
                      Nenhum projeto encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer with pagination */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4 text-sm text-slate-500">
              <span>{filteredProjects.length} projetos encontrados</span>
              <div className="flex items-center space-x-2">
                <span>Mostrar:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(e.target.value)}
                  data-testid="items-per-page"
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </select>
                <span>por pagina</span>
              </div>
            </div>
            
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <ChevronLeft className="w-4 h-4 -ml-2" />
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="px-3 py-1 text-sm">
                  Pagina {currentPage} de {totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4 -ml-2" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Projects;
