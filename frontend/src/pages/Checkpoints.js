import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { 
  Plus, Edit, Trash2, HelpCircle, Info, CheckSquare, 
  List, Calendar, Type, AlertTriangle, XCircle, CheckCircle,
  ChevronDown, ChevronUp, Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';

const Checkpoints = () => {
  const [checkpoints, setCheckpoints] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showTutorial, setShowTutorial] = useState(true); // Mostrar tutorial por defeito
  const [formData, setFormData] = useState({
    etapa_id: '',
    nome: '',
    tipo_resposta: 'checkbox',
    obrigatorio: false,
    categoria: 'informativo',
    ordem: 0,
    opcoes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Mostrar tutorial automaticamente se não houver checkpoints
  useEffect(() => {
    if (!loading && checkpoints.length === 0) {
      setShowTutorial(true);
    }
  }, [loading, checkpoints.length]);

  const fetchData = async () => {
    try {
      const [checkpointsRes, stagesRes] = await Promise.all([
        api.get('/checkpoints/'),
        api.get('/stages/')
      ]);
      setCheckpoints(checkpointsRes.data);
      setStages(stagesRes.data);
    } catch (error) {
      console.error('Failed to fetch:', error);
      toast.error('Erro ao carregar checkpoints');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      etapa_id: '',
      nome: '',
      tipo_resposta: 'checkbox',
      obrigatorio: false,
      categoria: 'informativo',
      ordem: 0,
      opcoes: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        opcoes: formData.opcoes ? formData.opcoes.split(',').map(o => o.trim()) : null
      };

      if (editingId) {
        await api.put(`/checkpoints/${editingId}`, payload);
        toast.success('Checkpoint atualizado');
      } else {
        await api.post('/checkpoints/', payload);
        toast.success('Checkpoint criado');
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Erro ao guardar');
    }
  };

  const handleEdit = (checkpoint) => {
    setFormData({
      etapa_id: checkpoint.etapa_id,
      nome: checkpoint.nome,
      tipo_resposta: checkpoint.tipo_resposta,
      obrigatorio: checkpoint.obrigatorio,
      categoria: checkpoint.categoria,
      ordem: checkpoint.ordem,
      opcoes: checkpoint.opcoes?.join(', ') || ''
    });
    setEditingId(checkpoint.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza?')) return;
    try {
      await api.delete(`/checkpoints/${id}`);
      toast.success('Checkpoint eliminado');
      fetchData();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Erro ao eliminar');
    }
  };

  const getStageName = (etapaId) => {
    const stage = stages.find(s => s.id === etapaId);
    return stage?.nome || '-';
  };

  const getCategoryColor = (categoria) => {
    switch (categoria) {
      case 'validacao': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'transicao': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'alerta': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getCategoryLabel = (categoria) => {
    switch (categoria) {
      case 'validacao': return 'Validacao';
      case 'transicao': return 'Transicao';
      case 'alerta': return 'Alerta';
      default: return 'Informativo';
    }
  };

  const getTypeIcon = (tipo) => {
    switch (tipo) {
      case 'checkbox': return <CheckSquare className="w-4 h-4" />;
      case 'escolha_unica': return <List className="w-4 h-4" />;
      case 'escolha_multipla': return <List className="w-4 h-4" />;
      case 'data': return <Calendar className="w-4 h-4" />;
      case 'texto': return <Type className="w-4 h-4" />;
      default: return <CheckSquare className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (tipo) => {
    switch (tipo) {
      case 'checkbox': return 'Checkbox';
      case 'escolha_unica': return 'Escolha Única';
      case 'escolha_multipla': return 'Escolha Múltipla';
      case 'data': return 'Data';
      case 'texto': return 'Texto';
      default: return tipo;
    }
  };

  const actions = (
    <div className="flex items-center space-x-2">
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
        onClick={() => {
          resetForm();
          setEditingId(null);
          setShowForm(true);
        }}
        data-testid="create-checkpoint-button"
        className="bg-slate-900 text-white hover:bg-slate-800 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
      >
        <Plus className="w-4 h-4" />
        <span>Novo Checkpoint</span>
      </button>
    </div>
  );

  return (
    <MainLayout title="Checkpoints" actions={actions}>
      <div data-testid="checkpoints-page" className="space-y-6">
        
        {/* Tutorial Section */}
        {showTutorial && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  O que são Checkpoints?
                </h3>
                <p className="text-slate-600 mb-4">
                  Checkpoints são <strong>pontos de verificação</strong> que permitem controlar e validar informações 
                  em cada etapa do processo produtivo. São perguntas ou campos que a equipa deve preencher 
                  durante a execução de cada projeto.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Como Configurar */}
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-semibold text-slate-800 mb-2 flex items-center space-x-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      <span>Como Configurar</span>
                    </h4>
                    <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                      <li><strong>Etapa:</strong> Escolha em que etapa este checkpoint aparece</li>
                      <li><strong>Nome:</strong> Escreva a pergunta ou campo (ex: "Tecido confirmado?")</li>
                      <li><strong>Tipo:</strong> Defina como será respondido (checkbox, data, texto...)</li>
                      <li><strong>Categoria:</strong> Define a importância e comportamento</li>
                      <li><strong>Obrigatório:</strong> Se marcado, não avança sem responder</li>
                    </ol>
                  </div>
                  
                  {/* Tipos de Resposta */}
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-semibold text-slate-800 mb-2 flex items-center space-x-2">
                      <CheckSquare className="w-4 h-4 text-green-600" />
                      <span>Tipos de Resposta</span>
                    </h4>
                    <div className="text-sm text-slate-600 space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span><strong>Checkbox:</strong> Sim/Não (ex: "Aprovado?")</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <List className="w-3.5 h-3.5 text-slate-400" />
                        <span><strong>Escolha Única:</strong> Selecionar uma opção</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <List className="w-3.5 h-3.5 text-slate-400" />
                        <span><strong>Escolha Múltipla:</strong> Selecionar várias opções</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span><strong>Data:</strong> Selecionar uma data</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Type className="w-3.5 h-3.5 text-slate-400" />
                        <span><strong>Texto:</strong> Campo de texto livre</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Categorias */}
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span>Categorias e seu Comportamento</span>
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium mb-2">Informativo</span>
                      <p className="text-slate-600">Apenas para registo. Não bloqueia o avanço.</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium mb-2">Validação</span>
                      <p className="text-slate-600">Verifica se um critério foi cumprido.</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium mb-2">Transição</span>
                      <p className="text-slate-600">Controla a passagem entre etapas.</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium mb-2">Alerta</span>
                      <p className="text-slate-600">Gera notificação quando preenchido.</p>
                    </div>
                  </div>
                </div>
                
                {/* Exemplos Práticos */}
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="font-semibold text-amber-800 mb-2">Exemplos Práticos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-slate-700">Tecido confirmado?</strong>
                        <p className="text-slate-500">Etapa: Planear Materiais | Tipo: Checkbox | Obrigatório</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-slate-700">Data chegada tecido</strong>
                        <p className="text-slate-500">Etapa: Planear Materiais | Tipo: Data | Informativo</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <strong className="text-slate-700">Produção aprovada?</strong>
                        <p className="text-slate-500">Etapa: Confecção | Tipo: Checkbox | Transição</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-slate-900 mb-4">
              {editingId ? 'Editar Checkpoint' : 'Novo Checkpoint'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Etapa *
                    <span className="ml-1 text-xs text-slate-400 font-normal">(em que etapa aparece)</span>
                  </label>
                  <select
                    value={formData.etapa_id}
                    onChange={(e) => setFormData({ ...formData, etapa_id: e.target.value })}
                    required
                    data-testid="checkpoint-stage-select"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="">Selecionar etapa...</option>
                    {stages.map(stage => (
                      <option key={stage.id} value={stage.id}>{stage.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome *
                    <span className="ml-1 text-xs text-slate-400 font-normal">(pergunta ou campo)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    placeholder="Ex: Tecido ok?"
                    data-testid="checkpoint-name-input"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo *
                    <span className="ml-1 text-xs text-slate-400 font-normal">(como será respondido)</span>
                  </label>
                  <select
                    value={formData.tipo_resposta}
                    onChange={(e) => setFormData({ ...formData, tipo_resposta: e.target.value })}
                    data-testid="checkpoint-type-select"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="checkbox">Checkbox (Sim/Não)</option>
                    <option value="escolha_unica">Escolha Única</option>
                    <option value="escolha_multipla">Escolha Múltipla</option>
                    <option value="data">Data</option>
                    <option value="texto">Texto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Categoria *
                    <span className="ml-1 text-xs text-slate-400 font-normal">(comportamento)</span>
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    data-testid="checkpoint-category-select"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    <option value="informativo">Informativo (apenas registo)</option>
                    <option value="validacao">Validação (verifica critério)</option>
                    <option value="transicao">Transição (controla avanço)</option>
                    <option value="alerta">Alerta (gera notificação)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ordem</label>
                  <input
                    type="number"
                    value={formData.ordem}
                    onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.obrigatorio}
                      onChange={(e) => setFormData({ ...formData, obrigatorio: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900"
                    />
                    <span className="text-sm text-slate-700">
                      Obrigatório
                      <span className="text-xs text-slate-400 ml-1">(bloqueia avanço se não preenchido)</span>
                    </span>
                  </label>
                </div>
              </div>
              
              {(formData.tipo_resposta === 'escolha_unica' || formData.tipo_resposta === 'escolha_multipla') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Opções
                    <span className="ml-1 text-xs text-slate-400 font-normal">(separadas por vírgula)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.opcoes}
                    onChange={(e) => setFormData({ ...formData, opcoes: e.target.value })}
                    placeholder="Ex: Sim, Não, Talvez"
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  />
                </div>
              )}
              
              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  data-testid="save-checkpoint-button"
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

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <th className="h-10 px-4 text-left">Nome</th>
                <th className="h-10 px-4 text-left">Etapa</th>
                <th className="h-10 px-4 text-left">Tipo</th>
                <th className="h-10 px-4 text-left">Categoria</th>
                <th className="h-10 px-4 text-center">Obrigatório</th>
                <th className="h-10 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">A carregar...</td></tr>
              ) : checkpoints.length > 0 ? (
                checkpoints.map((checkpoint) => (
                  <tr key={checkpoint.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{checkpoint.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{getStageName(checkpoint.etapa_id)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1.5 text-slate-600">
                        {getTypeIcon(checkpoint.tipo_resposta)}
                        <span>{getTypeLabel(checkpoint.tipo_resposta)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getCategoryColor(checkpoint.categoria)}`}>
                        {getCategoryLabel(checkpoint.categoria)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {checkpoint.obrigatorio ? (
                        <span className="text-red-600 font-medium">Sim</span>
                      ) : (
                        <span className="text-slate-400">Não</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(checkpoint)}
                          data-testid={`edit-checkpoint-${checkpoint.id}`}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(checkpoint.id)}
                          data-testid={`delete-checkpoint-${checkpoint.id}`}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum checkpoint configurado</p>
                  <button 
                    onClick={() => setShowTutorial(true)}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Ver como configurar
                  </button>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Checkpoints;
