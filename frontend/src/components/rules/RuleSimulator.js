import React, { useState } from 'react';
import { Play, X, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { api } from '@/utils/api';
import { toast } from 'sonner';

const RuleSimulator = ({ onClose }) => {
  const [context, setContext] = useState({
    tecido_confirmado: 'sim',
    producao_aprovada: '',
    quantidade: '',
    prazo_dias: '',
    status_projeto: 'ativo'
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAddField = () => {
    const fieldName = prompt('Nome do campo:');
    if (fieldName) {
      setContext({ ...context, [fieldName]: '' });
    }
  };

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const response = await api.post('/rule-engine/simulate', {
        contexto: context,
        rule_ids: []
      });
      setResults(response.data);
      toast.success('Simulação concluída!');
    } catch (error) {
      console.error('Simulation failed:', error);
      toast.error('Erro ao simular regras');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-semibold text-slate-900">Simulador de Regras</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Input Context */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-slate-900">Contexto de Teste</h3>
              <button
                onClick={handleAddField}
                className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 hover:bg-slate-100 rounded"
              >
                + Adicionar Campo
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(context).map(key => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="text"
                    value={context[key]}
                    onChange={(e) => setContext({ ...context, [key]: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                    placeholder="Digite o valor..."
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Simulate Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSimulate}
              disabled={loading}
              data-testid="simulate-button"
              className="bg-slate-900 text-white hover:bg-slate-800 h-10 px-6 py-2 rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>{loading ? 'A simular...' : 'Simular Regras'}</span>
            </button>
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-4">
              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-slate-900">Resultados</h3>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-slate-600">
                      Avaliadas: <span className="font-semibold">{results.total_rules_evaluated}</span>
                    </span>
                    <span className="text-green-600">
                      Corresponderam: <span className="font-semibold">{results.rules_matched}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {results.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 ${
                        result.matched
                          ? 'border-green-200 bg-green-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            {result.matched ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            )}
                            <h4 className={`font-semibold ${
                              result.matched ? 'text-green-900' : 'text-slate-700'
                            }`}>
                              {result.rule_name}
                            </h4>
                            {result.priority > 1 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Prioridade {result.priority}
                              </span>
                            )}
                          </div>

                          {/* Conditions */}
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-slate-500 uppercase">Condições:</p>
                            {result.conditions_evaluated.map((cond, cidx) => (
                              <div key={cidx} className="flex items-center space-x-2 text-sm">
                                {cond.resultado ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-slate-700">
                                  <span className="font-medium">{cond.campo}</span>
                                  {' '}{cond.operador}{' '}
                                  <span className="font-mono text-xs">"{cond.valor_esperado}"</span>
                                  {' '}(atual: <span className="font-mono text-xs">"{cond.valor_atual}"</span>)
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          {result.matched && result.actions_to_execute.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium text-green-700 uppercase">Ações a Executar:</p>
                              {result.actions_to_execute.map((action, aidx) => (
                                <div key={aidx} className="flex items-center space-x-2 text-sm text-green-800">
                                  <Zap className="w-4 h-4" />
                                  <span>{action.acao}</span>
                                  {Object.keys(action.parametros || {}).length > 0 && (
                                    <span className="text-xs text-green-600">
                                      ({Object.entries(action.parametros).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{result.execution_time_ms}ms</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 h-9 px-4 py-2 rounded-md text-sm font-medium shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleSimulator;
