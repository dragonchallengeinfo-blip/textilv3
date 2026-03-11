import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Zap, HelpCircle, X, ChevronDown, ChevronRight, 
  AlertTriangle, CheckCircle2, ArrowRight, Play, Pause,
  Bell, Lock, Unlock, Forward, Edit, Trash2, Plus, Save
} from 'lucide-react';

const Rules = () => {
  const [rules, setRules] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [expandedRule, setExpandedRule] = useState(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    ativo: true,
    tipo: 'checkpoint',
    condicao: {
      campo: '',
      operador: 'igual',
      valor: ''
    },
    acao: {
      tipo: 'criar_alerta',
      prioridade: 'media',
      mensagem: '',
      status: ''
    },
    ordem: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, checkpointsRes, stagesRes] = await Promise.all([
        api.get('/rules/'),
        api.get('/checkpoints/'),
        api.get('/stages/')
      ]);
      setRules(rulesRes.data);
      setCheckpoints(checkpointsRes.data);
      setStages(stagesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      ativo: true,
      tipo: 'checkpoint',
      condicao: {
        campo: '',
        operador: 'igual',
        valor: ''
      },
      acao: {
        tipo: 'criar_alerta',
        prioridade: 'media',
        mensagem: '',
        status: ''
      },
      ordem: rules.length + 1
    });
    setEditingRule(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setFormData({
      nome: rule.nome || '',
      descricao: rule.descricao || '',
      ativo: rule.ativo ?? true,
      tipo: rule.tipo || 'checkpoint',
      condicao: {
        campo: rule.condicao?.campo || '',
        operador: rule.condicao?.operador || 'igual',
        valor: Array.isArray(rule.condicao?.valor) ? rule.condicao.valor.join(', ') : (rule.condicao?.valor || '')
      },
      acao: {
        tipo: rule.acao?.tipo || 'criar_alerta',
        prioridade: rule.acao?.prioridade || 'media',
        mensagem: rule.acao?.mensagem || '',
        status: rule.acao?.status || ''
      },
      ordem: rule.ordem || 1
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        condicao: {
          ...formData.condicao,
          valor: formData.condicao.valor.includes(',') 
            ? formData.condicao.valor.split(',').map(v => v.trim())
            : formData.condicao.valor
        }
      };

      if (editingRule) {
        await api.put(`/rules/${editingRule.id}`, payload);
        toast.success('Regra atualizada com sucesso');
      } else {
        await api.post('/rules/', payload);
        toast.success('Regra criada com sucesso');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save rule:', error);
      toast.error('Erro ao guardar regra');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta regra?')) return;

    try {
      await api.delete(`/rules/${ruleId}`);
      toast.success('Regra eliminada');
      fetchData();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Erro ao eliminar regra');
    }
  };

  const toggleRuleStatus = async (rule) => {
    try {
      await api.put(`/rules/${rule.id}`, { ativo: !rule.ativo });
      toast.success(rule.ativo ? 'Regra desativada' : 'Regra ativada');
      fetchData();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      toast.error('Erro ao alterar estado');
    }
  };

  const getConditionBadgeColor = (operador) => {
    const colors = {
      'igual': 'bg-blue-100 text-blue-700 border-blue-200',
      'diferente': 'bg-purple-100 text-purple-700 border-purple-200',
      'maior_que': 'bg-green-100 text-green-700 border-green-200',
      'menor_que': 'bg-red-100 text-red-700 border-red-200',
      'em': 'bg-amber-100 text-amber-700 border-amber-200',
      'contagem_maior': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return colors[operador] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatAction = (acao) => {
    if (!acao) return { label: '-', icon: Zap, color: 'text-slate-600' };
    
    const tipos = {
      'criar_alerta': { label: 'Criar Alerta', icon: Bell, color: 'text-amber-600' },
      'mudar_status': { label: 'Mudar Status', icon: Lock, color: 'text-blue-600' },
      'avancar_etapa': { label: 'Avançar Etapa', icon: Forward, color: 'text-green-600' },
      'bloquear': { label: 'Bloquear', icon: Lock, color: 'text-red-600' },
      'desbloquear': { label: 'Desbloquear', icon: Unlock, color: 'text-green-600' }
    };
    
    return tipos[acao.tipo] || { label: acao.tipo, icon: Zap, color: 'text-slate-600' };
  };

  // Available fields for conditions
  const conditionFields = [
    ...checkpoints.map(cp => cp.nome),
    'Status do Projeto',
    'Etapa Atual',
    'Progresso (%)',
    'Atraso (dias)',
    'Qualidade',
    'Taxa de Aprovação'
  ];

  const operadores = [
    { value: 'igual', label: 'Igual a (=)' },
    { value: 'diferente', label: 'Diferente de (≠)' },
    { value: 'maior_que', label: 'Maior que (>)' },
    { value: 'menor_que', label: 'Menor que (<)' },
    { value: 'contem', label: 'Contém' },
    { value: 'em', label: 'Está em lista' }
  ];

  const acaoTipos = [
    { value: 'criar_alerta', label: 'Criar Alerta' },
    { value: 'mudar_status', label: 'Mudar Status do Projeto' },
    { value: 'avancar_etapa', label: 'Avançar para Próxima Etapa' },
    { value: 'bloquear', label: 'Bloquear Projeto' },
    { value: 'desbloquear', label: 'Desbloquear Projeto' }
  ];

  const actions = (
    <button
      onClick={openCreateModal}
      data-testid="create-rule-button"
      className="bg-amber-500 text-white hover:bg-amber-600 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
    >
      <Plus className="w-4 h-4" />
      <span>Nova Regra</span>
    </button>
  );

  return (
    <MainLayout title="Motor de Regras" actions={actions}>
      <div data-testid="rules-page" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Motor de Regras</h2>
              <p className="text-sm text-slate-500">Automações SE → ENTÃO</p>
            </div>
          </div>
          <button
            onClick={() => setShowTutorial(true)}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center space-x-2"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Ajuda</span>
          </button>
        </div>

        {/* Tutorial Modal */}
        {showTutorial && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Como funcionam as Regras</h3>
                <button onClick={() => setShowTutorial(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl">
                  <div className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold">SE</div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                  <div className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold">ENTÃO</div>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Condições (SE)</h4>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>• <strong>=</strong> igual a um valor</li>
                    <li>• <strong>≠</strong> diferente de</li>
                    <li>• <strong>&gt;</strong> maior que</li>
                    <li>• <strong>&lt;</strong> menor que</li>
                    <li>• <strong>contém</strong> valor está na lista</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Ações (ENTÃO)</h4>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>• <Bell className="w-4 h-4 inline text-amber-500" /> Criar alerta</li>
                    <li>• <Lock className="w-4 h-4 inline text-blue-500" /> Mudar status do projeto</li>
                    <li>• <Forward className="w-4 h-4 inline text-green-500" /> Avançar etapa</li>
                    <li>• <Lock className="w-4 h-4 inline text-red-500" /> Bloquear projeto</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingRule ? 'Editar Regra' : 'Nova Regra'}
                </h3>
                <button 
                  onClick={() => { setShowModal(false); resetForm(); }} 
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome da Regra *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="Ex: Alerta de Qualidade Baixa"
                      data-testid="rule-name-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="Descrição breve da regra"
                    />
                  </div>
                </div>

                {/* Condition Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-bold">SE</span>
                    <span className="text-sm font-medium text-blue-900">Condição</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">Campo</label>
                      <select
                        value={formData.condicao.campo}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          condicao: { ...formData.condicao, campo: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        data-testid="condition-field-select"
                      >
                        <option value="">Selecionar campo...</option>
                        <optgroup label="Checkpoints">
                          {checkpoints.map(cp => (
                            <option key={cp.id} value={cp.nome}>{cp.nome}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Campos do Projeto">
                          <option value="Status do Projeto">Status do Projeto</option>
                          <option value="Etapa Atual">Etapa Atual</option>
                          <option value="Progresso (%)">Progresso (%)</option>
                          <option value="Atraso (dias)">Atraso (dias)</option>
                          <option value="Qualidade do Corte">Qualidade do Corte</option>
                          <option value="Taxa de Aprovação (%)">Taxa de Aprovação (%)</option>
                          <option value="Desperdício (%)">Desperdício (%)</option>
                        </optgroup>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">Operador</label>
                      <select
                        value={formData.condicao.operador}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          condicao: { ...formData.condicao, operador: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        data-testid="condition-operator-select"
                      >
                        {operadores.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">Valor</label>
                      <input
                        type="text"
                        value={formData.condicao.valor}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          condicao: { ...formData.condicao, valor: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Indisponível, 90, Sim"
                        data-testid="condition-value-input"
                      />
                      <p className="text-xs text-blue-600 mt-1">Use vírgula para múltiplos valores</p>
                    </div>
                  </div>
                </div>

                {/* Action Section */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-bold">ENTÃO</span>
                    <span className="text-sm font-medium text-green-900">Ação</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-800 mb-1">Tipo de Ação</label>
                      <select
                        value={formData.acao.tipo}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          acao: { ...formData.acao, tipo: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500"
                        data-testid="action-type-select"
                      >
                        {acaoTipos.map(tipo => (
                          <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {formData.acao.tipo === 'criar_alerta' && (
                      <div>
                        <label className="block text-sm font-medium text-green-800 mb-1">Prioridade</label>
                        <select
                          value={formData.acao.prioridade}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            acao: { ...formData.acao, prioridade: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500"
                        >
                          <option value="baixa">Baixa</option>
                          <option value="media">Média</option>
                          <option value="alta">Alta</option>
                        </select>
                      </div>
                    )}
                    
                    {formData.acao.tipo === 'mudar_status' && (
                      <div>
                        <label className="block text-sm font-medium text-green-800 mb-1">Novo Status</label>
                        <select
                          value={formData.acao.status}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            acao: { ...formData.acao, status: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Selecionar...</option>
                          <option value="ativo">Ativo</option>
                          <option value="bloqueado">Bloqueado</option>
                          <option value="atrasado">Atrasado</option>
                          <option value="concluido">Concluído</option>
                        </select>
                      </div>
                    )}
                  </div>
                  
                  {(formData.acao.tipo === 'criar_alerta' || formData.acao.tipo === 'bloquear') && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-green-800 mb-1">Mensagem</label>
                      <textarea
                        value={formData.acao.mensagem}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          acao: { ...formData.acao, mensagem: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        rows="2"
                        placeholder="Mensagem do alerta ou motivo do bloqueio"
                        data-testid="action-message-input"
                      />
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">Regra ativa</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formData.nome || !formData.condicao.campo}
                    data-testid="save-rule-button"
                    className="flex items-center space-x-2 px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'A guardar...' : 'Guardar Regra'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              A carregar regras...
            </div>
          ) : rules.length > 0 ? (
            rules.map((rule) => {
              const isExpanded = expandedRule === rule.id;
              const actionInfo = formatAction(rule.acao);
              const ActionIcon = actionInfo.icon;
              
              return (
                <div 
                  key={rule.id}
                  data-testid={`rule-item-${rule.id}`}
                  className={`bg-white border rounded-xl overflow-hidden transition-all ${
                    rule.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'
                  }`}
                >
                  {/* Rule Header */}
                  <div 
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        rule.ativo ? 'bg-amber-100' : 'bg-slate-100'
                      }`}>
                        <Zap className={`w-4 h-4 ${rule.ativo ? 'text-amber-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{rule.nome}</h3>
                        <p className="text-xs text-slate-500">{rule.descricao}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Quick view of condition and action */}
                      <div className="hidden md:flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded border ${getConditionBadgeColor(rule.condicao?.operador)}`}>
                          {rule.condicao?.campo?.substring(0, 20) || 'Condição'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className={`px-2 py-1 text-xs rounded bg-slate-100 ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </div>
                      
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rule.ativo 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {rule.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                      
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                  
                  {/* Rule Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Condition */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold">SE</span>
                            <span className="text-sm font-medium text-blue-900">Condição</span>
                          </div>
                          {rule.condicao ? (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="text-blue-700 font-medium">Campo:</span>
                                <span className="text-blue-900">{rule.condicao.campo}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="text-blue-700 font-medium">Operador:</span>
                                <span className={`px-2 py-0.5 rounded border ${getConditionBadgeColor(rule.condicao.operador)}`}>
                                  {rule.condicao.operador}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="text-blue-700 font-medium">Valor:</span>
                                <span className="text-blue-900 font-mono bg-white px-2 py-0.5 rounded">
                                  {Array.isArray(rule.condicao.valor) 
                                    ? rule.condicao.valor.join(', ') 
                                    : String(rule.condicao.valor)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-blue-600">Sem condição definida</p>
                          )}
                        </div>
                        
                        {/* Action */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold">ENTÃO</span>
                            <span className="text-sm font-medium text-green-900">Ação</span>
                          </div>
                          {rule.acao ? (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 text-sm">
                                <ActionIcon className={`w-4 h-4 ${actionInfo.color}`} />
                                <span className="text-green-900 font-medium">{actionInfo.label}</span>
                              </div>
                              {rule.acao.prioridade && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <span className="text-green-700">Prioridade:</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    rule.acao.prioridade === 'alta' ? 'bg-red-100 text-red-700' :
                                    rule.acao.prioridade === 'media' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>{rule.acao.prioridade}</span>
                                </div>
                              )}
                              {rule.acao.mensagem && (
                                <div className="text-sm mt-2">
                                  <span className="text-green-700">Mensagem:</span>
                                  <p className="text-green-900 bg-white p-2 rounded mt-1 text-xs">
                                    "{rule.acao.mensagem}"
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-green-600">Sem ação definida</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Rule Actions */}
                      <div className="flex items-center justify-end space-x-2 mt-4 pt-3 border-t border-slate-200">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRuleStatus(rule); }}
                          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            rule.ativo
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {rule.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          <span>{rule.ativo ? 'Desativar' : 'Ativar'}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(rule); }}
                          data-testid={`edit-rule-${rule.id}`}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }}
                          data-testid={`delete-rule-${rule.id}`}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Zap className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma regra configurada</p>
              <button
                onClick={openCreateModal}
                className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                Criar Primeira Regra
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{rules.length}</p>
            <p className="text-sm text-slate-500">Total de Regras</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{rules.filter(r => r.ativo).length}</p>
            <p className="text-sm text-green-600">Ativas</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-400">{rules.filter(r => !r.ativo).length}</p>
            <p className="text-sm text-slate-500">Inativas</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Rules;
