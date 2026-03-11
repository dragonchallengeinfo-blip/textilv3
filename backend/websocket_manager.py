"""
WebSocket Manager para atualizações em tempo real
Sistema de broadcast para notificar clientes sobre mudanças em projetos
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, List, Any
from datetime import datetime, timezone
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Gestor de conexões WebSocket
    - Mantém lista de conexões ativas
    - Suporta broadcast para todos os clientes
    - Suporta mensagens direcionadas por user_id
    """
    
    def __init__(self):
        # Conexões ativas: {user_id: [websocket1, websocket2, ...]}
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Todas as conexões (para broadcast geral)
        self.all_connections: Set[WebSocket] = set()
        # Lock para thread-safety
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: str = "anonymous"):
        """Aceita nova conexão WebSocket"""
        await websocket.accept()
        
        async with self._lock:
            # Adicionar à lista geral
            self.all_connections.add(websocket)
            
            # Adicionar à lista do utilizador
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        
        logger.info(f"WebSocket connected: user={user_id}, total={len(self.all_connections)}")
        
        # Enviar mensagem de boas-vindas
        await self.send_personal_message({
            "type": "connection",
            "status": "connected",
            "message": "Ligação estabelecida",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, websocket)
    
    async def disconnect(self, websocket: WebSocket, user_id: str = "anonymous"):
        """Remove conexão WebSocket"""
        async with self._lock:
            # Remover da lista geral
            self.all_connections.discard(websocket)
            
            # Remover da lista do utilizador
            if user_id in self.active_connections:
                if websocket in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(websocket)
                # Limpar se vazio
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        
        logger.info(f"WebSocket disconnected: user={user_id}, total={len(self.all_connections)}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Envia mensagem para uma conexão específica"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
    
    async def send_to_user(self, message: dict, user_id: str):
        """Envia mensagem para todas as conexões de um utilizador"""
        if user_id not in self.active_connections:
            return
        
        disconnected = []
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                disconnected.append(websocket)
        
        # Limpar conexões mortas
        for ws in disconnected:
            await self.disconnect(ws, user_id)
    
    async def broadcast(self, message: dict):
        """Broadcast para todas as conexões ativas"""
        if not self.all_connections:
            return
        
        disconnected = []
        
        for websocket in list(self.all_connections):
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast failed for a connection: {e}")
                disconnected.append(websocket)
        
        # Limpar conexões mortas
        async with self._lock:
            for ws in disconnected:
                self.all_connections.discard(ws)
        
        logger.debug(f"Broadcast sent to {len(self.all_connections)} connections")
    
    def get_connection_count(self) -> int:
        """Retorna número de conexões ativas"""
        return len(self.all_connections)
    
    def get_connected_users(self) -> List[str]:
        """Retorna lista de user_ids conectados"""
        return list(self.active_connections.keys())


# Instância global do manager
manager = ConnectionManager()


# ========== TIPOS DE EVENTOS ==========

class EventType:
    """Tipos de eventos para broadcast"""
    # Projetos
    PROJECT_CREATED = "project_created"
    PROJECT_UPDATED = "project_updated"
    PROJECT_DELETED = "project_deleted"
    PROJECT_STATUS_CHANGED = "project_status_changed"
    PROJECT_STAGE_CHANGED = "project_stage_changed"
    
    # Alertas
    ALERT_CREATED = "alert_created"
    ALERT_RESOLVED = "alert_resolved"
    
    # Dashboard
    DASHBOARD_UPDATE = "dashboard_update"
    
    # Sistema
    SYSTEM_NOTIFICATION = "system_notification"


async def notify_project_change(
    event_type: str,
    project_id: str,
    project_data: dict = None,
    changed_by: str = None,
    details: dict = None
):
    """
    Notifica todos os clientes sobre mudança num projeto
    
    Args:
        event_type: Tipo de evento (PROJECT_CREATED, PROJECT_UPDATED, etc.)
        project_id: ID do projeto afetado
        project_data: Dados do projeto (opcional)
        changed_by: ID do utilizador que fez a mudança
        details: Detalhes adicionais
    """
    message = {
        "type": event_type,
        "project_id": project_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": changed_by
    }
    
    if project_data:
        # Incluir apenas campos essenciais para não sobrecarregar
        message["project"] = {
            "id": project_data.get("id"),
            "of_numero": project_data.get("of_numero"),
            "modelo": project_data.get("modelo"),
            "status_projeto": project_data.get("status_projeto"),
            "progresso_percentagem": project_data.get("progresso_percentagem"),
            "etapa_atual_id": project_data.get("etapa_atual_id")
        }
    
    if details:
        message["details"] = details
    
    await manager.broadcast(message)
    logger.info(f"Broadcast: {event_type} for project {project_id}")


async def notify_alert(
    event_type: str,
    alert_id: str,
    project_id: str,
    message_text: str,
    priority: str = "media"
):
    """Notifica sobre novo alerta"""
    message = {
        "type": event_type,
        "alert_id": alert_id,
        "project_id": project_id,
        "message": message_text,
        "priority": priority,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await manager.broadcast(message)
    logger.info(f"Alert broadcast: {event_type}")


async def notify_dashboard_update():
    """Notifica que o dashboard deve ser atualizado"""
    message = {
        "type": EventType.DASHBOARD_UPDATE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": "Dashboard data has changed"
    }
    
    await manager.broadcast(message)


async def send_system_notification(
    title: str,
    message_text: str,
    level: str = "info"
):
    """Envia notificação de sistema para todos"""
    message = {
        "type": EventType.SYSTEM_NOTIFICATION,
        "title": title,
        "message": message_text,
        "level": level,  # info, warning, error, success
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await manager.broadcast(message)
