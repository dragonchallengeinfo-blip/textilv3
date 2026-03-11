import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import HelpTutorial from '@/components/HelpTutorial';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Calendar, Search, Calculator, Save, ChevronRight, CheckCircle2,
  AlertCircle, Clock, Circle, Play, Flag, LayoutGrid, List, 
  Filter, User, Tag, Package, Target, BarChart3, Layers, CalendarDays
} from 'lucide-react';
import { formatDate } from '@/utils/helpers';

const Planning = () => {
  const [projects, setProjects] = useState([]);
  const [stages, setStages] = useState([]);
  const [brands, setBrands] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [planning, setPlanning] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('por_planear'); // 'por_planear' or 'planeado'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Key dates for calculation
  const [dataEntrega, setDataEntrega] = useState('');
  const [dataConfecao, setDataConfecao] = useState('');
  const [diasPorEtapa, setDiasPorEtapa] = useState({});
  const [defaultDays, setDefaultDays] = useState({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [projectsRes, stagesRes, brandsRes, usersRes] = await Promise.all([
        api.get('/planning/projects'),
        api.get('/planning/stages'),
        api.get('/brands/'),
        api.get('/users/')
      ]);
      setProjects(projectsRes.data);
      setStages(stagesRes.data.stages || []);
      setDefaultDays(stagesRes.data.default_days || {});
      setDiasPorEtapa(stagesRes.data.default_days || {});
      setBrands(brandsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async (search = '') => {
    try {
      const response = await api.get(`/planning/projects${search ? `?search=${search}` : ''}`);
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  // Helper functions
  const getBrandName = (marcaId) => {
    const brand = brands.find(b => b.id === marcaId);
    return brand?.nome || '-';
  };

  const getComercialName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.nome || '-';
  };

  const getCurrentStageName = (project) => {
    if (!project.planning || project.planning.length === 0) return 'Sem planeamento';
    
    // Find current active stage
    for (const stage of project.planning) {
      if (stage.data_inicio_real && !stage.data_fim_real) {
        return stage.nome;
      }
    }
    
    // If no active stage, return first non-started
    for (const stage of project.planning) {
      if (!stage.data_inicio_real) {
        return stage.nome;
      }
    }
    
    return 'Concluido';
  };

  // Filter projects by planning status
  const { projectsPorPlanear, projectsPlaneados } = useMemo(() => {
    const filtered = projects.filter(p => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.of_numero?.toLowerCase().includes(term) ||
        p.modelo?.toLowerCase().includes(term) ||
        getBrandName(p.marca_id).toLowerCase().includes(term)
      );
    });

    const porPlanear = filtered.filter(p => !p.has_planning);
    const planeados = filtered.filter(p => p.has_planning);
    
    return { projectsPorPlanear: porPlanear, projectsPlaneados: planeados };
  }, [projects, searchTerm, brands]);

  const displayedProjects = activeTab === 'por_planear' ? projectsPorPlanear : projectsPlaneados;

  const selectProject = async (project) => {
    setSelectedProject(project);
    setLoading(true);
    
    try {
      const response = await api.get(`/planning/${project.id}`);
      setPlanning(response.data.planning);
      
      // Set delivery date from project
      if (response.data.project.data_prevista_entrega) {
        const date = new Date(response.data.project.data_prevista_entrega);
        setDataEntrega(date.toISOString().split('T')[0]);
      }
      
      // Extract dias_previstos from existing planning
      const dias = {};
      response.data.planning.forEach(p => {
        if (p.dias_previstos !== undefined) {
          dias[p.key] = p.dias_previstos;
        }
      });
      if (Object.keys(dias).length > 0) {
        setDiasPorEtapa(prev => ({ ...prev, ...dias }));
      }
    } catch (error) {
      console.error('Failed to fetch planning:', error);
      toast.error('Erro ao carregar planeamento');
    } finally {
      setLoading(false);
    }
  };

  const calculateDates = async () => {
    if (!dataEntrega) {
      toast.error('Defina a data de entrega');
      return;
    }

    try {
      const response = await api.post('/planning/calculate', {
        data_entrega: new Date(dataEntrega).toISOString(),
        data_confecao: dataConfecao ? new Date(dataConfecao).toISOString() : null,
        dias_por_etapa: diasPorEtapa
      });
      
      // Update planning with calculated dates
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

  const updateStageDays = (stageKey, days) => {
    setDiasPorEtapa(prev => ({ ...prev, [stageKey]: parseInt(days) || 0 }));
  };

  const savePlanning = async () => {
    if (!selectedProject) return;
    
    setSaving(true);
    try {
      await api.post(`/planning/${selectedProject.id}`, {
        stages: planning.map(stage => ({
          ...stage,
          etapa_key: stage.key,
          dias_previstos: diasPorEtapa[stage.key] || stage.dias_previstos || 0
        }))
      });
      toast.success('Planeamento guardado com sucesso');
      
      // Refresh data
      await fetchProjects(searchTerm);
      const response = await api.get(`/planning/${selectedProject.id}`);
      setPlanning(response.data.planning);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Erro ao guardar planeamento');
    } finally {
      setSaving(false);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'nao_iniciado': { color: 'bg-slate-100 text-slate-500', icon: Circle, label: 'Nao iniciado' },
      'dentro_prazo': { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Dentro do prazo' },
      'risco': { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle, label: 'Em risco' },
      'atrasado': { color: 'bg-red-100 text-red-700', icon: Clock, label: 'Atrasado' },
      'concluido': { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Concluido' },
      'concluido_atrasado': { color: 'bg-orange-100 text-orange-700', icon: CheckCircle2, label: 'Concluido (atrasado)' }
    };
    return statusMap[status] || statusMap['nao_iniciado'];
  };

  // Calculate Gantt chart data
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

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Project Card Component
  const ProjectCard = ({ project }) => (
    <button
      key={project.id}
      data-testid={`project-${project.id}`}
      onClick={() => selectProject(project)}
      className={`text-left p-4 rounded-lg border transition-all w-full ${
        selectedProject?.id === project.id
          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900 shadow-md'
          : project.has_planning
            ? 'border-green-200 bg-green-50/30 hover:border-green-300 hover:bg-green-50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-sm font-bold text-slate-900">{project.of_numero}</div>
          <div className="text-sm text-slate-600 truncate mt-0.5">{project.modelo}</div>
        </div>
        <div className="flex items-center space-x-2">
          {project.has_planning && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
              Planeado
            </span>
          )}
          {project.status_projeto && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              project.status_projeto === 'ativo' ? 'bg-blue-100 text-blue-700' :
              project.status_projeto === 'atrasado' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {project.status_projeto}
            </span>
          )}
        </div>
      </div>
      
      <div className="mt-3 space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <Tag className="w-3 h-3" />
          <span className="font-medium">{getBrandName(project.marca_id)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Package className="w-3 h-3" />
          <span>{project.quantidade?.toLocaleString()} pecas</span>
        </div>
        <div className="flex items-center space-x-2">
          <User className="w-3 h-3" />
          <span>{getComercialName(project.comercial_responsavel_id)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-3 h-3" />
          <span>Entrega: {formatDate(project.data_prevista_entrega)}</span>
        </div>
        {project.has_planning && project.current_stage && (
          <div className="flex items-center space-x-2 text-green-600">
            <Play className="w-3 h-3" />
            <span className="font-medium">Etapa: {project.current_stage}</span>
          </div>
        )}
      </div>
    </button>
  );

  // Project List Row Component
  const ProjectListRow = ({ project }) => (
    <tr 
      key={project.id}
      onClick={() => selectProject(project)}
      className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
        selectedProject?.id === project.id ? 'bg-blue-50' : ''
      }`}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-bold text-slate-900">{project.of_numero}</span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{getBrandName(project.marca_id)}</td>
      <td className="px-4 py-3 text-sm text-slate-600 text-right font-mono">
        {project.quantidade?.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{getComercialName(project.comercial_responsavel_id)}</td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {project.has_planning ? (
          <span className="text-blue-600">{project.current_stage || 'Planeado'}</span>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(project.data_prevista_entrega)}</td>
    </tr>
  );

  // Tutorial sections for Planning page
  const tutorialSections = [
    {
      title: 'O que e o Planeamento?',
      icon: Target,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      content: (
        <div>
          <p>O <strong>Planeamento</strong> permite definir as datas previstas para cada etapa de producao de um projeto. Com ele, consegue:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Calcular automaticamente as datas com base na data de entrega</li>
            <li>Definir dias por cada etapa de producao</li>
            <li>Visualizar um grafico de Gantt com a timeline</li>
            <li>Acompanhar o progresso real vs previsto</li>
          </ul>
        </div>
      )
    },
    {
      title: 'Separadores: Por Planear vs Planeado',
      icon: Layers,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      content: (
        <div>
          <p>Os projetos estao organizados em dois separadores:</p>
          <div className="mt-3 space-y-3">
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="font-medium text-orange-900">Por Planear</p>
              <p className="text-orange-700 text-sm mt-1">
                Projetos que ainda nao tem datas definidas para as etapas. E aqui que deve comecar a planear.
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="font-medium text-green-900">Planeado</p>
              <p className="text-green-700 text-sm mt-1">
                Projetos ja com planeamento definido. Pode editar datas ou acompanhar o progresso.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Como calcular datas automaticamente',
      icon: Calculator,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      content: (
        <div>
          <p>Para calcular automaticamente as datas de cada etapa:</p>
          <ol className="list-decimal list-inside mt-2 space-y-2">
            <li>Selecione um projeto da lista</li>
            <li>Defina a <strong>Data de Entrega Final</strong> (obrigatorio)</li>
            <li>Opcionalmente, defina a <strong>Data Entrega Confecao</strong></li>
            <li>Ajuste os <strong>dias por etapa</strong> conforme necessario</li>
            <li>Clique em <strong>"Calcular Datas"</strong></li>
          </ol>
          <p className="mt-3 text-slate-500 text-sm">
            O sistema calculara as datas de inicio e fim de cada etapa, trabalhando de tras para a frente a partir da data de entrega.
          </p>
        </div>
      )
    },
    {
      title: 'Grafico de Gantt / Timeline',
      icon: BarChart3,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      content: (
        <div>
          <p>O <strong>grafico de Gantt</strong> mostra visualmente a distribuicao das etapas ao longo do tempo:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Cada barra colorida representa uma etapa</li>
            <li>A posicao horizontal indica quando comeca e termina</li>
            <li>A linha <span className="text-red-600 font-medium">vermelha</span> indica o dia de hoje</li>
            <li>Os numeros nas barras mostram a duracao em dias</li>
          </ul>
          <p className="mt-3 text-slate-500 text-sm">
            O Gantt e atualizado automaticamente quando guarda o planeamento.
          </p>
        </div>
      )
    },
    {
      title: 'Status das Etapas',
      icon: CalendarDays,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      content: (
        <div>
          <p>Cada etapa pode ter um dos seguintes estados:</p>
          <div className="mt-2 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">Nao iniciado</span>
              <span className="text-sm">- Aguarda inicio</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Dentro do prazo</span>
              <span className="text-sm">- Em progresso, sem atrasos</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Em risco</span>
              <span className="text-sm">- Pode atrasar</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Atrasado</span>
              <span className="text-sm">- Passou do prazo</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Concluido</span>
              <span className="text-sm">- Etapa finalizada</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <MainLayout 
      title="Planeamento"
      actions={<HelpTutorial title="Como usar o Planeamento" sections={tutorialSections} />}
    >
      <div data-testid="planning-page" className="space-y-6">
        {/* Project Selection with Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {/* Tabs Header */}
          <div className="border-b border-slate-200">
            <div className="flex items-center justify-between px-4">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('por_planear')}
                  data-testid="tab-por-planear"
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'por_planear'
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Por Planear
                  <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                    {projectsPorPlanear.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('planeado')}
                  data-testid="tab-planeado"
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'planeado'
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Planeado
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    {projectsPlaneados.length}
                  </span>
                </button>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  data-testid="view-mode-grid"
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  data-testid="view-mode-list"
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Search */}
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                data-testid="project-search"
                placeholder="Pesquisar por OF, modelo ou marca..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Projects Display */}
          <div className="p-4">
            {loading ? (
              <div className="py-12 text-center text-slate-400">A carregar...</div>
            ) : displayedProjects.length > 0 ? (
              viewMode === 'grid' ? (
                <div className={`grid gap-3 max-h-[400px] overflow-y-auto ${
                  displayedProjects.length === 1 
                    ? 'grid-cols-1 max-w-md' 
                    : displayedProjects.length <= 3 
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }`}>
                  {displayedProjects.map(project => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-slate-600 font-medium border-b border-slate-200">
                        <th className="h-10 px-4 text-left">OF</th>
                        <th className="h-10 px-4 text-left">Marca</th>
                        <th className="h-10 px-4 text-right">Quantidade</th>
                        <th className="h-10 px-4 text-left">Comercial</th>
                        <th className="h-10 px-4 text-left">Etapa</th>
                        <th className="h-10 px-4 text-left">Entrega</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProjects.map(project => (
                        <ProjectListRow key={project.id} project={project} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum projeto {activeTab === 'por_planear' ? 'por planear' : 'planeado'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Planning Tool */}
        {selectedProject && (
          <>
            {/* Key Dates & Calculation */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Planeamento: {selectedProject.of_numero}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {selectedProject.modelo} • {getBrandName(selectedProject.marca_id)} • {selectedProject.quantidade?.toLocaleString()} pecas
                  </p>
                </div>
                <button
                  data-testid="save-planning-btn"
                  onClick={savePlanning}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'A guardar...' : 'Guardar Planeamento'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Data de Entrega Final *
                  </label>
                  <input
                    type="date"
                    data-testid="data-entrega"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Data Entrega Confecao
                  </label>
                  <input
                    type="date"
                    data-testid="data-confecao"
                    value={dataConfecao}
                    onChange={(e) => setDataConfecao(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    data-testid="calculate-btn"
                    onClick={calculateDates}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular Datas
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
                      onChange={(e) => updateStageDays(stage.key, e.target.value)}
                      className="w-12 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Planning Table */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-medium text-slate-900">Datas por Etapa</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <th className="h-10 px-4 text-left w-40">Etapa</th>
                      <th className="h-10 px-4 text-left">Inicio Previsto</th>
                      <th className="h-10 px-4 text-left">Fim Previsto</th>
                      <th className="h-10 px-4 text-left">Inicio Real</th>
                      <th className="h-10 px-4 text-left">Fim Real</th>
                      <th className="h-10 px-4 text-left w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planning.map((stage, idx) => {
                      const status = getStatusInfo(stage.status_calculado);
                      const StatusIcon = status.icon;
                      return (
                        <tr key={stage.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: stage.cor }}
                              />
                              <span className="font-medium text-slate-900">{stage.nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              data-testid={`inicio-previsto-${stage.key}`}
                              value={stage.data_inicio_prevista?.split('T')[0] || ''}
                              onChange={(e) => updateStageDate(stage.key, 'data_inicio_prevista', e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              data-testid={`fim-previsto-${stage.key}`}
                              value={stage.data_fim_prevista?.split('T')[0] || ''}
                              onChange={(e) => updateStageDate(stage.key, 'data_fim_prevista', e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              data-testid={`inicio-real-${stage.key}`}
                              value={stage.data_inicio_real?.split('T')[0] || ''}
                              onChange={(e) => updateStageDate(stage.key, 'data_inicio_real', e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              data-testid={`fim-real-${stage.key}`}
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
            </div>

            {/* Gantt Chart */}
            {ganttData && ganttData.totalDays > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-lg font-medium text-slate-900">Timeline / Gantt</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDate(ganttData.minDate)} — {formatDate(ganttData.maxDate)} ({ganttData.totalDays} dias)
                  </p>
                </div>
                
                <div className="p-6">
                  <div className="relative">
                    {/* Timeline header */}
                    <div className="flex justify-between text-xs text-slate-400 mb-2 px-32">
                      <span>{formatDate(ganttData.minDate)}</span>
                      <span>{formatDate(ganttData.maxDate)}</span>
                    </div>
                    
                    {/* Gantt bars */}
                    <div className="space-y-3">
                      {ganttData.stages.map(stage => (
                        <div key={stage.key} className="flex items-center">
                          <div className="w-28 flex-shrink-0">
                            <span className="text-sm font-medium text-slate-700">{stage.nome}</span>
                          </div>
                          <div className="flex-1 h-8 bg-slate-100 rounded relative">
                            {stage.width > 0 && (
                              <div
                                data-testid={`gantt-bar-${stage.key}`}
                                className="absolute h-full rounded flex items-center justify-center text-white text-xs font-medium shadow-sm transition-all"
                                style={{
                                  left: `${stage.left}%`,
                                  width: `${Math.max(stage.width, 3)}%`,
                                  backgroundColor: stage.cor,
                                  minWidth: '40px'
                                }}
                              >
                                {stage.dias_previstos || diasPorEtapa[stage.key] || ''}d
                              </div>
                            )}
                            {/* Today marker */}
                            {(() => {
                              const today = new Date();
                              if (today >= ganttData.minDate && today <= ganttData.maxDate) {
                                const todayPos = ((today - ganttData.minDate) / (ganttData.maxDate - ganttData.minDate)) * 100;
                                return (
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                                    style={{ left: `${todayPos}%` }}
                                    title="Hoje"
                                  />
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center space-x-1 text-xs text-slate-500">
                        <div className="w-3 h-0.5 bg-red-500" />
                        <span>Hoje</span>
                      </div>
                      {planning.slice(0, 4).map(stage => (
                        <div key={stage.key} className="flex items-center space-x-1 text-xs text-slate-500">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: stage.cor }} />
                          <span>{stage.nome}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!selectedProject && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Selecione um projeto para iniciar o planeamento</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Planning;
