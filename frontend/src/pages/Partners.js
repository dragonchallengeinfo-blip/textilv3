import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { Plus, Edit, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { getPartnerTypeLabel } from '@/utils/helpers';

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    tipo_servico: 'confeccao',
    email: '',
    telefone: '',
    morada: '',
    num_trabalhadores: '',
    capacidade_pecas_mes: '',
    capacidade_projetos_mes: '',
    taxa_ocupacao: '',
    eficiencia: '',
    taxa_qualidade: '',
    ativo: true
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const response = await api.get('/partners/');
      setPartners(response.data);
    } catch (error) {
      console.error('Failed to fetch partners:', error);
      toast.error('Erro ao carregar parceiros');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      codigo: '',
      tipo_servico: 'confeccao',
      email: '',
      telefone: '',
      morada: '',
      num_trabalhadores: '',
      capacidade_pecas_mes: '',
      capacidade_projetos_mes: '',
      taxa_ocupacao: '',
      eficiencia: '',
      taxa_qualidade: '',
      ativo: true
    });
  };

  // Calculate capacity based on workers and efficiency
  const capacityCalculation = useMemo(() => {
    const workers = parseInt(formData.num_trabalhadores) || 0;
    const efficiency = parseFloat(formData.eficiencia) || 100;
    const hoursPerDay = 8;
    const daysPerMonth = 22;
    
    const capacityPerDay = workers * hoursPerDay * (efficiency / 100);
    const capacityPerMonth = workers * hoursPerDay * daysPerMonth * (efficiency / 100);
    
    return {
      workers,
      efficiency,
      hoursPerDay,
      daysPerMonth,
      capacityPerDay: Math.round(capacityPerDay),
      capacityPerMonth: Math.round(capacityPerMonth)
    };
  }, [formData.num_trabalhadores, formData.eficiencia]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        num_trabalhadores: formData.num_trabalhadores ? parseInt(formData.num_trabalhadores) : null,
        capacidade_pecas_mes: formData.capacidade_pecas_mes ? parseInt(formData.capacidade_pecas_mes) : null,
        capacidade_projetos_mes: formData.capacidade_projetos_mes ? parseInt(formData.capacidade_projetos_mes) : null,
        taxa_ocupacao: formData.taxa_ocupacao ? parseFloat(formData.taxa_ocupacao) : null,
        eficiencia: formData.eficiencia ? parseFloat(formData.eficiencia) : null,
        taxa_qualidade: formData.taxa_qualidade ? parseFloat(formData.taxa_qualidade) : null
      };

      if (editingId) {
        await api.put(`/partners/${editingId}`, payload);
        toast.success('Parceiro atualizado com sucesso');
      } else {
        await api.post('/partners/', payload);
        toast.success('Parceiro criado com sucesso');
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchPartners();
    } catch (error) {
      console.error('Failed to save partner:', error);
      toast.error('Erro ao guardar parceiro');
    }
  };

  const handleEdit = (partner) => {
    setFormData({
      nome: partner.nome,
      codigo: partner.codigo || '',
      tipo_servico: partner.tipo_servico,
      email: partner.email || '',
      telefone: partner.telefone || '',
      morada: partner.morada || '',
      num_trabalhadores: partner.num_trabalhadores || '',
      capacidade_pecas_mes: partner.capacidade_pecas_mes || '',
      capacidade_projetos_mes: partner.capacidade_projetos_mes || '',
      taxa_ocupacao: partner.taxa_ocupacao || '',
      eficiencia: partner.eficiencia || '',
      taxa_qualidade: partner.taxa_qualidade || '',
      ativo: partner.ativo
    });
    setEditingId(partner.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja eliminar este parceiro?')) return;
    try {
      await api.delete(`/partners/${id}`);
      toast.success('Parceiro eliminado com sucesso');
      fetchPartners();
    } catch (error) {
      console.error('Failed to delete partner:', error);
      toast.error('Erro ao eliminar parceiro');
    }
  };

  const actions = (
    <button
      onClick={() => {
        resetForm();
        setEditingId(null);
        setShowForm(true);
      }}
      data-testid="create-partner-button"
      className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
    >
      <Plus className="w-4 h-4" />
      <span>Novo Parceiro</span>
    </button>
  );

  return (
    <MainLayout title="Parceiros" actions={actions}>
      <div data-testid="partners-page" className="space-y-6">
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-slate-900 mb-4">
              {editingId ? 'Editar Parceiro' : 'Novo Parceiro'}
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
                    data-testid="partner-name-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Codigo</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Servico *</label>
                  <select
                    value={formData.tipo_servico}
                    onChange={(e) => setFormData({ ...formData, tipo_servico: e.target.value })}
                    required
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="confeccao">Confecao</option>
                    <option value="lavandaria">Lavandaria</option>
                    <option value="acabamento">Acabamento</option>
                    <option value="estampagem">Estampagem</option>
                    <option value="bordado">Bordado</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Morada</label>
                  <input
                    type="text"
                    value={formData.morada}
                    onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                
                {/* Capacity Section - Only for confection */}
                {formData.tipo_servico === 'confeccao' && (
                  <>
                    <div className="col-span-2 pt-4 border-t border-slate-200">
                      <div className="flex items-center space-x-2">
                        <Calculator className="w-5 h-5 text-blue-600" />
                        <h4 className="text-sm font-semibold text-slate-900">Perfil de Capacidade</h4>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">N.º Trabalhadores</label>
                      <input
                        type="number"
                        value={formData.num_trabalhadores}
                        onChange={(e) => setFormData({ ...formData, num_trabalhadores: e.target.value })}
                        placeholder="Ex: 5"
                        data-testid="partner-workers-input"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Taxa de Qualidade (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.taxa_qualidade}
                        onChange={(e) => setFormData({ ...formData, taxa_qualidade: e.target.value })}
                        placeholder="Ex: 100"
                        data-testid="partner-quality-input"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Eficiencia (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.eficiencia}
                        onChange={(e) => setFormData({ ...formData, eficiencia: e.target.value })}
                        placeholder="Ex: 100"
                        data-testid="partner-efficiency-input"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Taxa de Ocupacao (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.taxa_ocupacao}
                        onChange={(e) => setFormData({ ...formData, taxa_ocupacao: e.target.value })}
                        placeholder="% dedicada a si"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    
                    {/* Capacity Calculation Display */}
                    {capacityCalculation.workers > 0 && (
                      <div className="col-span-2 bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <Calculator className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Capacidade dia / mes</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          {/* Daily Capacity */}
                          <div>
                            <p className="text-sm text-blue-700 mb-1">
                              = {capacityCalculation.workers} × {capacityCalculation.hoursPerDay} × {capacityCalculation.efficiency}%
                            </p>
                            <p className="text-2xl font-bold text-blue-600">
                              = {capacityCalculation.capacityPerDay}h
                            </p>
                            <p className="text-xs text-blue-500 mt-1">
                              {capacityCalculation.hoursPerDay} = Horas do dia
                            </p>
                          </div>
                          
                          {/* Monthly Capacity */}
                          <div>
                            <p className="text-sm text-blue-700 mb-1">
                              = {capacityCalculation.workers} × {capacityCalculation.hoursPerDay} × {capacityCalculation.daysPerMonth} × {capacityCalculation.efficiency}%
                            </p>
                            <p className="text-2xl font-bold text-blue-600">
                              = {capacityCalculation.capacityPerMonth}h
                            </p>
                            <p className="text-xs text-blue-500 mt-1">
                              {capacityCalculation.daysPerMonth} = Dias do mes
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade (Pecas/Mes)</label>
                      <input
                        type="number"
                        value={formData.capacidade_pecas_mes}
                        onChange={(e) => setFormData({ ...formData, capacidade_pecas_mes: e.target.value })}
                        placeholder="Ex: 10000"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade (Projetos/Mes)</label>
                      <input
                        type="number"
                        value={formData.capacidade_projetos_mes}
                        onChange={(e) => setFormData({ ...formData, capacidade_projetos_mes: e.target.value })}
                        placeholder="Ex: 15"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                  </>
                )}
                
                {/* Quality rate for non-confeccao types */}
                {formData.tipo_servico !== 'confeccao' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Taxa de Qualidade (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.taxa_qualidade}
                      onChange={(e) => setFormData({ ...formData, taxa_qualidade: e.target.value })}
                      placeholder="0-100"
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                    />
                  </div>
                )}
                
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
              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  data-testid="save-partner-button"
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
                <th className="h-10 px-4 text-left">Codigo</th>
                <th className="h-10 px-4 text-left">Nome</th>
                <th className="h-10 px-4 text-left">Tipo</th>
                <th className="h-10 px-4 text-center">Trabalhadores</th>
                <th className="h-10 px-4 text-center">Cap. Horas/Mes</th>
                <th className="h-10 px-4 text-center">Taxa Ocup.</th>
                <th className="h-10 px-4 text-center">Eficiencia</th>
                <th className="h-10 px-4 text-left">Status</th>
                <th className="h-10 px-4 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-400">A carregar...</td></tr>
              ) : partners.length > 0 ? (
                partners.map((partner) => {
                  // Calculate capacity for display
                  const workers = partner.num_trabalhadores || 0;
                  const efficiency = partner.eficiencia || 100;
                  const capMonth = Math.round(workers * 8 * 22 * (efficiency / 100));
                  
                  return (
                    <tr key={partner.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs">{partner.codigo || '-'}</td>
                      <td className="px-4 py-3 font-medium">{partner.nome}</td>
                      <td className="px-4 py-3">{getPartnerTypeLabel(partner.tipo_servico)}</td>
                      <td className="px-4 py-3 text-center text-xs">{partner.num_trabalhadores || '-'}</td>
                      <td className="px-4 py-3 text-center text-xs font-medium text-blue-600">
                        {partner.tipo_servico === 'confeccao' && workers > 0 ? `${capMonth}h` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{partner.taxa_ocupacao ? `${partner.taxa_ocupacao}%` : '-'}</td>
                      <td className="px-4 py-3 text-center text-xs">{partner.eficiencia ? `${partner.eficiencia}%` : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${partner.ativo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {partner.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(partner)}
                            data-testid={`edit-partner-${partner.id}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(partner.id)}
                            data-testid={`delete-partner-${partner.id}`}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-400">Nenhum parceiro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Partners;
