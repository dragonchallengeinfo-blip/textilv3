import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { 
  Plus, Trash2, Edit, Play, Save, X, Copy, Zap, HelpCircle, Lightbulb,
  ArrowRight, AlertTriangle, CheckCircle, XCircle, Clock, Layers, Users,
  FileText, Target, ChevronRight, Info
} from 'lucide-react';
import { toast } from 'sonner';
import RuleSimulator from '@/components/rules/RuleSimulator';

const AdvancedRules = () => {
  const [rules, setRules] = useState([]);
  const [stages, setStages] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  
  const [ruleForm, setRuleForm] = useState({
    nome: '',
    descricao: '',
    etapa_id: '',
    checkpoint_id: '',
    ativo: true,
    prioridade: 1,
    condicoes: [],
    acoes: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, stagesRes, checkpointsRes] = await Promise.all([
        api.get('/rules/'),
        api.get('/stages/'),
        api.get('/checkpoints/')
      ]);
      setRules(rulesRes.data);
      setStages(stagesRes.data);
      setCheckpoints(checkpointsRes.data);
    } catch (error) {
      console.error('Failed to fetch:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const operatorOptions = [
    { value: 'igual', label: 'Igual a', icon: '=' },
    { value: 'diferente', label: 'Diferente de', icon: '≠' },
    { value: 'maior', label: 'Maior que', icon: '>' },
    { value: 'menor', label: 'Menor que', icon: '<' },
    { value: 'preenchido', label: 'Preenchido', icon: '✓' },
    { value: 'vazio', label: 'Vazio', icon: '∅' },
    { value: 'data_anterior', label: 'Data anterior a', icon: '📅<' },
    { value: 'data_posterior', label: 'Data posterior a', icon: '📅>' }
  ];

  const actionOptions = [
    { value: 'mudar_etapa', label: 'Mudar Etapa', params: ['etapa_id'], icon: Layers, desc: 'Move o projeto para outra etapa' },
    { value: 'mudar_status', label: 'Mudar Status', params: ['status'], icon: Target, desc: 'Altera o estado do projeto' },
    { value: 'bloquear_etapa', label: 'Bloquear Etapa', params: [], icon: XCircle, desc: 'Impede avanço até condição ser cumprida' },
    { value: 'desbloquear_etapa', label: 'Desbloquear Etapa', params: [], icon: CheckCircle, desc: 'Remove o bloqueio da etapa' },
    { value: 'criar_alerta', label: 'Criar Alerta', params: ['mensagem', 'prioridade'], icon: AlertTriangle, desc: 'Gera notificação para a equipa' },
    { value: 'atribuir_responsavel', label: 'Atribuir Responsável', params: ['user_id'], icon: Users, desc: 'Define quem é responsável' },
    { value: 'voltar_etapa', label: 'Voltar Etapa Anterior', params: [], icon: ArrowRight, desc: 'Retrocede no fluxo' },
    { value: 'concluir_projeto', label: 'Concluir Projeto', params: [], icon: CheckCircle, desc: 'Marca projeto como concluído' },
    { value: 'preencher_campo', label: 'Preencher Campo', params: ['campo', 'valor'], icon: FileText, desc: 'Preenche automaticamente um campo' },
    { value: 'tornar_obrigatorio', label: 'Tornar Campo Obrigatório', params: ['campo'], icon: AlertTriangle, desc: 'Torna um campo obrigatório' }
  ];

  const addCondition = () => {
    setRuleForm({
      ...ruleForm,
      condicoes: [
        ...ruleForm.condicoes,
        { campo: '', operador: 'igual', valor: '' }
      ]
    });
  };

  const updateCondition = (index, field, value) => {
    const newConditions = [...ruleForm.condicoes];
    newConditions[index][field] = value;
    setRuleForm({ ...ruleForm, condicoes: newConditions });
  };

  const removeCondition = (index) => {
    const newConditions = ruleForm.condicoes.filter((_, i) => i !== index);
    setRuleForm({ ...ruleForm, condicoes: newConditions });
  };

  const addAction = () => {
    setRuleForm({
      ...ruleForm,
      acoes: [
        ...ruleForm.acoes,
        { acao: 'mudar_etapa', parametros: {} }
      ]
    });
  };

  const updateAction = (index, field, value) => {
    const newActions = [...ruleForm.acoes];
    if (field === 'acao') {
      newActions[index] = { acao: value, parametros: {} };
    } else {
      newActions[index].parametros[field] = value;
    }
    setRuleForm({ ...ruleForm, acoes: newActions });
  };

  const removeAction = (index) => {
    const newActions = ruleForm.acoes.filter((_, i) => i !== index);
    setRuleForm({ ...ruleForm, acoes: newActions });
  };

  const handleSave = async () => {
    if (!ruleForm.nome) {
      toast.error('Nome da regra é obrigatório');
      return;
    }
    if (ruleForm.condicoes.length === 0) {
      toast.error('Adicione pelo menos uma condição');
      return;
    }
    if (ruleForm.acoes.length === 0) {
      toast.error('Adicione pelo menos uma ação');
      return;
    }

    try {
      if (editingRule) {
        await api.put(`/rules/${editingRule}`, ruleForm);
        toast.success('Regra atualizada com sucesso');
      } else {
        await api.post('/rules/', ruleForm);
        toast.success('Regra criada com sucesso');
      }
      setShowBuilder(false);
      setEditingRule(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save rule:', error);
      toast.error('Erro ao guardar regra');
    }
  };

  const resetForm = () => {
    setRuleForm({
      nome: '',
      descricao: '',
      etapa_id: '',
      checkpoint_id: '',
      ativo: true,
      prioridade: 1,
      condicoes: [],
      acoes: []
    });
  };

  const handleEdit = (rule) => {
    setRuleForm({
      nome: rule.nome,
      descricao: rule.descricao || '',
      etapa_id: rule.etapa_id || '',
      checkpoint_id: rule.checkpoint_id || '',
      ativo: rule.ativo,
      prioridade: rule.prioridade || 1,
      condicoes: rule.condicoes || [],
      acoes: rule.acoes || []
    });
    setEditingRule(rule.id);
    setShowBuilder(true);
  };

  const handleDuplicate = (rule) => {
    setRuleForm({
      nome: `${rule.nome} (cópia)`,
      descricao: rule.descricao || '',
      etapa_id: rule.etapa_id || '',
      checkpoint_id: rule.checkpoint_id || '',
      ativo: false,
      prioridade: rule.prioridade || 1,
      condicoes: rule.condicoes || [],
      acoes: rule.acoes || []
    });
    setEditingRule(null);
    setShowBuilder(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja eliminar esta regra?')) return;
    try {
      await api.delete(`/rules/${id}`);
      toast.success('Regra eliminada');
      fetchData();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Erro ao eliminar');
    }
  };

  const toggleActive = async (rule) => {
    try {
      await api.put(`/rules/${rule.id}`, { ativo: !rule.ativo });
      toast.success(rule.ativo ? 'Regra desativada' : 'Regra ativada');
      fetchData();
    } catch (error) {
      console.error('Failed to toggle:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const getActionLabel = (actionValue) => {
    return actionOptions.find(a => a.value === actionValue)?.label || actionValue;
  };

  const getActionParams = (actionValue) => {
    return actionOptions.find(a => a.value === actionValue)?.params || [];
  };

  const getStageName = (stageId) => {
    return stages.find(s => s.id === stageId)?.nome || '-';
  };

  const getCheckpointName = (checkpointId) => {
    return checkpoints.find(c => c.id === checkpointId)?.nome || '-';
  };

  const actions = (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => setShowTutorial(!showTutorial)}
        data-testid="toggle-tutorial"
        className={`h-9 px-3 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
          showTutorial 
            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
        }`}
      >
        <HelpCircle className="w-4 h-4" />
        <span>Ajuda</span>
      </button>
      <button
        onClick={() => setShowSimulator(true)}
        data-testid="open-simulator-button"
        className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
      >
        <Zap className="w-4 h-4" />
        <span>Simulador</span>
      </button>
      <button
        onClick={() => {
          resetForm();
          setEditingRule(null);
          setShowBuilder(true);
        }}
        data-testid="create-rule-button"
        className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Nova Regra</span>
      </button>
    </div>
  );

  return (
    <MainLayout title="Motor de Regras Avançado" actions={actions}>
      <div data-testid="advanced-rules-page" className="space-y-6">
        
        {/* Tutorial Section */}
        {showTutorial && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  O que é o Motor de Regras?
                </h3>
                <p className="text-slate-600 mb-4">
                  O Motor de Regras permite criar <strong>automações</strong> no sistema usando a lógica 
                  <strong> "SE condição ENTÃO ação"</strong>. Quando uma condição é cumprida, 
                  o sistema executa automaticamente a ação configurada.
                </p>
                
                {/* How it works */}
                <div className="bg-white rounded-lg p-4 border border-purple-100 mb-4">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                    <Info className="w-4 h-4 text-purple-600" />
                    <span>Como Funciona</span>
                  </h4>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                      <p className="font-semibold text-blue-700">SE</p>
                      <p className="text-blue-600 text-xs mt-1">Condição</p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400" />
                    <div className="flex-1 bg-green-50 rounded-lg p-3 text-center border border-green-200">
                      <p className="font-semibold text-green-700">ENTÃO</p>
                      <p className="text-green-600 text-xs mt-1">Ação</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Exemplo: <strong>SE</strong> tecido_confirmado = Não <strong>ENTÃO</strong> Bloquear Etapa
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Condições */}
                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <h4 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      <span>Condições (SE)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">Quando verificar a regra?</p>
                    <div className="space-y-2 text-sm">
                      {operatorOptions.map(op => (
                        <div key={op.value} className="flex items-center space-x-2 text-slate-600">
                          <span className="w-8 text-center font-mono text-xs bg-slate-100 rounded px-1">{op.icon}</span>
                          <span>{op.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Ações */}
                  <div className="bg-white rounded-lg p-4 border border-purple-100">
                    <h4 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-green-600" />
                      <span>Ações (ENTÃO)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">O que fazer quando a condição é cumprida?</p>
                    <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                      {actionOptions.slice(0, 6).map(action => {
                        const Icon = action.icon;
                        return (
                          <div key={action.value} className="flex items-start space-x-2 text-slate-600">
                            <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium">{action.label}</span>
                              <p className="text-xs text-slate-400">{action.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Como Configurar */}
                <div className="bg-white rounded-lg p-4 border border-purple-100 mb-4">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-orange-500" />
                    <span>Como Configurar uma Regra</span>
                  </h4>
                  <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                    <li><strong>Clique em "Nova Regra"</strong> para abrir o construtor</li>
                    <li><strong>Dê um nome</strong> descritivo à regra (ex: "Bloquear sem tecido")</li>
                    <li><strong>Selecione a etapa</strong> onde a regra será aplicada (opcional)</li>
                    <li><strong>Adicione condições</strong> - clique em "Adicionar Condição" e defina:
                      <ul className="ml-4 mt-1 space-y-1 list-disc">
                        <li>Campo: o checkpoint ou campo a verificar</li>
                        <li>Operador: como comparar (igual, diferente, maior...)</li>
                        <li>Valor: o valor esperado</li>
                      </ul>
                    </li>
                    <li><strong>Adicione ações</strong> - clique em "Adicionar Ação" e escolha o que acontece</li>
                    <li><strong>Guarde</strong> a regra e ela começará a funcionar automaticamente</li>
                  </ol>
                </div>
                
                {/* Exemplos Práticos */}
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="font-semibold text-amber-800 mb-3">Exemplos Práticos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                      <div className="flex items-center space-x-2 mb-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <strong className="text-slate-700">Bloquear sem Tecido</strong>
                      </div>
                      <p className="text-slate-500 text-xs">
                        <span className="text-blue-600">SE</span> tecido_confirmado = Não<br/>
                        <span className="text-green-600">ENTÃO</span> Bloquear Etapa
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                      <div className="flex items-center space-x-2 mb-2">
                        <Layers className="w-4 h-4 text-purple-500" />
                        <strong className="text-slate-700">Avançar Etapa</strong>
                      </div>
                      <p className="text-slate-500 text-xs">
                        <span className="text-blue-600">SE</span> producao_aprovada = Sim<br/>
                        <span className="text-green-600">ENTÃO</span> Mudar Etapa → Lavandaria
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-amber-100">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <strong className="text-slate-700">Alerta de Atraso</strong>
                      </div>
                      <p className="text-slate-500 text-xs">
                        <span className="text-blue-600">SE</span> data_entrega {"<"} hoje<br/>
                        <span className="text-green-600">ENTÃO</span> Criar Alerta + Mudar Status
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Dicas */}
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-800 mb-2 flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Dicas</span>
                  </h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Use o <strong>Simulador</strong> para testar regras antes de ativar</li>
                    <li>• Comece com regras simples e vá adicionando complexidade</li>
                    <li>• A <strong>prioridade</strong> define a ordem de execução (1 = primeiro)</li>
                    <li>• Pode ter múltiplas condições (todas devem ser cumpridas)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rule Builder */}
        {showBuilder && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-medium text-slate-900">
                {editingRule ? 'Editar Regra' : 'Nova Regra'}
              </h3>
              <button
                onClick={() => {
                  setShowBuilder(false);
                  setEditingRule(null);
                }}
                className="p-1.5 hover:bg-slate-200 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Regra *</label>
                  <input
                    type="text"
                    value={ruleForm.nome}
                    onChange={(e) => setRuleForm({ ...ruleForm, nome: e.target.value })}
                    placeholder="Ex: Bloquear sem confirmação de tecido"
                    data-testid="rule-name-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <input
                    type="text"
                    value={ruleForm.descricao}
                    onChange={(e) => setRuleForm({ ...ruleForm, descricao: e.target.value })}
                    placeholder="Descrição opcional"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Etapa (opcional)</label>
                  <select
                    value={ruleForm.etapa_id}
                    onChange={(e) => setRuleForm({ ...ruleForm, etapa_id: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="">Todas as etapas</option>
                    {stages.map(stage => (
                      <option key={stage.id} value={stage.id}>{stage.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={ruleForm.prioridade}
                      onChange={(e) => setRuleForm({ ...ruleForm, prioridade: parseInt(e.target.value) || 1 })}
                      className="flex h-9 w-20 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                    />
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer mt-5">
                    <input
                      type="checkbox"
                      checked={ruleForm.ativo}
                      onChange={(e) => setRuleForm({ ...ruleForm, ativo: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900"
                    />
                    <span className="text-sm text-slate-700">Ativa</span>
                  </label>
                </div>
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-blue-700 flex items-center space-x-2">
                    <Target className="w-4 h-4" />
                    <span>SE (Condições)</span>
                  </h4>
                  <button
                    onClick={addCondition}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Condição</span>
                  </button>
                </div>
                
                {ruleForm.condicoes.length === 0 ? (
                  <div className="p-4 bg-blue-50 rounded-lg text-center text-blue-600 text-sm border border-blue-200">
                    Clique em "Adicionar Condição" para definir quando a regra deve ser ativada
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ruleForm.condicoes.map((cond, index) => (
                      <div key={index} className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <select
                          value={cond.campo}
                          onChange={(e) => updateCondition(index, 'campo', e.target.value)}
                          className="flex-1 h-8 rounded border border-blue-300 bg-white px-2 text-sm"
                        >
                          <option value="">Selecionar campo...</option>
                          <optgroup label="Campos do Projeto">
                            <option value="status_projeto">Status do Projeto</option>
                            <option value="progresso">Progresso (%)</option>
                            <option value="quantidade">Quantidade</option>
                            <option value="data_entrega">Data de Entrega</option>
                          </optgroup>
                          <optgroup label="Checkpoints">
                            {checkpoints.map(cp => (
                              <option key={cp.id} value={`checkpoint_${cp.id}`}>{cp.nome}</option>
                            ))}
                          </optgroup>
                        </select>
                        <select
                          value={cond.operador}
                          onChange={(e) => updateCondition(index, 'operador', e.target.value)}
                          className="w-40 h-8 rounded border border-blue-300 bg-white px-2 text-sm"
                        >
                          {operatorOptions.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        {!['preenchido', 'vazio'].includes(cond.operador) && (
                          <input
                            type="text"
                            value={cond.valor}
                            onChange={(e) => updateCondition(index, 'valor', e.target.value)}
                            placeholder="Valor"
                            className="w-32 h-8 rounded border border-blue-300 bg-white px-2 text-sm"
                          />
                        )}
                        <button
                          onClick={() => removeCondition(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-green-700 flex items-center space-x-2">
                    <Zap className="w-4 h-4" />
                    <span>ENTÃO (Ações)</span>
                  </h4>
                  <button
                    onClick={addAction}
                    className="text-sm text-green-600 hover:text-green-800 flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Ação</span>
                  </button>
                </div>
                
                {ruleForm.acoes.length === 0 ? (
                  <div className="p-4 bg-green-50 rounded-lg text-center text-green-600 text-sm border border-green-200">
                    Clique em "Adicionar Ação" para definir o que acontece quando as condições são cumpridas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ruleForm.acoes.map((action, index) => (
                      <div key={index} className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg border border-green-200">
                        <select
                          value={action.acao}
                          onChange={(e) => updateAction(index, 'acao', e.target.value)}
                          className="flex-1 h-8 rounded border border-green-300 bg-white px-2 text-sm"
                        >
                          {actionOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        
                        {/* Action parameters */}
                        {getActionParams(action.acao).includes('etapa_id') && (
                          <select
                            value={action.parametros.etapa_id || ''}
                            onChange={(e) => updateAction(index, 'etapa_id', e.target.value)}
                            className="w-40 h-8 rounded border border-green-300 bg-white px-2 text-sm"
                          >
                            <option value="">Selecionar etapa...</option>
                            {stages.map(stage => (
                              <option key={stage.id} value={stage.id}>{stage.nome}</option>
                            ))}
                          </select>
                        )}
                        {getActionParams(action.acao).includes('status') && (
                          <select
                            value={action.parametros.status || ''}
                            onChange={(e) => updateAction(index, 'status', e.target.value)}
                            className="w-40 h-8 rounded border border-green-300 bg-white px-2 text-sm"
                          >
                            <option value="">Selecionar status...</option>
                            <option value="ativo">Ativo</option>
                            <option value="atrasado">Atrasado</option>
                            <option value="bloqueado">Bloqueado</option>
                            <option value="concluido">Concluído</option>
                          </select>
                        )}
                        {getActionParams(action.acao).includes('mensagem') && (
                          <input
                            type="text"
                            value={action.parametros.mensagem || ''}
                            onChange={(e) => updateAction(index, 'mensagem', e.target.value)}
                            placeholder="Mensagem do alerta"
                            className="flex-1 h-8 rounded border border-green-300 bg-white px-2 text-sm"
                          />
                        )}
                        {getActionParams(action.acao).includes('prioridade') && (
                          <select
                            value={action.parametros.prioridade || 'media'}
                            onChange={(e) => updateAction(index, 'prioridade', e.target.value)}
                            className="w-28 h-8 rounded border border-green-300 bg-white px-2 text-sm"
                          >
                            <option value="baixa">Baixa</option>
                            <option value="media">Média</option>
                            <option value="alta">Alta</option>
                            <option value="critica">Crítica</option>
                          </select>
                        )}
                        
                        <button
                          onClick={() => removeAction(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowBuilder(false);
                    setEditingRule(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  data-testid="save-rule-button"
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 text-sm flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingRule ? 'Atualizar' : 'Criar'} Regra</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">A carregar...</div>
          ) : rules.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <th className="h-10 px-4 text-left">Nome</th>
                  <th className="h-10 px-4 text-left">Etapa</th>
                  <th className="h-10 px-4 text-left">Condições</th>
                  <th className="h-10 px-4 text-left">Ações</th>
                  <th className="h-10 px-4 text-center">Prioridade</th>
                  <th className="h-10 px-4 text-center">Estado</th>
                  <th className="h-10 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-slate-900">{rule.nome}</span>
                        {rule.descricao && (
                          <p className="text-xs text-slate-400 truncate max-w-xs">{rule.descricao}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{getStageName(rule.etapa_id)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {rule.condicoes?.length || 0} condição(ões)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        {rule.acoes?.length || 0} ação(ões)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {rule.prioridade || 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(rule)}
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          rule.ativo 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {rule.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(rule)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                          title="Duplicar"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhuma regra configurada</p>
              <p className="text-sm text-slate-400 mt-1">Clique em "Nova Regra" para começar</p>
              <button
                onClick={() => setShowTutorial(true)}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Ver como configurar
              </button>
            </div>
          )}
        </div>

        {/* Simulator Modal */}
        {showSimulator && (
          <RuleSimulator
            stages={stages}
            checkpoints={checkpoints}
            rules={rules}
            onClose={() => setShowSimulator(false)}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default AdvancedRules;
