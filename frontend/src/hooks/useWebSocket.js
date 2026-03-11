/**
 * Hook para WebSocket em tempo real
 * Conecta ao servidor e recebe atualizações automáticas
 * Inclui notificações toast e som para alertas
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

const RECONNECT_DELAY = 3000; // 3 segundos
const PING_INTERVAL = 30000; // 30 segundos
const MAX_RECONNECT_ATTEMPTS = 5;

// ========== SOM DE NOTIFICAÇÃO ==========
// Criar som de notificação usando Web Audio API
let audioContext = null;

function playNotificationSound(type = 'info') {
  try {
    // Criar AudioContext apenas quando necessário (evita warnings)
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Diferentes sons para diferentes tipos
    switch (type) {
      case 'success':
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.setValueAtTime(1108, audioContext.currentTime + 0.1); // C#6
        break;
      case 'warning':
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.setValueAtTime(349, audioContext.currentTime + 0.15); // F4
        break;
      case 'error':
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
        oscillator.frequency.setValueAtTime(196, audioContext.currentTime + 0.2); // G3
        break;
      default: // info
        oscillator.frequency.setValueAtTime(659, audioContext.currentTime); // E5
        oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.1); // G5
    }
    
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // Silently fail if audio is not supported
    console.log('[Audio] Notification sound not available');
  }
}

// ========== NOTIFICAÇÕES TOAST ==========
function showProjectNotification(data) {
  const project = data.project || {};
  const ofNumero = project.of_numero || data.project_id?.substring(0, 8);
  
  switch (data.type) {
    case 'project_created':
      playNotificationSound('success');
      toast.success('Novo Projeto Criado', {
        description: `OF ${ofNumero} - ${project.modelo || 'Sem modelo'}`,
        duration: 5000,
      });
      break;
      
    case 'project_updated':
      playNotificationSound('info');
      toast.info('Projeto Atualizado', {
        description: `OF ${ofNumero} foi modificado`,
        duration: 4000,
      });
      break;
      
    case 'project_deleted':
      playNotificationSound('warning');
      toast.warning('Projeto Eliminado', {
        description: `OF ${ofNumero} foi removido do sistema`,
        duration: 5000,
      });
      break;
      
    case 'project_status_changed':
      const oldStatus = data.details?.old_status;
      const newStatus = data.details?.new_status;
      if (newStatus === 'atrasado') {
        playNotificationSound('error');
        toast.error('Projeto Atrasado', {
          description: `OF ${ofNumero} passou para estado atrasado`,
          duration: 6000,
        });
      } else if (newStatus === 'concluido') {
        playNotificationSound('success');
        toast.success('Projeto Concluído', {
          description: `OF ${ofNumero} foi finalizado com sucesso`,
          duration: 5000,
        });
      } else {
        playNotificationSound('info');
        toast.info('Estado Alterado', {
          description: `OF ${ofNumero}: ${oldStatus || '?'} → ${newStatus || '?'}`,
          duration: 4000,
        });
      }
      break;
      
    case 'project_stage_changed':
      playNotificationSound('info');
      toast.info('Etapa Alterada', {
        description: `OF ${ofNumero} avançou para nova etapa`,
        duration: 4000,
      });
      break;
      
    default:
      break;
  }
}

function showAlertNotification(data) {
  const priority = data.priority || 'media';
  
  if (priority === 'alta' || priority === 'critica') {
    playNotificationSound('error');
    toast.error('Alerta Importante', {
      description: data.message,
      duration: 8000,
    });
  } else {
    playNotificationSound('warning');
    toast.warning('Novo Alerta', {
      description: data.message,
      duration: 5000,
    });
  }
}

function showSystemNotification(data) {
  const level = data.level || 'info';
  
  switch (level) {
    case 'success':
      playNotificationSound('success');
      toast.success(data.title, { description: data.message });
      break;
    case 'warning':
      playNotificationSound('warning');
      toast.warning(data.title, { description: data.message });
      break;
    case 'error':
      playNotificationSound('error');
      toast.error(data.title, { description: data.message });
      break;
    default:
      playNotificationSound('info');
      toast.info(data.title, { description: data.message });
  }
}

/**
 * Hook principal para WebSocket
 * 
 * @param {Object} options
 * @param {Function} options.onProjectChange - Callback quando projeto muda
 * @param {Function} options.onDashboardUpdate - Callback quando dashboard precisa atualizar
 * @param {Function} options.onAlertCreated - Callback quando alerta é criado
 * @param {Function} options.onSystemNotification - Callback para notificações de sistema
 * @param {boolean} options.autoReconnect - Se deve reconectar automaticamente (default: true)
 * @param {boolean} options.showToasts - Mostrar notificações toast (default: true)
 * @param {boolean} options.playSound - Tocar som nas notificações (default: true)
 */
export function useWebSocket({
  onProjectChange,
  onDashboardUpdate,
  onAlertCreated,
  onSystemNotification,
  autoReconnect = true,
  showToasts = true,
  playSound = true
} = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const pingIntervalRef = useRef(null);
  
  // Construir URL do WebSocket
  const getWebSocketUrl = useCallback(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    // Converter HTTP para WS
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    
    // Obter token do localStorage
    const token = localStorage.getItem('token');
    
    return `${wsProtocol}://${wsHost}/api/realtime/ws${token ? `?token=${token}` : ''}`;
  }, []);
  
  // Processar mensagens recebidas
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      setLastMessage(data);
      
      switch (data.type) {
        // Conexão - silenciosa (não mostrar toast)
        case 'connection':
          console.log('[WS] Connected:', data.message);
          // Removido toast de conexão - era irritante aparecer sempre
          break;
        
        case 'pong':
          // Resposta ao ping - conexão OK
          break;
        
        // Projetos
        case 'project_created':
        case 'project_updated':
        case 'project_deleted':
        case 'project_status_changed':
        case 'project_stage_changed':
          console.log('[WS] Project change:', data.type, data.project_id);
          // Mostrar notificação toast
          if (showToasts) {
            showProjectNotification(data);
          }
          if (onProjectChange) {
            onProjectChange(data);
          }
          break;
        
        // Dashboard
        case 'dashboard_update':
          console.log('[WS] Dashboard update requested');
          if (onDashboardUpdate) {
            onDashboardUpdate(data);
          }
          break;
        
        // Alertas
        case 'alert_created':
        case 'alert_resolved':
          console.log('[WS] Alert:', data.type);
          // Mostrar notificação de alerta com som
          if (showToasts) {
            showAlertNotification(data);
          }
          if (onAlertCreated) {
            onAlertCreated(data);
          }
          break;
        
        // Sistema
        case 'system_notification':
          console.log('[WS] System notification:', data.title);
          if (showToasts) {
            showSystemNotification(data);
          }
          if (onSystemNotification) {
            onSystemNotification(data);
          }
          break;
        
        default:
          console.log('[WS] Unknown message type:', data.type);
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  }, [onProjectChange, onDashboardUpdate, onAlertCreated, onSystemNotification]);
  
  // Conectar ao WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }
    
    const url = getWebSocketUrl();
    console.log('[WS] Connecting to:', url);
    
    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        console.log('[WS] Connection established');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        setConnectionCount(prev => prev + 1);
        
        // Iniciar ping interval
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, PING_INTERVAL);
      };
      
      wsRef.current.onmessage = handleMessage;
      
      wsRef.current.onerror = (event) => {
        console.error('[WS] Error:', event);
        setError('Erro na conexão WebSocket');
      };
      
      wsRef.current.onclose = (event) => {
        console.log('[WS] Connection closed:', event.code, event.reason);
        setIsConnected(false);
        
        // Limpar ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Tentar reconectar
        if (autoReconnect && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          console.log(`[WS] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts.current})`);
          setTimeout(connect, RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[WS] Failed to connect:', err);
      setError('Falha ao conectar ao WebSocket');
    }
  }, [getWebSocketUrl, handleMessage, autoReconnect]);
  
  // Desconectar
  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);
  
  // Enviar mensagem
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send - not connected');
    }
  }, []);
  
  // Conectar ao montar
  useEffect(() => {
    // Só conectar se houver token (utilizador autenticado)
    const token = localStorage.getItem('token');
    if (token) {
      connect();
    }
    
    // Cleanup ao desmontar
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  // Reconectar quando token muda
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        if (e.newValue) {
          connect();
        } else {
          disconnect();
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);
  
  return {
    isConnected,
    connectionCount,
    lastMessage,
    error,
    connect,
    disconnect,
    sendMessage
  };
}

/**
 * Hook simplificado para dashboard com auto-refresh
 * 
 * @param {Function} refreshDashboard - Função para atualizar dados do dashboard
 */
export function useDashboardRealtime(refreshDashboard) {
  const { isConnected, lastMessage } = useWebSocket({
    onDashboardUpdate: () => {
      console.log('[Dashboard] Refreshing due to WebSocket event');
      refreshDashboard();
    },
    onProjectChange: (data) => {
      // Atualizar dashboard em mudanças importantes
      if (['project_created', 'project_deleted', 'project_status_changed'].includes(data.type)) {
        console.log('[Dashboard] Refreshing due to project change');
        refreshDashboard();
      }
    }
  });
  
  return { isConnected, lastMessage };
}

/**
 * Hook para página de Projetos com auto-refresh
 * Atualiza lista automaticamente quando projetos são criados/editados/eliminados
 * 
 * @param {Function} refreshProjects - Função para recarregar lista de projetos
 * @param {Object} options
 * @param {boolean} options.showToasts - Mostrar notificações (default: true)
 */
export function useProjectsRealtime(refreshProjects, { showToasts = true } = {}) {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  
  const { isConnected, lastMessage } = useWebSocket({
    showToasts,
    onProjectChange: (data) => {
      console.log('[Projects] Received update:', data.type);
      setLastUpdate(new Date());
      setUpdateCount(prev => prev + 1);
      
      // Refresh na lista de projetos
      if (refreshProjects) {
        refreshProjects();
      }
    },
    onDashboardUpdate: () => {
      // Dashboard update também pode indicar mudanças nos projetos
      if (refreshProjects) {
        refreshProjects();
      }
    }
  });
  
  return { 
    isConnected, 
    lastMessage, 
    lastUpdate,
    updateCount 
  };
}

/**
 * Hook para componentes que precisam apenas ouvir notificações
 * Não faz refresh automático, apenas mostra toasts
 */
export function useRealtimeNotifications() {
  return useWebSocket({
    showToasts: true,
    // Sem callbacks de refresh - só notificações
  });
}

export default useWebSocket;
