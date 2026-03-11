import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { Activity, TrendingUp, Trash2, Filter } from 'lucide-react';
import { formatDateTime } from '@/utils/helpers';

const RuleExecutionLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    projeto_id: '',
    rule_id: ''
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      const params = {};
      if (filters.projeto_id) params.projeto_id = filters.projeto_id;
      if (filters.rule_id) params.rule_id = filters.rule_id;

      const [logsRes, statsRes] = await Promise.all([
        api.get('/rule-engine/logs', { params }),
        api.get('/rule-engine/logs/stats')
      ]);
      
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Tem certeza que deseja limpar logs antigos (>30 dias)?')) return;
    
    try {
      const response = await api.delete('/rule-engine/logs?older_than_days=30');
      toast.success(`${response.data.deleted_count} logs eliminados`);
      fetchData();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast.error('Erro ao limpar logs');
    }
  };

  if (loading) {
    return (
      <MainLayout title="Logs de Execução de Regras">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Logs de Execução de Regras">
      <div data-testid="rule-logs-page" className="space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total de Execuções</p>
                  <p className="text-2xl font-semibold text-slate-900">{stats.total_executions}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Regras Mais Executadas</p>
                  <div className="mt-2 space-y-1">
                    {stats.top_rules.slice(0, 3).map((rule, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-medium text-slate-700">{rule.rule_name}</span>
                        {' '}
                        <span className="text-slate-500">({rule.execution_count}x)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Projeto ID</label>
              <input
                type="text"
                value={filters.projeto_id}
                onChange={(e) => setFilters({ ...filters, projeto_id: e.target.value })}
                placeholder="Filtrar por projeto..."
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Regra ID</label>
              <input
                type="text"
                value={filters.rule_id}
                onChange={(e) => setFilters({ ...filters, rule_id: e.target.value })}
                placeholder="Filtrar por regra..."
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleClearLogs}
                className="flex items-center space-x-2 text-sm text-red-600 hover:text-red-700 px-3 py-2 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar Logs Antigos</span>
              </button>
            </div>
          </div>
        </div>

        {/* Logs List */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <th className="h-10 px-4 text-left">Data/Hora</th>
                  <th className="h-10 px-4 text-left">Regra</th>
                  <th className="h-10 px-4 text-left">Projeto</th>
                  <th className="h-10 px-4 text-left">Ações Executadas</th>
                  <th className="h-10 px-4 text-left">Executado Por</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs">{formatDateTime(log.executed_at)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{log.rule_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{log.rule_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{log.projeto_id}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {log.actions_executed?.map((action, aidx) => (
                            <div key={aidx} className="text-xs text-slate-700">
                              <span className="font-medium">{action.action}</span>
                              {Object.keys(action.params || {}).length > 0 && (
                                <span className="text-slate-500 ml-1">
                                  ({Object.entries(action.params).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{log.executed_by}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                      Nenhum log de execução encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="text-xs text-slate-500 text-center">
            Mostrando {logs.length} registos
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default RuleExecutionLogs;
