import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ClipboardList, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Download,
  Factory,
  ArrowRight,
  RefreshCw,
  Filter,
  Calendar,
  Package,
  Save,
  X,
  Check,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { formatDate, getStatusColor, getStatusLabel } from '@/utils/helpers';
import { toast } from 'sonner';

const OperatorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [confeccoes, setConfeccoes] = useState([]);
  const [selectedConfeccao, setSelectedConfeccao] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv'); // csv or pdf
  const [view, setView] = useState('dashboard'); // dashboard, confeccao
  
  // Inline checkpoint editing
  const [editingCheckpoint, setEditingCheckpoint] = useState(null);
  const [checkpointValue, setCheckpointValue] = useState('');
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null);
  const [projectCheckpoints, setProjectCheckpoints] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  // Filter projects based on selected confeccao
  const filteredProjects = useMemo(() => {
    if (!dashboard?.projects) return [];
    if (!selectedConfeccao) return dashboard.projects;
    
    return dashboard.projects.filter(project => {
      // Find the confeccao name
      const confeccao = confeccoes.find(c => c.id === selectedConfeccao);
      return project.confeccao === confeccao?.nome;
    });
  }, [dashboard?.projects, selectedConfeccao, confeccoes]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    if (!selectedConfeccao || !dashboard?.projects) {
      return dashboard?.stats || { total_ativos: 0, total_atrasados: 0, urgentes: 0, checkpoints_pendentes: 0 };
    }
    
    const projects = filteredProjects;
    return {
      total_ativos: projects.filter(p => p.status === 'ativo').length,
      total_atrasados: projects.filter(p => p.status === 'atrasado').length,
      urgentes: projects.filter(p => (p.dias_restantes ?? 999) <= 3).length,
      checkpoints_pendentes: dashboard?.stats?.checkpoints_pendentes || 0
    };
  }, [filteredProjects, selectedConfeccao, dashboard]);

  const fetchData = async () => {
    try {
      const [dashboardRes, partnersRes] = await Promise.all([
        api.get('/operator/dashboard'),
        api.get('/partners/')
      ]);
      setDashboard(dashboardRes.data);
      // Filter only confeccoes
      const confeccoesList = partnersRes.data.filter(p => p.tipo_servico === 'confeccao' && p.ativo);
      setConfeccoes(confeccoesList);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (confeccaoId = null, format = 'csv') => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (confeccaoId) {
        params.append('confeccao_id', confeccaoId);
      }
      params.append('format', format);
      
      const response = await api.get(`/export/projects?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Get filename from header or generate one
      const contentDisposition = response.headers['content-disposition'];
      const confeccao = confeccoes.find(c => c.id === confeccaoId);
      const confeccaoName = confeccao ? confeccao.nome.replace(/\s+/g, '_') : 'todos';
      const timestamp = new Date().toISOString().slice(0,10);
      let filename = `projetos_${confeccaoName}_${timestamp}.${format}`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      // Download file
      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Exportação ${format.toUpperCase()} concluída!`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  const getDaysStyle = (days) => {
    if (days === null || days === undefined) return 'text-slate-400';
    if (days < 0) return 'text-red-600 font-bold';
    if (days <= 3) return 'text-red-500 font-semibold';
    if (days <= 7) return 'text-amber-600';
    return 'text-slate-600';
  };

  const getDaysText = (days) => {
    if (days === null || days === undefined) return '-';
    if (days < 0) return `${Math.abs(days)}d atrasado`;
    if (days === 0) return 'Hoje!';
    return `${days}d`;
  };

  // Fetch checkpoints for a project
  const fetchProjectCheckpoints = async (projectId) => {
    try {
      const response = await api.get(`/checkpoints/project/${projectId}/responses`);
      setProjectCheckpoints(prev => ({ ...prev, [projectId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch checkpoints:', error);
    }
  };

  // Toggle project expansion
  const toggleProjectExpansion = async (projectId) => {
    if (expandedProject === projectId) {
      setExpandedProject(null);
    } else {
      setExpandedProject(projectId);
      if (!projectCheckpoints[projectId]) {
        await fetchProjectCheckpoints(projectId);
      }
    }
  };

  // Save checkpoint value
  const saveCheckpointValue = async (checkpointId, projectId) => {
    setSavingCheckpoint(true);
    try {
      await api.post(`/checkpoints/${checkpointId}/respond`, {
        projeto_id: projectId,
        valor: checkpointValue
      });
      toast.success('Checkpoint guardado');
      setEditingCheckpoint(null);
      setCheckpointValue('');
      
      // Refresh data
      fetchData();
      fetchProjectCheckpoints(projectId);
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
      toast.error('Erro ao guardar checkpoint');
    } finally {
      setSavingCheckpoint(false);
    }
  };

  // Start editing checkpoint
  const startEditingCheckpoint = (checkpoint, currentValue = '') => {
    setEditingCheckpoint(checkpoint);
    setCheckpointValue(currentValue || '');
  };

  if (loading) {
    return (
      <MainLayout title="Confeções">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  const actions = (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => fetchData()}
        className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors flex items-center space-x-1"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Atualizar</span>
      </button>
    </div>
  );

  return (
    <MainLayout title="Confeções" actions={actions}>
      <div data-testid="operator-dashboard" className="space-y-6">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Projetos Ativos</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{filteredStats.total_ativos}</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Atrasados</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{filteredStats.total_atrasados}</p>
              </div>
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Urgentes (≤3 dias)</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{filteredStats.urgentes}</p>
              </div>
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Checkpoints Pendentes</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{filteredStats.checkpoints_pendentes}</p>
              </div>
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-5 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Download className="w-5 h-5" />
                Exportar Projetos
              </h3>
              <p className="text-slate-300 text-sm mt-1">
                Exporte a lista de projetos por confecção ou todos os projetos
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                value={selectedConfeccao}
                onChange={(e) => setSelectedConfeccao(e.target.value)}
                data-testid="export-confeccao-select"
                className="h-10 rounded-md border-0 bg-white/10 px-3 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-white/50"
              >
                <option value="" className="text-slate-900">Todas as confecções</option>
                {confeccoes.map(conf => (
                  <option key={conf.id} value={conf.id} className="text-slate-900">
                    {conf.nome}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport(selectedConfeccao || null, 'csv')}
                  disabled={exporting}
                  data-testid="export-csv-button"
                  className="h-10 px-4 rounded-md bg-white text-slate-800 font-medium text-sm hover:bg-slate-100 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {exporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>CSV</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleExport(selectedConfeccao || null, 'pdf')}
                  disabled={exporting}
                  data-testid="export-pdf-button"
                  className="h-10 px-4 rounded-md bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {exporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          {selectedConfeccao && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-sm text-slate-300">
                A mostrar <span className="text-white font-medium">{filteredProjects.length}</span> projetos de{' '}
                <span className="text-white font-medium">{confeccoes.find(c => c.id === selectedConfeccao)?.nome}</span>
              </p>
            </div>
          )}
        </div>

        {/* Projects Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Projetos Ativos
              {selectedConfeccao && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({confeccoes.find(c => c.id === selectedConfeccao)?.nome})
                </span>
              )}
            </h3>
            <Link 
              to="/projects" 
              className="text-xs text-blue-600 hover:underline flex items-center"
            >
              Ver todos <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <th className="h-10 px-4 text-left">OF</th>
                  <th className="h-10 px-4 text-left">Modelo</th>
                  <th className="h-10 px-4 text-right">Qtd</th>
                  <th className="h-10 px-4 text-left">Confecção</th>
                  <th className="h-10 px-4 text-left">Etapa</th>
                  <th className="h-10 px-4 text-center">Progresso</th>
                  <th className="h-10 px-4 text-center">Entrega</th>
                  <th className="h-10 px-4 text-center">Falta</th>
                  <th className="h-10 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((project) => (
                    <React.Fragment key={project.id}>
                      <tr 
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleProjectExpansion(project.id)}
                            className="flex items-center space-x-2"
                          >
                            {expandedProject === project.id ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="font-medium text-slate-900">{project.of_numero}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{project.modelo}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {project.quantidade?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{project.confeccao || '-'}</td>
                        <td className="px-4 py-3">
                          {project.etapa_atual && (
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{ 
                                backgroundColor: `${project.etapa_cor}20`,
                                color: project.etapa_cor 
                              }}
                            >
                              {project.etapa_atual}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  project.progresso >= 100 ? 'bg-green-500' :
                                  project.progresso >= 50 ? 'bg-blue-500' :
                                  'bg-slate-300'
                                }`}
                                style={{ width: `${Math.min(project.progresso, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-8">
                              {Math.round(project.progresso)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-slate-600">
                            {formatDate(project.data_prevista_entrega)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-center ${getDaysStyle(project.dias_restantes)}`}>
                          <div className="flex items-center justify-center space-x-1">
                            {project.dias_restantes !== null && project.dias_restantes <= 3 && (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            <span>{getDaysText(project.dias_restantes)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${getStatusColor(project.status)}`}>
                            {getStatusLabel(project.status)}
                          </span>
                        </td>
                      </tr>
                      
                      {/* Expanded Checkpoints Row */}
                      {expandedProject === project.id && (
                        <tr className="bg-slate-50">
                          <td colSpan="9" className="px-4 py-4">
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-slate-900 flex items-center space-x-2">
                                  <ClipboardList className="w-4 h-4 text-purple-600" />
                                  <span>Checkpoints do Projeto</span>
                                </h4>
                                <button
                                  onClick={() => navigate(`/projects/${project.id}`)}
                                  className="text-xs text-blue-600 hover:underline flex items-center"
                                >
                                  Ver ficha completa <ArrowRight className="w-3 h-3 ml-1" />
                                </button>
                              </div>
                              
                              {projectCheckpoints[project.id]?.length > 0 ? (
                                <div className="grid gap-2">
                                  {projectCheckpoints[project.id].map((cp, idx) => (
                                    <div 
                                      key={idx}
                                      className={`flex items-center justify-between p-3 rounded-lg border ${
                                        cp.valor ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-3">
                                        {cp.valor ? (
                                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        ) : (
                                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                                        )}
                                        <div>
                                          <p className="text-sm font-medium text-slate-900">{cp.checkpoint_nome}</p>
                                          <p className="text-xs text-slate-500">
                                            {cp.obrigatorio && <span className="text-red-500 mr-2">Obrigatório</span>}
                                            Tipo: {cp.tipo_resposta}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        {editingCheckpoint?.checkpoint_id === cp.checkpoint_id && editingCheckpoint?.projeto_id === project.id ? (
                                          <>
                                            {cp.tipo_resposta === 'checkbox' ? (
                                              <select
                                                value={checkpointValue}
                                                onChange={(e) => setCheckpointValue(e.target.value)}
                                                className="h-8 px-2 border border-slate-300 rounded text-sm"
                                              >
                                                <option value="">Selecionar...</option>
                                                <option value="Sim">Sim</option>
                                                <option value="Não">Não</option>
                                              </select>
                                            ) : cp.tipo_resposta === 'data' || cp.tipo_resposta === 'date' ? (
                                              <input
                                                type="date"
                                                value={checkpointValue}
                                                onChange={(e) => setCheckpointValue(e.target.value)}
                                                className="h-8 px-2 border border-slate-300 rounded text-sm"
                                              />
                                            ) : cp.tipo_resposta === 'numero' || cp.tipo_resposta === 'number' ? (
                                              <input
                                                type="number"
                                                value={checkpointValue}
                                                onChange={(e) => setCheckpointValue(e.target.value)}
                                                className="h-8 px-2 border border-slate-300 rounded text-sm w-24"
                                                placeholder="Valor"
                                              />
                                            ) : (
                                              <input
                                                type="text"
                                                value={checkpointValue}
                                                onChange={(e) => setCheckpointValue(e.target.value)}
                                                className="h-8 px-2 border border-slate-300 rounded text-sm w-40"
                                                placeholder="Introduza o valor"
                                              />
                                            )}
                                            <button
                                              onClick={() => saveCheckpointValue(cp.checkpoint_id, project.id)}
                                              disabled={savingCheckpoint || !checkpointValue}
                                              className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                            >
                                              {savingCheckpoint ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <Check className="w-4 h-4" />
                                              )}
                                            </button>
                                            <button
                                              onClick={() => { setEditingCheckpoint(null); setCheckpointValue(''); }}
                                              className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <span className={`text-sm font-medium ${cp.valor ? 'text-green-700' : 'text-amber-700'}`}>
                                              {cp.valor || 'Pendente'}
                                            </span>
                                            <button
                                              onClick={() => startEditingCheckpoint({ checkpoint_id: cp.checkpoint_id, projeto_id: project.id }, cp.valor)}
                                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                              <Edit3 className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400 text-center py-4">
                                  Sem checkpoints para este projeto
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      Nenhum projeto ativo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Checkpoints */}
        {dashboard?.pending_checkpoints?.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center space-x-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-semibold text-slate-900">Checkpoints Pendentes</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {dashboard.pending_checkpoints.slice(0, 10).map((cp, idx) => (
                <Link 
                  key={idx}
                  to={`/projects/${cp.projeto_id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {cp.projeto_of}
                    </span>
                    <span className="text-sm text-slate-700">{cp.checkpoint_nome}</span>
                    {cp.obrigatorio && (
                      <span className="text-xs text-red-500 font-medium">Obrigatório</span>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Confeccoes Quick Access */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center space-x-2">
            <Factory className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-semibold text-slate-900">Confeções</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {confeccoes.map(conf => (
              <button
                key={conf.id}
                onClick={() => {
                  setSelectedConfeccao(conf.id);
                  handleExport(conf.id);
                }}
                data-testid={`export-confeccao-${conf.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left group"
              >
                <span className="text-sm font-medium text-slate-700 group-hover:text-green-700">
                  {conf.nome}
                </span>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-green-600" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default OperatorDashboard;
