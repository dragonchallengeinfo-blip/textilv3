import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, ChevronLeft, Check, X, Layers, CheckSquare, Zap, 
  Rocket, PartyPopper, Building2, Tag, FileType, Lightbulb,
  ArrowRight, Star, Sparkles
} from 'lucide-react';
import { api } from '@/utils/api';
import { toast } from 'sonner';

const SetupWizard = ({ onComplete, onSkip }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  
  // Form data for each step
  const [stagesData, setStagesData] = useState([
    { nome: 'Planear Materiais', key: 'planear_materiais', cor: '#3B82F6', ordem: 1, dias_padrao: 3 },
    { nome: 'Corte', key: 'corte', cor: '#10B981', ordem: 2, dias_padrao: 2 },
    { nome: 'Confecção', key: 'confeccao', cor: '#8B5CF6', ordem: 3, dias_padrao: 5 },
    { nome: 'Acabamento', key: 'acabamento', cor: '#F59E0B', ordem: 4, dias_padrao: 2 },
    { nome: 'Expedição', key: 'expedicao', cor: '#EF4444', ordem: 5, dias_padrao: 1 }
  ]);
  
  const [checkpointsData, setCheckpointsData] = useState([
    { nome: 'Tecido confirmado?', etapa_key: 'planear_materiais', tipo_resposta: 'checkbox', obrigatorio: true },
    { nome: 'Acessórios confirmados?', etapa_key: 'planear_materiais', tipo_resposta: 'checkbox', obrigatorio: true },
    { nome: 'Corte aprovado?', etapa_key: 'corte', tipo_resposta: 'checkbox', obrigatorio: true },
    { nome: 'Produção aprovada?', etapa_key: 'confeccao', tipo_resposta: 'checkbox', obrigatorio: true },
    { nome: 'Qualidade verificada?', etapa_key: 'acabamento', tipo_resposta: 'checkbox', obrigatorio: true }
  ]);
  
  const [brandsData, setBrandsData] = useState([
    { nome: '', codigo: '' }
  ]);
  
  const [partnersData, setPartnersData] = useState([
    { nome: '', tipo_servico: 'confeccao', num_trabalhadores: '', eficiencia: '80' }
  ]);

  const steps = [
    { 
      id: 'welcome', 
      title: 'Bem-vindo ao Textile Ops!', 
      icon: Rocket,
      description: 'Vamos configurar o seu sistema em poucos minutos.'
    },
    { 
      id: 'stages', 
      title: 'Etapas de Produção', 
      icon: Layers,
      description: 'Defina as etapas do seu processo produtivo.'
    },
    { 
      id: 'checkpoints', 
      title: 'Checkpoints', 
      icon: CheckSquare,
      description: 'Configure pontos de verificação em cada etapa.'
    },
    { 
      id: 'brands', 
      title: 'Marcas', 
      icon: Tag,
      description: 'Adicione as marcas/clientes com que trabalha.'
    },
    { 
      id: 'partners', 
      title: 'Parceiros', 
      icon: Building2,
      description: 'Configure os seus parceiros de confecção.'
    },
    { 
      id: 'complete', 
      title: 'Configuração Concluída!', 
      icon: PartyPopper,
      description: 'O seu sistema está pronto a usar.'
    }
  ];

  const handleNext = async () => {
    // Save data for current step
    if (currentStep === 1) {
      await saveStages();
    } else if (currentStep === 2) {
      await saveCheckpoints();
    } else if (currentStep === 3) {
      await saveBrands();
    } else if (currentStep === 4) {
      await savePartners();
    }
    
    if (currentStep < steps.length - 1) {
      setCompletedSteps([...completedSteps, steps[currentStep].id]);
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveStages = async () => {
    setLoading(true);
    try {
      for (const stage of stagesData) {
        if (stage.nome.trim()) {
          await api.post('/stages/', {
            ...stage,
            ativo: true
          });
        }
      }
      toast.success('Etapas criadas com sucesso!');
    } catch (error) {
      console.error('Failed to save stages:', error);
      // Continue anyway - might already exist
    } finally {
      setLoading(false);
    }
  };

  const saveCheckpoints = async () => {
    setLoading(true);
    try {
      // Get stages to map keys to IDs
      const stagesRes = await api.get('/stages/');
      const stageMap = {};
      stagesRes.data.forEach(s => {
        stageMap[s.key] = s.id;
      });
      
      for (const cp of checkpointsData) {
        if (cp.nome.trim() && stageMap[cp.etapa_key]) {
          await api.post('/checkpoints/', {
            ...cp,
            etapa_id: stageMap[cp.etapa_key],
            categoria: 'validacao'
          });
        }
      }
      toast.success('Checkpoints criados com sucesso!');
    } catch (error) {
      console.error('Failed to save checkpoints:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBrands = async () => {
    setLoading(true);
    try {
      for (const brand of brandsData) {
        if (brand.nome.trim()) {
          await api.post('/brands/', {
            ...brand,
            ativo: true
          });
        }
      }
      toast.success('Marcas criadas com sucesso!');
    } catch (error) {
      console.error('Failed to save brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePartners = async () => {
    setLoading(true);
    try {
      for (const partner of partnersData) {
        if (partner.nome.trim()) {
          await api.post('/partners/', {
            ...partner,
            num_trabalhadores: parseInt(partner.num_trabalhadores) || null,
            eficiencia: parseFloat(partner.eficiencia) || 80,
            ativo: true
          });
        }
      }
      toast.success('Parceiros criados com sucesso!');
    } catch (error) {
      console.error('Failed to save partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    // Mark wizard as completed
    try {
      await api.post('/users/complete-setup');
    } catch (error) {
      // Continue anyway
    }
    onComplete();
  };

  const addStage = () => {
    setStagesData([...stagesData, { 
      nome: '', 
      key: `etapa_${stagesData.length + 1}`, 
      cor: '#64748B', 
      ordem: stagesData.length + 1,
      dias_padrao: 2
    }]);
  };

  const removeStage = (index) => {
    setStagesData(stagesData.filter((_, i) => i !== index));
  };

  const updateStage = (index, field, value) => {
    const newStages = [...stagesData];
    newStages[index][field] = value;
    if (field === 'nome') {
      newStages[index].key = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    setStagesData(newStages);
  };

  const addCheckpoint = () => {
    setCheckpointsData([...checkpointsData, { 
      nome: '', 
      etapa_key: stagesData[0]?.key || '', 
      tipo_resposta: 'checkbox',
      obrigatorio: false
    }]);
  };

  const removeCheckpoint = (index) => {
    setCheckpointsData(checkpointsData.filter((_, i) => i !== index));
  };

  const updateCheckpoint = (index, field, value) => {
    const newCheckpoints = [...checkpointsData];
    newCheckpoints[index][field] = value;
    setCheckpointsData(newCheckpoints);
  };

  const addBrand = () => {
    setBrandsData([...brandsData, { nome: '', codigo: '' }]);
  };

  const removeBrand = (index) => {
    setBrandsData(brandsData.filter((_, i) => i !== index));
  };

  const updateBrand = (index, field, value) => {
    const newBrands = [...brandsData];
    newBrands[index][field] = value;
    setBrandsData(newBrands);
  };

  const addPartner = () => {
    setPartnersData([...partnersData, { nome: '', tipo_servico: 'confeccao', num_trabalhadores: '', eficiencia: '80' }]);
  };

  const removePartner = (index) => {
    setPartnersData(partnersData.filter((_, i) => i !== index));
  };

  const updatePartner = (index, field, value) => {
    const newPartners = [...partnersData];
    newPartners[index][field] = value;
    setPartnersData(newPartners);
  };

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = index === currentStep;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all
                      ${isCompleted ? 'bg-green-500 text-white' : 
                        isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 
                        'bg-slate-200 text-slate-400'}
                    `}>
                      {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs mt-1 ${isCurrent ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
                      {step.title.split(' ')[0]}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${
                      isCompleted ? 'bg-green-500' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[500px]">
          {/* Welcome Step */}
          {currentStep === 0 && (
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Bem-vindo ao Textile Ops!</h2>
              <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">
                Este assistente vai ajudá-lo a configurar o sistema em <strong>5 minutos</strong>. 
                Vamos criar as etapas de produção, checkpoints e parceiros básicos.
              </p>
              
              <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <Layers className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Etapas</p>
                  <p className="text-xs text-slate-500">Fluxo de produção</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <CheckSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Checkpoints</p>
                  <p className="text-xs text-slate-500">Pontos de verificação</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <Building2 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Parceiros</p>
                  <p className="text-xs text-slate-500">Confeções e outros</p>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
                <Lightbulb className="w-4 h-4" />
                <span>Pode alterar tudo mais tarde nas Configurações</span>
              </div>
            </div>
          )}

          {/* Stages Step */}
          {currentStep === 1 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Layers className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Etapas de Produção</h2>
                  <p className="text-sm text-slate-500">Defina as etapas do seu fluxo de trabalho</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {stagesData.map((stage, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <span className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <input
                      type="color"
                      value={stage.cor}
                      onChange={(e) => updateStage(index, 'cor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={stage.nome}
                      onChange={(e) => updateStage(index, 'nome', e.target.value)}
                      placeholder="Nome da etapa"
                      className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm"
                    />
                    <input
                      type="number"
                      value={stage.dias_padrao}
                      onChange={(e) => updateStage(index, 'dias_padrao', parseInt(e.target.value) || 1)}
                      className="w-16 h-9 rounded-md border border-slate-200 px-2 text-sm text-center"
                      title="Dias padrão"
                    />
                    <span className="text-xs text-slate-400">dias</span>
                    <button
                      onClick={() => removeStage(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <button
                onClick={addStage}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <span>+ Adicionar etapa</span>
              </button>
            </div>
          )}

          {/* Checkpoints Step */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckSquare className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Checkpoints</h2>
                  <p className="text-sm text-slate-500">Configure verificações em cada etapa</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {checkpointsData.map((cp, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="text"
                      value={cp.nome}
                      onChange={(e) => updateCheckpoint(index, 'nome', e.target.value)}
                      placeholder="Pergunta ou verificação"
                      className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm"
                    />
                    <select
                      value={cp.etapa_key}
                      onChange={(e) => updateCheckpoint(index, 'etapa_key', e.target.value)}
                      className="w-40 h-9 rounded-md border border-slate-200 px-2 text-sm"
                    >
                      {stagesData.map(s => (
                        <option key={s.key} value={s.key}>{s.nome}</option>
                      ))}
                    </select>
                    <label className="flex items-center space-x-1 text-sm">
                      <input
                        type="checkbox"
                        checked={cp.obrigatorio}
                        onChange={(e) => updateCheckpoint(index, 'obrigatorio', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-slate-600">Obrig.</span>
                    </label>
                    <button
                      onClick={() => removeCheckpoint(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <button
                onClick={addCheckpoint}
                className="text-sm text-green-600 hover:text-green-800 flex items-center space-x-1"
              >
                <span>+ Adicionar checkpoint</span>
              </button>
            </div>
          )}

          {/* Brands Step */}
          {currentStep === 3 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Tag className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Marcas / Clientes</h2>
                  <p className="text-sm text-slate-500">Adicione as marcas com que trabalha</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {brandsData.map((brand, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="text"
                      value={brand.nome}
                      onChange={(e) => updateBrand(index, 'nome', e.target.value)}
                      placeholder="Nome da marca"
                      className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm"
                    />
                    <input
                      type="text"
                      value={brand.codigo}
                      onChange={(e) => updateBrand(index, 'codigo', e.target.value)}
                      placeholder="Código (opcional)"
                      className="w-32 h-9 rounded-md border border-slate-200 px-3 text-sm"
                    />
                    <button
                      onClick={() => removeBrand(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <button
                onClick={addBrand}
                className="text-sm text-orange-600 hover:text-orange-800 flex items-center space-x-1"
              >
                <span>+ Adicionar marca</span>
              </button>
            </div>
          )}

          {/* Partners Step */}
          {currentStep === 4 && (
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Parceiros de Confecção</h2>
                  <p className="text-sm text-slate-500">Configure os seus parceiros</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                {partnersData.map((partner, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="text"
                      value={partner.nome}
                      onChange={(e) => updatePartner(index, 'nome', e.target.value)}
                      placeholder="Nome do parceiro"
                      className="flex-1 h-9 rounded-md border border-slate-200 px-3 text-sm"
                    />
                    <input
                      type="number"
                      value={partner.num_trabalhadores}
                      onChange={(e) => updatePartner(index, 'num_trabalhadores', e.target.value)}
                      placeholder="N.º Trab."
                      className="w-24 h-9 rounded-md border border-slate-200 px-2 text-sm"
                    />
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={partner.eficiencia}
                        onChange={(e) => updatePartner(index, 'eficiencia', e.target.value)}
                        className="w-16 h-9 rounded-md border border-slate-200 px-2 text-sm"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                    <button
                      onClick={() => removePartner(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <button
                onClick={addPartner}
                className="text-sm text-purple-600 hover:text-purple-800 flex items-center space-x-1"
              >
                <span>+ Adicionar parceiro</span>
              </button>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === 5 && (
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <PartyPopper className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Parabéns!</h2>
              <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">
                O seu sistema está configurado e pronto a usar. 
                Pode começar a criar projetos e gerir a sua produção.
              </p>
              
              <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
                <div className="bg-slate-50 rounded-xl p-4 text-left">
                  <Check className="w-5 h-5 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-slate-700">{stagesData.filter(s => s.nome).length} Etapas</p>
                  <p className="text-xs text-slate-500">configuradas</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-left">
                  <Check className="w-5 h-5 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-slate-700">{checkpointsData.filter(c => c.nome).length} Checkpoints</p>
                  <p className="text-xs text-slate-500">criados</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-left">
                  <Check className="w-5 h-5 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-slate-700">{brandsData.filter(b => b.nome).length} Marcas</p>
                  <p className="text-xs text-slate-500">adicionadas</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-left">
                  <Check className="w-5 h-5 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-slate-700">{partnersData.filter(p => p.nome).length} Parceiros</p>
                  <p className="text-xs text-slate-500">registados</p>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
                <Star className="w-4 h-4 text-yellow-500" />
                <span>Dica: Visite a secção "Regras" para criar automações!</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            {currentStep > 0 && currentStep < steps.length - 1 && (
              <button
                onClick={handleBack}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {currentStep < steps.length - 1 && (
              <button
                onClick={onSkip}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                Saltar configuração
              </button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={loading}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <span>{loading ? 'A guardar...' : 'Continuar'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="flex items-center space-x-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700"
              >
                <Sparkles className="w-4 h-4" />
                <span>Começar a usar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
