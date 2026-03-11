"""
WebSocket Routes para tempo real
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from websocket_manager import manager, EventType
from utils import db
from jose import JWTError, jwt
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

SECRET_KEY = os.environ.get("JWT_SECRET", "textile-ops-secret-key-change-in-production")
ALGORITHM = "HS256"


async def get_user_from_token(token: str) -> dict:
    """Valida token e retorna dados do utilizador"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "nome": 1, "role": 1})
            return user
    except JWTError as e:
        logger.warning(f"Invalid token: {e}")
    return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    Endpoint WebSocket principal
    
    Conexão: ws://host/api/realtime/ws?token=JWT_TOKEN
    
    Mensagens recebidas (do cliente):
    - {"type": "ping"} - Keep-alive
    - {"type": "subscribe", "channel": "dashboard"} - Subscrever canal
    
    Mensagens enviadas (para cliente):
    - {"type": "connection", "status": "connected"}
    - {"type": "project_created", "project_id": "...", ...}
    - {"type": "dashboard_update", ...}
    - {"type": "alert_created", ...}
    """
    
    # Validar token
    user = None
    user_id = "anonymous"
    
    if token:
        user = await get_user_from_token(token)
        if user:
            user_id = user.get("id", "anonymous")
    
    # Aceitar conexão
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # Esperar mensagem do cliente
            data = await websocket.receive_json()
            
            msg_type = data.get("type")
            
            if msg_type == "ping":
                # Responder a ping com pong
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": data.get("timestamp")
                })
            
            elif msg_type == "subscribe":
                # Subscrição a canais (futuro)
                channel = data.get("channel")
                await websocket.send_json({
                    "type": "subscribed",
                    "channel": channel
                })
            
            elif msg_type == "get_stats":
                # Estatísticas de conexão
                await websocket.send_json({
                    "type": "stats",
                    "connections": manager.get_connection_count(),
                    "users": manager.get_connected_users()
                })
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
        logger.info(f"Client disconnected: {user_id}")
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket, user_id)


@router.get("/connections")
async def get_connections():
    """Retorna estatísticas de conexões WebSocket"""
    return {
        "total_connections": manager.get_connection_count(),
        "connected_users": manager.get_connected_users()
    }
