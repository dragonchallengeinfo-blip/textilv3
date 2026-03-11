import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  MessageSquare, Send, Settings, Trash2, X, Bot, User, 
  CheckCircle2, AlertTriangle, Loader2, Sparkles, Key, 
  RefreshCw, ChevronDown, ChevronUp, Play
} from 'lucide-react';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [configOptions, setConfigOptions] = useState({ models: [], actions: [] });
  const [editingConfig, setEditingConfig] = useState({
    api_key: '',
    provider: 'openai',
    model: 'gpt-4o',
    enabled: false,
    allowed_actions: []
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchHistory();
      fetchConfigOptions();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConfig = async () => {
    try {
      const response = await api.get('/ai/config');
      setConfig(response.data);
      setEditingConfig(prev => ({
        ...prev,
        provider: response.data.provider || 'openai',
        model: response.data.model || 'gpt-4o',
        enabled: response.data.enabled || false,
        allowed_actions: response.data.allowed_actions || []
      }));
    } catch (error) {
      console.error('Failed to fetch AI config:', error);
    }
  };

  const fetchConfigOptions = async () => {
    try {
      const response = await api.get('/ai/config/options');
      setConfigOptions(response.data);
    } catch (error) {
      console.error('Failed to fetch config options:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.get('/ai/history');
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const saveConfig = async () => {
    try {
      const payload = { ...editingConfig };
      if (!payload.api_key) {
        delete payload.api_key; // Don't update if empty
      }
      
      await api.put('/ai/config', payload);
      toast.success('Configuração guardada');
      fetchConfig();
      setIsConfigOpen(false);
    } catch (error) {
      toast.error('Erro ao guardar configuração');
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await api.post('/ai/config/test');
      toast.success(`Conexão OK: ${response.data.response}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro de conexão');
    } finally {
      setTestingConnection(false);
    }
  };

  const clearHistory = async () => {
    try {
      await api.delete('/ai/history');
      setMessages([]);
      toast.success('Histórico limpo');
    } catch (error) {
      toast.error('Erro ao limpar histórico');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMsg = {
      id: 'temp-user',
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await api.post('/ai/chat', {
        message: userMessage,
        include_context: true
      });

      // Replace temp message with real ones
      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp-user'),
        response.data.user_message,
        response.data.assistant_message
      ]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar mensagem');
      setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async (messageId, actionType, actionParams) => {
    try {
      await api.post('/ai/execute-action', {
        message_id: messageId,
        action_type: actionType,
        action_params: actionParams
      });
      toast.success('Ação executada com sucesso');
      fetchHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao executar ação');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  const parseMessageContent = (content) => {
    // Remove action blocks from display
    let displayContent = content.replace(/```action[\s\S]*?```/g, '').trim();
    return displayContent;
  };

  const toggleAction = (actionId) => {
    setEditingConfig(prev => {
      const actions = [...prev.allowed_actions];
      if (actions.includes(actionId)) {
        return { ...prev, allowed_actions: actions.filter(a => a !== actionId) };
      } else {
        return { ...prev, allowed_actions: [...actions, actionId] };
      }
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        onTouchEnd={() => setIsOpen(true)}
        data-testid="ai-assistant-toggle"
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110"
        style={{ zIndex: 9999 }}
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden"
      style={{ zIndex: 9999 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold">Assistente AI</span>
          {config?.enabled && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {config.model}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Configurações"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={clearHistory}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Limpar histórico"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {isConfigOpen && (
        <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-4 max-h-80 overflow-y-auto">
          <h4 className="font-medium text-slate-900 flex items-center">
            <Key className="w-4 h-4 mr-2" />
            Configuração da API
          </h4>
          
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Chave API OpenAI</label>
            <input
              type="password"
              value={editingConfig.api_key}
              onChange={(e) => setEditingConfig(prev => ({ ...prev, api_key: e.target.value }))}
              placeholder={config?.api_key_set ? '••••••••••••••••' : 'sk-...'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
              <select
                value={editingConfig.provider}
                onChange={(e) => setEditingConfig(prev => ({ ...prev, provider: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
              <select
                value={editingConfig.model}
                onChange={(e) => setEditingConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
              >
                {configOptions.models
                  .filter(m => m.provider === editingConfig.provider)
                  .map(m => (
                    <option key={m.model} value={m.model}>{m.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingConfig.enabled}
                onChange={(e) => setEditingConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700">Assistente Ativo</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Ações Permitidas</label>
            <div className="space-y-1.5">
              {configOptions.actions.map(action => (
                <label key={action.id} className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingConfig.allowed_actions.includes(action.id)}
                    onChange={() => toggleAction(action.id)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <span className="text-sm text-slate-700">{action.name}</span>
                    <p className="text-xs text-slate-500">{action.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={testConnection}
              disabled={testingConnection}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm disabled:opacity-50"
            >
              {testingConnection ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Testar
            </button>
            <button
              onClick={saveConfig}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!config?.enabled ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
            <Bot className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Assistente AI não está ativo</p>
            <p className="text-xs mt-1">Configure a chave API nas definições</p>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="mt-3 text-xs text-violet-600 hover:underline"
            >
              Abrir Configurações
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
            <Sparkles className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Olá! Como posso ajudar?</p>
            <p className="text-xs mt-1">Pergunte sobre projetos, alertas ou produção</p>
            <div className="mt-4 space-y-2">
              {[
                "Quais projetos estão atrasados?",
                "Qual a capacidade das confecções?",
                "Resumo do estado atual"
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInputMessage(q)}
                  className="block w-full text-xs text-left px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{parseMessageContent(msg.content)}</p>
                
                {/* Action suggestion */}
                {msg.action_suggested && !msg.action_executed && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 mb-2">
                      Ação sugerida: {msg.action_suggested.description}
                    </p>
                    <button
                      onClick={() => executeAction(
                        msg.id,
                        msg.action_suggested.action_type,
                        msg.action_suggested.action_params
                      )}
                      className="inline-flex items-center px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs hover:bg-amber-600"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Executar
                    </button>
                  </div>
                )}
                
                {msg.action_executed && (
                  <div className="mt-2 flex items-center text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ação executada
                  </div>
                )}
                
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-violet-200' : 'text-slate-400'}`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                <span className="text-sm text-slate-500">A pensar...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {config?.enabled && (
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Escreva uma pergunta..."
              disabled={isLoading}
              data-testid="ai-chat-input"
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              data-testid="ai-chat-send"
              className="p-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
