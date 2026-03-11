import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Users,
  Package,
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Building2,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { formatDate } from '@/utils/helpers';

const Capacity = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('partners');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, forecastRes] = await Promise.all([
        api.get('/capacity/dashboard'),
        api.get('/capacity/projects-forecast')
      ]);
      setDashboardData(dashRes.data);
      setForecastData(forecastRes.data);
    } catch (error) {
      console.error('Failed to fetch capacity data:', error);
      toast.error('Erro ao carregar dados de capacidade');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, color) => {
    const labels = {
      'sobrecarregado': 'Sobrecarregado',
      'quase_cheio': 'Quase Cheio',
      'moderado': 'Moderado',
      'disponivel': 'Disponível'
    };
    return (
      <span 
        className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {labels[status] || status}
      </span>
    );
  };

  const getHealthBadge = (health) => {
    const config = {
      'critical': { bg: 'bg-red-100', text: 'text-red-700', label: 'Crítico' },
      'warning': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Atenção' },
      'good': { bg: 'bg-green-100', text: 'text-green-700', label: 'OK' }
    };
    const c = config[health] || config['good'];
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  if (loading) {
    return (
      <MainLayout title="Gestão de Capacidade">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Gestão de Capacidade">
      <div data-testid="capacity-page" className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Parceiros Ativos</p>
                <p className="text-2xl font-bold text-slate-900">{dashboardData?.summary?.total_partners || 0}</p>
              </div>
              <Building2 className="w-10 h-10 text-slate-300" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Carga Total (Peças)</p>
                <p className="text-2xl font-bold text-slate-900">
                  {dashboardData?.summary?.total_workload_pieces?.toLocaleString() || 0}
                  <span className="text-sm text-slate-400 ml-1">
                    / {dashboardData?.summary?.total_capacity_pieces?.toLocaleString() || 0}
                  </span>
                </p>
              </div>
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(dashboardData?.summary?.overall_utilization || 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{dashboardData?.summary?.overall_utilization || 0}% utilização</p>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Projetos Ativos</p>
                <p className="text-2xl font-bold text-slate-900">{forecastData?.summary?.total || 0}</p>
              </div>
              <FolderKanban className="w-10 h-10 text-slate-300" />
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Alertas</p>
                <p className="text-2xl font-bold text-red-600">{dashboardData?.alerts?.length || 0}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-300" />
            </div>
          </div>
        </div>

        {/* Alerts */}
        {dashboardData?.alerts?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Alertas de Capacidade
            </h3>
            <div className="space-y-2">
              {dashboardData.alerts.map((alert, idx) => (
                <div key={idx} className="flex items-center text-sm text-red-700">
                  <span className={`w-2 h-2 rounded-full mr-2 ${alert.prioridade === 'alta' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  {alert.mensagem}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('partners')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'partners' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Capacidade por Parceiro
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'forecast' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Radiografia de Projetos
          </button>
        </div>

        {/* Partners Capacity Table */}
        {activeTab === 'partners' && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-medium text-slate-900">Capacidade por Confeção</h3>
              <button
                onClick={fetchData}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <th className="h-10 px-4 text-left">Parceiro</th>
                    <th className="h-10 px-4 text-center">Trabalhadores</th>
                    <th className="h-10 px-4 text-center">Eficiência</th>
                    <th className="h-10 px-4 text-center">Taxa Ocupação</th>
                    <th className="h-10 px-4 text-left">Capacidade</th>
                    <th className="h-10 px-4 text-left">Carga Atual</th>
                    <th className="h-10 px-4 text-center">Utilização</th>
                    <th className="h-10 px-4 text-center">Disponível</th>
                    <th className="h-10 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.partners?.map((pw) => (
                    <tr key={pw.partner.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{pw.partner.nome}</div>
                        {pw.partner.codigo && (
                          <div className="text-xs text-slate-400">{pw.partner.codigo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center">
                          <Users className="w-4 h-4 mr-1 text-slate-400" />
                          {pw.partner.num_trabalhadores || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pw.partner.eficiencia ? `${pw.partner.eficiencia}%` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pw.partner.taxa_ocupacao ? `${pw.partner.taxa_ocupacao}%` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <span className="text-slate-600">{pw.capacity.effective_pecas?.toLocaleString() || 0} pç</span>
                          <span className="text-slate-400 mx-1">•</span>
                          <span className="text-slate-600">{pw.capacity.effective_projetos || 0} proj</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <span className="font-medium text-slate-900">{pw.workload.total_pecas?.toLocaleString() || 0} pç</span>
                          <span className="text-slate-400 mx-1">•</span>
                          <span className="font-medium text-slate-900">{pw.workload.total_projetos || 0} proj</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24 mx-auto">
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ 
                                width: `${Math.min(pw.utilization.max_percent, 100)}%`,
                                backgroundColor: pw.status_color
                              }}
                            />
                          </div>
                          <div className="text-xs text-center mt-1 text-slate-600">
                            {pw.utilization.max_percent}%
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs text-green-600">
                          {pw.available.pecas?.toLocaleString() || 0} pç
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(pw.status, pw.status_color)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Projects Forecast */}
        {activeTab === 'forecast' && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-slate-900">Radiografia de Projetos</h3>
                <div className="flex space-x-4 mt-1 text-xs">
                  <span className="text-red-600">Críticos: {forecastData?.summary?.critical || 0}</span>
                  <span className="text-yellow-600">Atenção: {forecastData?.summary?.warning || 0}</span>
                  <span className="text-green-600">OK: {forecastData?.summary?.good || 0}</span>
                </div>
              </div>
              <button
                onClick={fetchData}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <th className="h-10 px-4 text-left">Projeto</th>
                    <th className="h-10 px-4 text-left">Parceiro</th>
                    <th className="h-10 px-4 text-center">Qtd</th>
                    <th className="h-10 px-4 text-left">Progresso</th>
                    <th className="h-10 px-4 text-center">Etapa Atual</th>
                    <th className="h-10 px-4 text-center">Entrega</th>
                    <th className="h-10 px-4 text-center">Atraso</th>
                    <th className="h-10 px-4 text-center">Problemas</th>
                    <th className="h-10 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData?.projects?.map((pf) => (
                    <tr key={pf.project.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-slate-900">{pf.project.of_numero}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[150px]">{pf.project.modelo}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {pf.project.parceiro || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pf.project.quantidade?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24">
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${pf.progress.percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-center mt-1 text-slate-500">
                            {pf.progress.completed_stages}/{pf.progress.total_stages} ({pf.progress.percent}%)
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">
                        {pf.progress.current_stage || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {formatDate(pf.project.data_prevista_entrega)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pf.issues.delay_days > 0 ? (
                          <span className="text-red-600 font-medium">+{pf.issues.delay_days}d</span>
                        ) : (
                          <span className="text-green-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pf.issues.is_paused && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded mr-1">Pausado</span>
                        )}
                        {pf.issues.active_problems > 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                            {pf.issues.active_problems} prob.
                          </span>
                        )}
                        {!pf.issues.is_paused && pf.issues.active_problems === 0 && '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getHealthBadge(pf.health)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Capacity;
