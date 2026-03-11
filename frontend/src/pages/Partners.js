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
    // Novos campos para perfis simplificados
    tempo_processamento_medio: '', // Em horas
    capacidade_pecas_dia: '',
    prazo_entrega_padrao: '', // Em dias
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
      tempo_processamento_medio: '',
      capacidade_pecas_dia: '',
      prazo_entrega_padrao: '',
      ativo: true
    });
  };

  // Calculate capacity based on workers, efficiency AND occupancy rate
  const capacityCalculation = useMemo(() => {
    const workers = parseInt(formData.num_trabalhadores) || 0;
    const efficiency = parseFloat(formData.eficiencia) || 100;
    const occupancy = parseFloat(formData.taxa_ocupacao) || 100; // Taxa de ocupação dedicada
    const hoursPerDay = 8;
    const daysPerMonth = 22;
    
    // Capacidade total (sem ocupação)
    const totalCapacityPerDay = workers * hoursPerDay * (efficiency / 100);
    const totalCapacityPerMonth = workers * hoursPerDay * daysPerMonth * (efficiency / 100);
    
    // Capacidade disponível (com ocupação)
    const availableCapacityPerDay = totalCapacityPerDay * (occupancy / 100);
    const availableCapacityPerMonth = totalCapacityPerMonth * (occupancy / 100);
    
    return {
      workers,
      efficiency,
      occupancy,
      hoursPerDay,
      daysPerMonth,
      totalCapacityPerDay: Math.round(totalCapacityPerDay),
      totalCapacityPerMonth: Math.round(totalCapacityPerMonth),
      availableCapacityPerDay: Math.round(availableCapacityPerDay),
      availableCapacityPerMonth: Math.round(availableCapacityPerMonth)
    };
  }, [formData.num_trabalhadores, formData.eficiencia, formData.taxa_ocupacao]);
  
  // Check if type needs capacity profile (confeccao only)
  const needsCapacityProfile = formData.tipo_servico === 'confeccao';
  
  // Check if type needs simplified profile (lavandaria, acabamento, estampagem, bordado)
  const needsSimplifiedProfile = ['lavandaria', 'acabamento', 'estampagem', 'bordado'].includes(formData.tipo_servico);

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
        taxa_qualidade: formData.taxa_qualidade ? parseFloat(formData.taxa_qualidade) : null,
        tempo_processamento_medio: formData.tempo_processamento_medio ? parseFloat(formData.tempo_processamento_medio) : null,
        capacidade_pecas_dia: formData.capacidade_pecas_dia ? parseInt(formData.capacidade_pecas_dia) : null,
        prazo_entrega_padrao: formData.prazo_entrega_padrao ? parseInt(formData.prazo_entrega_padrao) : null,
        // Calcular capacidade disponível se for confecção
        capacidade_horas_mes: needsCapacityProfile ? capacityCalculation.availableCapacityPerMonth : null
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
      tempo_processamento_medio: partner.tempo_processamento_medio || '',
      capacidade_pecas_dia: partner.capacidade_pecas_dia || '',
      prazo_entrega_padrao: partner.prazo_entrega_padrao || '',
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
                {needsCapacityProfile && (
                  <>
                    <div className="col-span-2 pt-4 border-t border-slate-200">
                      <div className="flex items-center space-x-2">
                        <Calculator className="w-5 h-5 text-blue-600" />
                        <h4 className="text-sm font-semibold text-slate-900">Perfil de Capacidade (Confecção)</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Configure a capacidade produtiva deste parceiro de confecção</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">N.º Trabalhadores</label>
                      <input
                        type="number"
                        value={formData.num_trabalhadores}
                        onChange={(e) => setFormData({ ...formData, num_trabalhadores: e.target.value })}
                        placeholder="Ex: 10"
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
                      <label className="block text-sm font-medium text-slate-700 mb-1">Eficiência (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.eficiencia}
                        onChange={(e) => setFormData({ ...formData, eficiencia: e.target.value })}
                        placeholder="Ex: 85"
                        data-testid="partner-efficiency-input"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Taxa de Ocupação (%)
                        <span className="text-xs text-slate-400 ml-1">% dedicada a si</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.taxa_ocupacao}
                        onChange={(e) => setFormData({ ...formData, taxa_ocupacao: e.target.value })}
                        placeholder="Ex: 50"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    
                    {/* Capacity Calculation Display - Melhorado */}
                    {capacityCalculation.workers > 0 && (
                      <div className="col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                        <div className="flex items-center space-x-2 mb-4">
                          <Calculator className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900">Cálculo de Capacidade</span>
                        </div>
                        
                        {/* Capacidade Total */}
                        <div className="mb-4 pb-4 border-b border-blue-200">
                          <p className="text-xs font-medium text-slate-600 mb-2">CAPACIDADE TOTAL (100% ocupação)</p>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs text-blue-600 mb-1">
                                {capacityCalculation.workers} trab. × {capacityCalculation.hoursPerDay}h × {capacityCalculation.efficiency}%
                              </p>
                              <p className="text-xl font-bold text-blue-600">
                                {capacityCalculation.totalCapacityPerDay}h/dia
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 mb-1">
                                × {capacityCalculation.daysPerMonth} dias úteis
                              </p>
                              <p className="text-xl font-bold text-blue-600">
                                {capacityCalculation.totalCapacityPerMonth}h/mês
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Capacidade Disponível */}
                        <div>
                          <p className="text-xs font-medium text-emerald-700 mb-2">
                            CAPACIDADE DISPONÍVEL PARA SI ({capacityCalculation.occupancy}% ocupação)
                          </p>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white rounded-lg p-3 border border-emerald-200">
                              <p className="text-xs text-emerald-600 mb-1">
                                {capacityCalculation.totalCapacityPerDay}h × {capacityCalculation.occupancy}%
                              </p>
                              <p className="text-2xl font-bold text-emerald-600">
                                {capacityCalculation.availableCapacityPerDay}h
                              </p>
                              <p className="text-xs text-emerald-500">por dia</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-emerald-200">
                              <p className="text-xs text-emerald-600 mb-1">
                                {capacityCalculation.totalCapacityPerMonth}h × {capacityCalculation.occupancy}%
                              </p>
                              <p className="text-2xl font-bold text-emerald-600">
                                {capacityCalculation.availableCapacityPerMonth}h
                              </p>
                              <p className="text-xs text-emerald-500">por mês</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade (Peças/Mês)</label>
                      <input
                        type="number"
                        value={formData.capacidade_pecas_mes}
                        onChange={(e) => setFormData({ ...formData, capacidade_pecas_mes: e.target.value })}
                        placeholder="Ex: 10000"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade (Projetos/Mês)</label>
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
                
                {/* Simplified Profile - Lavandaria, Acabamento, Estampagem, Bordado */}
                {needsSimplifiedProfile && (
                  <>
                    <div className="col-span-2 pt-4 border-t border-slate-200">
                      <div className="flex items-center space-x-2">
                        <Calculator className="w-5 h-5 text-amber-600" />
                        <h4 className="text-sm font-semibold text-slate-900">
                          Perfil de Serviço ({getPartnerTypeLabel(formData.tipo_servico)})
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Configure os tempos e capacidades para este serviço</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tempo Médio Processamento
                        <span className="text-xs text-slate-400 ml-1">(horas)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.tempo_processamento_medio}
                        onChange={(e) => setFormData({ ...formData, tempo_processamento_medio: e.target.value })}
                        placeholder="Ex: 24"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Capacidade Diária
                        <span className="text-xs text-slate-400 ml-1">(peças/dia)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.capacidade_pecas_dia}
                        onChange={(e) => setFormData({ ...formData, capacidade_pecas_dia: e.target.value })}
                        placeholder="Ex: 500"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Prazo Entrega Padrão
                        <span className="text-xs text-slate-400 ml-1">(dias)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.prazo_entrega_padrao}
                        onChange={(e) => setFormData({ ...formData, prazo_entrega_padrao: e.target.value })}
                        placeholder="Ex: 3"
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
                        placeholder="Ex: 98"
                        className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                      />
                    </div>
                    
                    {/* Info box for simplified profiles */}
                    {(formData.tempo_processamento_medio || formData.capacidade_pecas_dia) && (
                      <div className="col-span-2 bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <div className="flex items-start space-x-3">
                          <Calculator className="w-5 h-5 text-amber-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-900">Resumo do Serviço</p>
                            <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                              {formData.tempo_processamento_medio && (
                                <div>
                                  <p className="text-xs text-amber-600">Tempo médio</p>
                                  <p className="font-semibold text-amber-800">{formData.tempo_processamento_medio}h</p>
                                </div>
                              )}
                              {formData.capacidade_pecas_dia && (
                                <div>
                                  <p className="text-xs text-amber-600">Cap. diária</p>
                                  <p className="font-semibold text-amber-800">{formData.capacidade_pecas_dia} pç</p>
                                </div>
                              )}
                              {formData.prazo_entrega_padrao && (
                                <div>
                                  <p className="text-xs text-amber-600">Prazo</p>
                                  <p className="font-semibold text-amber-800">{formData.prazo_entrega_padrao} dias</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {/* Quality rate for "outro" type only */}
                {formData.tipo_servico === 'outro' && (
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
                <th className="h-10 px-4 text-center">Capacidade</th>
                <th className="h-10 px-4 text-center">Disponível</th>
                <th className="h-10 px-4 text-center">Qualidade</th>
                <th className="h-10 px-4 text-left">Status</th>
                <th className="h-10 px-4 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">A carregar...</td></tr>
              ) : partners.length > 0 ? (
                partners.map((partner) => {
                  // Calculate capacity for confecção
                  const isConfeccao = partner.tipo_servico === 'confeccao';
                  const workers = partner.num_trabalhadores || 0;
                  const efficiency = partner.eficiencia || 100;
                  const occupancy = partner.taxa_ocupacao || 100;
                  const totalCapMonth = Math.round(workers * 8 * 22 * (efficiency / 100));
                  const availableCapMonth = Math.round(totalCapMonth * (occupancy / 100));
                  
                  // For simplified profiles
                  const isSimplified = ['lavandaria', 'acabamento', 'estampagem', 'bordado'].includes(partner.tipo_servico);
                  
                  return (
                    <tr key={partner.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs">{partner.codigo || '-'}</td>
                      <td className="px-4 py-3 font-medium">{partner.nome}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          isConfeccao ? 'bg-blue-100 text-blue-700' : 
                          isSimplified ? 'bg-amber-100 text-amber-700' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {getPartnerTypeLabel(partner.tipo_servico)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isConfeccao && workers > 0 ? (
                          <div className="text-xs">
                            <span className="font-medium text-blue-600">{totalCapMonth}h</span>
                            <span className="text-slate-400">/mês</span>
                            <div className="text-slate-400">{workers} trab.</div>
                          </div>
                        ) : isSimplified && partner.capacidade_pecas_dia ? (
                          <div className="text-xs">
                            <span className="font-medium text-amber-600">{partner.capacidade_pecas_dia}</span>
                            <span className="text-slate-400"> pç/dia</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isConfeccao && workers > 0 ? (
                          <div className="text-xs">
                            <span className="font-semibold text-emerald-600">{availableCapMonth}h</span>
                            <div className="text-slate-400">{occupancy}% ocup.</div>
                          </div>
                        ) : isSimplified && partner.prazo_entrega_padrao ? (
                          <div className="text-xs">
                            <span className="font-medium text-amber-600">{partner.prazo_entrega_padrao}d</span>
                            <span className="text-slate-400"> prazo</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {partner.taxa_qualidade ? (
                          <span className={`font-medium ${partner.taxa_qualidade >= 95 ? 'text-emerald-600' : partner.taxa_qualidade >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                            {partner.taxa_qualidade}%
                          </span>
                        ) : '-'}
                      </td>
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
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">Nenhum parceiro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Partners;
