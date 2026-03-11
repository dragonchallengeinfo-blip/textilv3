import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { Bell, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/utils/helpers';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      const params = {};
      if (filter === 'unread') params.visto = false;
      if (filter === 'unsolved') params.resolvido = false;

      const response = await api.get('/alerts/', { params });
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast.error('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  };

  const markAsSeen = async (id) => {
    try {
      await api.put(`/alerts/${id}/mark-seen`);
      toast.success('Alerta marcado como visto');
      fetchAlerts();
    } catch (error) {
      console.error('Failed to mark as seen:', error);
      toast.error('Erro ao atualizar alerta');
    }
  };

  const markAsResolved = async (id) => {
    try {
      await api.put(`/alerts/${id}/mark-resolved`);
      toast.success('Alerta resolvido');
      fetchAlerts();
    } catch (error) {
      console.error('Failed to resolve:', error);
      toast.error('Erro ao resolver alerta');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'alta': 'bg-red-50 text-red-700 border-red-200',
      'media': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'baixa': 'bg-blue-50 text-blue-700 border-blue-200'
    };
    return colors[priority] || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <MainLayout title="Alertas">
      <div data-testid="alerts-page" className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'unread' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Não Vistos
            </button>
            <button
              onClick={() => setFilter('unsolved')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'unsolved' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Por Resolver
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400">
              A carregar...
            </div>
          ) : alerts.length > 0 ? (
            alerts.map((alert) => (
              <div key={alert.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Bell className={`w-4 h-4 ${alert.visto ? 'text-slate-400' : 'text-slate-900'}`} />
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getPriorityColor(alert.prioridade)}`}>
                        {alert.prioridade}
                      </span>
                      <span className="text-xs text-slate-500">{alert.tipo}</span>
                    </div>
                    <p className={`text-sm mt-2 ${alert.visto ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                      {alert.mensagem}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">{formatDateTime(alert.criado_em)}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {!alert.visto && (
                      <button
                        onClick={() => markAsSeen(alert.id)}
                        className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 hover:bg-slate-100 rounded"
                      >
                        Marcar visto
                      </button>
                    )}
                    {!alert.resolvido && (
                      <button
                        onClick={() => markAsResolved(alert.id)}
                        className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 hover:bg-green-50 rounded"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Resolver</span>
                      </button>
                    )}
                    {alert.resolvido && (
                      <span className="text-xs text-green-600 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Resolvido</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400">
              Nenhum alerta encontrado
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Alerts;
