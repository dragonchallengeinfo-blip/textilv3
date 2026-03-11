import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import SetupWizard from '@/components/SetupWizard';
import AIAssistant from '@/components/AIAssistant';
import { api } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardRealtime } from '@/hooks/useWebSocket';
import { 
  FolderKanban, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  Bell,
  PlusCircle,
  Users,
  ArrowRight,
  AlertTriangle,
  Calendar,
  Calculator,
  Factory,
  Wifi,
  WifiOff
} from 'lucide-react';
import { formatDate, getStatusColor, getStatusLabel } from '@/utils/helpers';

const Dashboard = () => {
  const { user, completeSetup } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get('/dashboard/');
      setDashboard(response.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== WEBSOCKET: Auto-refresh em tempo real ==========
  const { isConnected } = useDashboardRealtime(fetchDashboard);

  useEffect(() => {
    fetchDashboard();
    if (user && !user.setup_completed) {
      setShowWizard(true);
    }
  }, [user, fetchDashboard]);

  const handleWizardComplete = async () => {
    await completeSetup();
    setShowWizard(false);
  };

  const handleWizardSkip = async () => {
    await completeSetup();
    setShowWizard(false);
  };

  if (loading) {
    return (
      <MainLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  const kpis = [
    {
      label: 'Novos Projetos',
      subtitle: 'Últimos 7 dias',
      value: dashboard?.new_projects_count || 0,
      icon: PlusCircle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      link: '/projects'
    },
    {
      label: 'Alertas Ativos',
      subtitle: 'Por resolver',
      value: dashboard?.alerts_count || 0,
      icon: Bell,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      highlight: dashboard?.alerts_count > 0
    },
    {
      label: 'Projetos Atrasados',
      subtitle: 'Requerem atenção',
      value: dashboard?.delayed_projects || 0,
      icon: Clock,
      color: 'text-red-600',
      bg: 'bg-red-50',
      highlight: dashboard?.delayed_projects > 0
    },
    {
      label: 'Sem Confeção',
      subtitle: 'Por atribuir',
      value: dashboard?.projects_sem_confeccao_count || 0,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      highlight: dashboard?.projects_sem_confeccao_count > 0,
      link: '/confeccao-planning'
    }
  ];

  return (
    <MainLayout title="Dashboard" onShowWizard={() => setShowWizard(true)}>
      {showWizard && (
        <SetupWizard 
          onComplete={handleWizardComplete} 
          onSkip={handleWizardSkip} 
        />
      )}
      
      <div data-testid="dashboard-page" className="space-y-6">
        {/* Indicador de conexão em tempo real */}
        <div className="flex items-center justify-end gap-2 text-xs">
          {isConnected ? (
            <span className="flex items-center gap-1 text-emerald-600">
              <Wifi className="w-3 h-3" />
              <span>Tempo real ativo</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-400">
              <WifiOff className="w-3 h-3" />
              <span>A ligar...</span>
            </span>
          )}
          {lastUpdate && (
            <span className="text-slate-400">
              Atualizado: {lastUpdate.toLocaleTimeString('pt-PT')}
            </span>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            const content = (
              <div className={`bg-white border rounded-lg p-5 shadow-sm transition-all hover:shadow-md ${
                kpi.highlight ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {kpi.value}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{kpi.subtitle}</p>
                  </div>
                  <div className={`w-12 h-12 ${kpi.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${kpi.color}`} />
                  </div>
                </div>
              </div>
            );
            
            return kpi.link ? (
              <Link key={idx} to={kpi.link}>{content}</Link>
            ) : (
              <div key={idx}>{content}</div>
            );
          })}
        </div>

        {/* Alerts Section */}
        {dashboard?.recent_alerts?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-medium text-amber-900">Alertas Recentes</h3>
            </div>
            <div className="space-y-2">
              {dashboard.recent_alerts.slice(0, 3).map((alert, idx) => (
                <div key={idx} className="flex items-start space-x-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    alert.prioridade === 'alta' ? 'bg-red-100 text-red-700' :
                    alert.prioridade === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {alert.prioridade || 'info'}
                  </span>
                  <span className="text-amber-800">{alert.mensagem}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects Without Custo Peça Alert */}
        {dashboard?.projects_sem_custo_peca_count > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">
                  {dashboard.projects_sem_custo_peca_count} projeto(s) sem Custo/Peça definido
                </h3>
              </div>
              <span className="text-xs text-blue-600">Defina o tempo de produção na ficha do projeto</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {dashboard.projects_sem_custo_peca.slice(0, 5).map((p, idx) => (
                <Link 
                  key={idx} 
                  to={`/projects/${p.id}`}
                  className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {p.of_numero}
                </Link>
              ))}
              {dashboard.projects_sem_custo_peca_count > 5 && (
                <span className="px-3 py-1.5 text-sm text-blue-500">
                  +{dashboard.projects_sem_custo_peca_count - 5} mais
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Projects by Stage */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm h-full">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">Projetos por Etapa</h3>
              </div>
              <div className="p-5">
                {dashboard?.projects_by_stage?.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.projects_by_stage.map((stage, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-sm text-slate-700">{stage.stage_name}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {stage.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sem dados</p>
                )}
              </div>
            </div>
          </div>

          {/* Delayed Projects */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm h-full">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-red-500" />
                  <h3 className="text-base font-semibold text-slate-900">Projetos Atrasados</h3>
                </div>
                <Link to="/projects?status=atrasado" className="text-xs text-blue-600 hover:underline flex items-center">
                  Ver todos <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>
              <div className="p-3">
                {dashboard?.delayed_projects_list?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {dashboard.delayed_projects_list.slice(0, 5).map((project, idx) => (
                      <Link 
                        key={idx} 
                        to={`/projects/${project.id}`}
                        className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {project.of_numero}
                          </span>
                          <span className="text-sm text-slate-700">{project.modelo}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-slate-500">{project.quantidade} pcs</span>
                          <span className="text-xs text-red-600 font-medium">
                            {formatDate(project.data_prevista_entrega)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-6">Sem projetos atrasados</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Confecao Entries & Projects sem Confecao */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Confecao Entries */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Factory className="w-5 h-5 text-green-600" />
                <h3 className="text-base font-semibold text-slate-900">Entregas em Confeção</h3>
              </div>
              <span className="text-xs text-slate-500">Próximos 14 dias</span>
            </div>
            <div className="p-3">
              {dashboard?.confeccao_entries?.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {dashboard.confeccao_entries.map((entry, idx) => (
                    <Link 
                      key={idx}
                      to={`/projects/${entry.id}`}
                      className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {entry.of_numero}
                        </span>
                        <span className="text-sm text-slate-700">{entry.modelo}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-green-600 font-medium">
                          {formatDate(entry.data_entrada_confecao)}
                        </p>
                        <p className="text-xs text-slate-500">{entry.parceiro_nome}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">Sem entregas previstas</p>
              )}
            </div>
          </div>

          {/* Projects sem Confecao */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-semibold text-slate-900">Sem Confeção Atribuída</h3>
              </div>
              <Link to="/confeccao-planning" className="text-xs text-blue-600 hover:underline flex items-center">
                Planear <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
            <div className="p-3">
              {dashboard?.projects_sem_confeccao?.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {dashboard.projects_sem_confeccao.slice(0, 5).map((project, idx) => (
                    <Link 
                      key={idx}
                      to={`/projects/${project.id}`}
                      className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {project.of_numero}
                        </span>
                        <span className="text-sm text-slate-700">{project.modelo}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div 
                            className="bg-purple-500 h-1.5 rounded-full" 
                            style={{ width: `${project.progresso_percentagem || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatDate(project.data_prevista_entrega)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">Todos os projetos têm confeção atribuída</p>
              )}
            </div>
          </div>
        </div>

        {/* Deliveries This Week */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">Entregas desta Semana</h3>
          </div>
          <div className="overflow-x-auto">
            {dashboard?.deliveries_this_week?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <th className="h-10 px-4 text-left">OF</th>
                    <th className="h-10 px-4 text-left">Modelo</th>
                    <th className="h-10 px-4 text-left">Quantidade</th>
                    <th className="h-10 px-4 text-left">Data Entrega</th>
                    <th className="h-10 px-4 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.deliveries_this_week.map((project, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Link to={`/projects/${project.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                          {project.of_numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{project.modelo}</td>
                      <td className="px-4 py-3">{project.quantidade}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {formatDate(project.data_prevista_entrega)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusColor(project.status_projeto)}`}>
                          {getStatusLabel(project.status_projeto)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-sm text-slate-400">
                Sem entregas previstas esta semana
              </div>
            )}
          </div>
        </div>
      </div>
      
      <AIAssistant />
    </MainLayout>
  );
};

export default Dashboard;
