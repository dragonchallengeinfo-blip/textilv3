import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { Filter, Download } from 'lucide-react';
import { formatDate, getStatusColor, getStatusLabel } from '@/utils/helpers';
import { toast } from 'sonner';

const Production = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    etapa_id: '',
    atrasado: false,
    bloqueado: false
  });
  const [stages, setStages] = useState([]);

  useEffect(() => {
    fetchStages();
    fetchProduction();
  }, []);

  const fetchStages = async () => {
    try {
      const response = await api.get('/stages/');
      setStages(response.data);
    } catch (error) {
      console.error('Failed to fetch stages:', error);
    }
  };

  const fetchProduction = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.etapa_id) params.etapa_id = filters.etapa_id;
      if (filters.atrasado) params.atrasado = true;
      if (filters.bloqueado) params.bloqueado = true;

      const response = await api.get('/production/', { params });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch production:', error);
      toast.error('Erro ao carregar produção');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduction();
  }, [filters]);

  const getCurrentStageName = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.nome || '-';
  };

  const getCurrentStageColor = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.cor_identificacao || '#64748B';
  };

  if (loading) {
    return (
      <MainLayout title="Produção">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Produção">
      <div data-testid="production-page" className="space-y-6">
        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                data-testid="filter-status"
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              >
                <option value="">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="atrasado">Atrasado</option>
                <option value="bloqueado">Bloqueado</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Etapa</label>
              <select
                value={filters.etapa_id}
                onChange={(e) => setFilters({ ...filters, etapa_id: e.target.value })}
                data-testid="filter-stage"
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              >
                <option value="">Todas</option>
                {stages.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.atrasado}
                  onChange={(e) => setFilters({ ...filters, atrasado: e.target.checked })}
                  data-testid="filter-delayed"
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                <span className="text-sm text-slate-700">Apenas Atrasados</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.bloqueado}
                  onChange={(e) => setFilters({ ...filters, bloqueado: e.target.checked })}
                  data-testid="filter-blocked"
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                <span className="text-sm text-slate-700">Apenas Bloqueados</span>
              </label>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <th className="h-10 px-4 text-left">OF</th>
                  <th className="h-10 px-4 text-left">Modelo</th>
                  <th className="h-10 px-4 text-left">Qtd</th>
                  <th className="h-10 px-4 text-left">Etapa Atual</th>
                  <th className="h-10 px-4 text-left">Status</th>
                  <th className="h-10 px-4 text-left">Progresso</th>
                  <th className="h-10 px-4 text-left">Data Entrega</th>
                </tr>
              </thead>
              <tbody>
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors h-12">
                      <td className="px-4 align-middle font-mono text-xs">{project.of_numero}</td>
                      <td className="px-4 align-middle">{project.modelo}</td>
                      <td className="px-4 align-middle">{project.quantidade}</td>
                      <td className="px-4 align-middle">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getCurrentStageColor(project.etapa_atual_id) }}
                          />
                          <span className="text-xs">{getCurrentStageName(project.etapa_atual_id)}</span>
                        </div>
                      </td>
                      <td className="px-4 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusColor(project.status_projeto)}`}>
                          {getStatusLabel(project.status_projeto)}
                        </span>
                      </td>
                      <td className="px-4 align-middle">
                        <div className="flex items-center space-x-2 max-w-[120px]">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-slate-900 h-full transition-all"
                              style={{ width: `${project.progresso_percentagem}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600 font-mono">
                            {project.progresso_percentagem}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 align-middle font-mono text-xs">
                        {formatDate(project.data_prevista_entrega)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                      Nenhum projeto encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Total: {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}
        </div>
      </div>
    </MainLayout>
  );
};

export default Production;
