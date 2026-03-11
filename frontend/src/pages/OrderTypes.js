import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const OrderTypes = () => {
  const [orderTypes, setOrderTypes] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    ativo: true,
    ordem_padrao_etapas: []
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [orderTypesRes, stagesRes] = await Promise.all([
        api.get('/order-types/'),
        api.get('/stages/')
      ]);
      setOrderTypes(orderTypesRes.data);
      setStages(stagesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/order-types/${editingId}`, formData);
        toast.success('Tipo de ordem atualizado');
      } else {
        await api.post('/order-types/', formData);
        toast.success('Tipo de ordem criado');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ nome: '', descricao: '', ativo: true, ordem_padrao_etapas: [] });
      fetchData();
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Erro ao guardar');
    }
  };

  const handleEdit = (orderType) => {
    setFormData({
      nome: orderType.nome,
      descricao: orderType.descricao || '',
      ativo: orderType.ativo,
      ordem_padrao_etapas: orderType.ordem_padrao_etapas || []
    });
    setEditingId(orderType.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja eliminar?')) return;
    try {
      await api.delete(`/order-types/${id}`);
      toast.success('Tipo de ordem eliminado');
      fetchData();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Erro ao eliminar');
    }
  };

  const toggleStage = (stageId) => {
    setFormData(prev => ({
      ...prev,
      ordem_padrao_etapas: prev.ordem_padrao_etapas.includes(stageId)
        ? prev.ordem_padrao_etapas.filter(id => id !== stageId)
        : [...prev.ordem_padrao_etapas, stageId]
    }));
  };

  const actions = (
    <button
      onClick={() => {
        setShowForm(true);
        setEditingId(null);
        setFormData({ nome: '', descricao: '', ativo: true, ordem_padrao_etapas: [] });
      }}
      data-testid="create-order-type-button"
      className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
    >
      <Plus className="w-4 h-4" />
      <span>Novo Tipo</span>
    </button>
  );

  if (loading) {
    return (
      <MainLayout title="Tipos de Ordem" actions={actions}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">A carregar...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Tipos de Ordem" actions={actions}>
      <div data-testid="order-types-page" className="space-y-6">
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-slate-900 mb-4">
              {editingId ? 'Editar Tipo de Ordem' : 'Novo Tipo de Ordem'}
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
                    data-testid="order-type-name-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900"
                    />
                    <span className="text-sm text-slate-700">Ativo</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={2}
                  className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Etapas Padrão</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {stages.map(stage => (
                    <label key={stage.id} className="flex items-center space-x-2 cursor-pointer p-2 border border-slate-200 rounded hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={formData.ordem_padrao_etapas.includes(stage.id)}
                        onChange={() => toggleStage(stage.id)}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900"
                      />
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.cor_identificacao }} />
                        <span className="text-sm text-slate-700">{stage.nome}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  data-testid="save-order-type-button"
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
                <th className="h-10 px-4 text-left">Nome</th>
                <th className="h-10 px-4 text-left">Descrição</th>
                <th className="h-10 px-4 text-left">Etapas</th>
                <th className="h-10 px-4 text-left">Status</th>
                <th className="h-10 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orderTypes.length > 0 ? (
                orderTypes.map((orderType) => (
                  <tr key={orderType.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">{orderType.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{orderType.descricao || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {orderType.ordem_padrao_etapas?.length || 0} etapas
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${orderType.ativo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {orderType.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(orderType)}
                          data-testid={`edit-order-type-${orderType.id}`}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(orderType.id)}
                          data-testid={`delete-order-type-${orderType.id}`}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                    Nenhum tipo de ordem encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};

export default OrderTypes;
