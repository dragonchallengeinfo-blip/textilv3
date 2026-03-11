import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const Stages = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    ordem: 1,
    cor_identificacao: '#64748B',
    descricao: '',
    ativa: true,
    permite_parceiro: true
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      const response = await api.get('/stages/');
      setStages(response.data);
    } catch (error) {
      console.error('Failed to fetch stages:', error);
      toast.error('Erro ao carregar etapas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/stages/${editingId}`, formData);
        toast.success('Etapa atualizada com sucesso');
      } else {
        await api.post('/stages', formData);
        toast.success('Etapa criada com sucesso');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ nome: '', ordem: 1, cor_identificacao: '#64748B', descricao: '', ativa: true, permite_parceiro: true });
      fetchStages();
    } catch (error) {
      console.error('Failed to save stage:', error);
      toast.error('Erro ao guardar etapa');
    }
  };

  const handleEdit = (stage) => {
    setFormData({
      nome: stage.nome,
      ordem: stage.ordem,
      cor_identificacao: stage.cor_identificacao,
      descricao: stage.descricao || '',
      ativa: stage.ativa,
      permite_parceiro: stage.permite_parceiro
    });
    setEditingId(stage.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta etapa?')) return;
    try {
      await api.delete(`/stages/${id}`);
      toast.success('Etapa eliminada com sucesso');
      fetchStages();
    } catch (error) {
      console.error('Failed to delete stage:', error);
      toast.error('Erro ao eliminar etapa');
    }
  };

  const actions = (
    <button
      onClick={() => {
        setShowForm(true);
        setEditingId(null);
        setFormData({ nome: '', ordem: stages.length + 1, cor_identificacao: '#64748B', descricao: '', ativa: true, permite_parceiro: true });
      }}
      data-testid="create-stage-button"
      className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
    >
      <Plus className="w-4 h-4" />
      <span>Nova Etapa</span>
    </button>
  );

  if (loading) {
    return (
      <MainLayout title="Etapas" actions={actions}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Etapas" actions={actions}>
      <div data-testid="stages-page" className="space-y-6">
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-slate-900 mb-4">
              {editingId ? 'Editar Etapa' : 'Nova Etapa'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    data-testid="stage-name-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ordem *</label>
                  <input
                    type="number"
                    value={formData.ordem}
                    onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) })}
                    required
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cor</label>
                  <input
                    type="color"
                    value={formData.cor_identificacao}
                    onChange={(e) => setFormData({ ...formData, cor_identificacao: e.target.value })}
                    className="h-9 w-20 rounded-md border border-slate-200 cursor-pointer"
                  />
                </div>
                <div className="flex items-center space-x-4 pt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.ativa}
                      onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900"
                    />
                    <span className="text-sm text-slate-700">Ativa</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permite_parceiro}
                      onChange={(e) => setFormData({ ...formData, permite_parceiro: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900"
                    />
                    <span className="text-sm text-slate-700">Permite Parceiro</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  data-testid="save-stage-button"
                  className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
                >
                  {editingId ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <th className="h-10 px-4 text-left">Ordem</th>
                <th className="h-10 px-4 text-left">Nome</th>
                <th className="h-10 px-4 text-left">Cor</th>
                <th className="h-10 px-4 text-left">Status</th>
                <th className="h-10 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs">{stage.ordem}</td>
                  <td className="px-4 py-3 font-medium">{stage.nome}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded border border-slate-200"
                        style={{ backgroundColor: stage.cor_identificacao }}
                      />
                      <span className="text-xs font-mono text-slate-500">{stage.cor_identificacao}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${stage.ativa ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {stage.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(stage)}
                        data-testid={`edit-stage-${stage.id}`}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(stage.id)}
                        data-testid={`delete-stage-${stage.id}`}
                        className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Stages;
