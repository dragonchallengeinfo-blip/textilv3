from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from utils import db, get_current_user, generate_id, serialize_datetime, deserialize_datetime
import os
import json

router = APIRouter()

# ============== MODELS ==============

class AIConfigUpdate(BaseModel):
    api_key: Optional[str] = None
    provider: str = "openai"
    model: str = "gpt-4o"
    enabled: bool = True
    allowed_actions: List[str] = []  # List of action types the AI can suggest

class ChatMessage(BaseModel):
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: Optional[str] = None
    action_suggested: Optional[Dict[str, Any]] = None
    action_executed: bool = False

class ChatRequest(BaseModel):
    message: str
    include_context: bool = True  # Include system data in context

class ActionConfirmRequest(BaseModel):
    message_id: str
    action_type: str
    action_params: Dict[str, Any]

# Available actions that can be configured
AVAILABLE_ACTIONS = [
    {"id": "change_status", "name": "Alterar Status do Projeto", "description": "Mudar o estado de um projeto"},
    {"id": "create_alert", "name": "Criar Alerta", "description": "Criar um alerta para um projeto"},
    {"id": "assign_partner", "name": "Atribuir Parceiro", "description": "Atribuir um parceiro a um projeto"},
    {"id": "update_dates", "name": "Atualizar Datas", "description": "Modificar datas de planeamento"},
    {"id": "add_note", "name": "Adicionar Nota", "description": "Adicionar observação a um projeto"},
    {"id": "change_stage", "name": "Mudar Etapa", "description": "Avançar ou retroceder etapa do projeto"},
]

AVAILABLE_MODELS = [
    {"provider": "openai", "model": "gpt-4o", "name": "GPT-4o (Rápido)"},
    {"provider": "openai", "model": "gpt-5.2", "name": "GPT-5.2 (Avançado)"},
    {"provider": "openai", "model": "gpt-4.1", "name": "GPT-4.1"},
    {"provider": "anthropic", "model": "claude-sonnet-4-5-20250929", "name": "Claude Sonnet 4.5"},
    {"provider": "gemini", "model": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
]


# ============== CONFIG ROUTES ==============

@router.get("/config")
async def get_ai_config(current_user: dict = Depends(get_current_user)):
    """Get AI configuration (admin only for full config, others get status)"""
    config = await db.ai_config.find_one({}, {"_id": 0})
    
    if not config:
        config = {
            "provider": "openai",
            "model": "gpt-4o",
            "enabled": False,
            "api_key_set": False,
            "allowed_actions": []
        }
    else:
        # Don't expose API key
        config["api_key_set"] = bool(config.get("api_key"))
        config.pop("api_key", None)
    
    return config

@router.get("/config/options")
async def get_ai_config_options(current_user: dict = Depends(get_current_user)):
    """Get available models and actions for configuration"""
    return {
        "models": AVAILABLE_MODELS,
        "actions": AVAILABLE_ACTIONS
    }

@router.put("/config")
async def update_ai_config(
    config: AIConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update AI configuration (admin only)"""
    if current_user.get("role") not in ["administrador", "direcao"]:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar configuração")
    
    config_dict = config.model_dump()
    config_dict["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    config_dict["atualizado_por"] = current_user["id"]
    
    # If api_key is None, don't update it (keep existing)
    if config_dict.get("api_key") is None:
        existing = await db.ai_config.find_one({})
        if existing:
            config_dict["api_key"] = existing.get("api_key")
    
    await db.ai_config.update_one({}, {"$set": config_dict}, upsert=True)
    
    # Return without exposing API key
    config_dict["api_key_set"] = bool(config_dict.get("api_key"))
    config_dict.pop("api_key", None)
    
    return config_dict

@router.post("/config/test")
async def test_ai_connection(current_user: dict = Depends(get_current_user)):
    """Test the AI connection with current config"""
    config = await db.ai_config.find_one({})
    if not config or not config.get("api_key"):
        raise HTTPException(status_code=400, detail="Chave API não configurada")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=config["api_key"],
            session_id=f"test-{current_user['id']}",
            system_message="You are a test assistant."
        ).with_model(config.get("provider", "openai"), config.get("model", "gpt-4o"))
        
        response = await chat.send_message(UserMessage(text="Say 'Connection OK' and nothing else."))
        
        return {"status": "success", "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro de conexão: {str(e)}")


# ============== CHAT ROUTES ==============

@router.get("/history")
async def get_chat_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get chat history for current user"""
    messages = await db.ai_chat_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return list(reversed(messages))

@router.delete("/history")
async def clear_chat_history(current_user: dict = Depends(get_current_user)):
    """Clear chat history for current user"""
    await db.ai_chat_history.delete_many({"user_id": current_user["id"]})
    return {"message": "Histórico limpo"}

@router.post("/chat")
async def send_chat_message(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a message to the AI assistant"""
    # Get config
    config = await db.ai_config.find_one({})
    if not config or not config.get("enabled"):
        raise HTTPException(status_code=400, detail="Assistente AI não está ativo")
    if not config.get("api_key"):
        raise HTTPException(status_code=400, detail="Chave API não configurada")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Save user message
    user_msg = {
        "id": generate_id(),
        "user_id": current_user["id"],
        "role": "user",
        "content": request.message,
        "timestamp": now
    }
    await db.ai_chat_history.insert_one(user_msg)
    
    # Build context if requested
    context_data = ""
    if request.include_context:
        context_data = await build_system_context()
    
    # Build allowed actions info
    allowed_actions = config.get("allowed_actions", [])
    actions_info = ""
    if allowed_actions:
        actions_list = [a for a in AVAILABLE_ACTIONS if a["id"] in allowed_actions]
        actions_info = f"""
Podes sugerir as seguintes ações (o utilizador terá de confirmar antes de executar):
{json.dumps(actions_list, ensure_ascii=False, indent=2)}

Quando sugerires uma ação, usa o formato JSON:
```action
{{"action_type": "tipo_acao", "action_params": {{"param1": "valor1"}}, "description": "Descrição da ação"}}
```
"""
    
    # System message
    system_message = f"""És o assistente AI do sistema Textile Ops, um sistema de gestão de produção têxtil.
O teu papel é:
1. Responder a perguntas sobre o estado atual do sistema
2. Analisar projetos, alertas, atrasos e capacidade de produção
3. Dar recomendações e insights sobre a produção
4. Sugerir ações quando apropriado (se permitido)

Contexto atual do sistema:
{context_data}

{actions_info}

Responde sempre em Português de Portugal. Sê conciso mas informativo.
Quando mencionares projetos, usa os números OF (ex: OF20240001).
"""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Get recent history for context
        recent_history = await db.ai_chat_history.find(
            {"user_id": current_user["id"]},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        recent_history = list(reversed(recent_history))
        
        # Build conversation
        chat = LlmChat(
            api_key=config["api_key"],
            session_id=f"textile-{current_user['id']}",
            system_message=system_message
        ).with_model(config.get("provider", "openai"), config.get("model", "gpt-4o"))
        
        # Send message
        response = await chat.send_message(UserMessage(text=request.message))
        
        # Parse response for actions
        action_suggested = None
        if "```action" in response:
            try:
                action_start = response.index("```action") + 9
                action_end = response.index("```", action_start)
                action_json = response[action_start:action_end].strip()
                action_suggested = json.loads(action_json)
            except:
                pass
        
        # Save assistant message
        assistant_msg = {
            "id": generate_id(),
            "user_id": current_user["id"],
            "role": "assistant",
            "content": response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_suggested": action_suggested,
            "action_executed": False
        }
        await db.ai_chat_history.insert_one(assistant_msg)
        
        # Return without _id
        user_msg.pop("_id", None)
        assistant_msg.pop("_id", None)
        
        return {
            "user_message": user_msg,
            "assistant_message": assistant_msg
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar mensagem: {str(e)}")


@router.post("/execute-action")
async def execute_ai_action(
    request: ActionConfirmRequest,
    current_user: dict = Depends(get_current_user)
):
    """Execute an action suggested by the AI"""
    # Verify the message exists and has this action
    message = await db.ai_chat_history.find_one({
        "id": request.message_id,
        "user_id": current_user["id"]
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    
    if message.get("action_executed"):
        raise HTTPException(status_code=400, detail="Ação já foi executada")
    
    # Check if action is allowed
    config = await db.ai_config.find_one({})
    allowed_actions = config.get("allowed_actions", []) if config else []
    
    if request.action_type not in allowed_actions:
        raise HTTPException(status_code=403, detail="Este tipo de ação não está permitido")
    
    # Execute the action
    result = await execute_action(request.action_type, request.action_params, current_user)
    
    # Mark action as executed
    await db.ai_chat_history.update_one(
        {"id": request.message_id},
        {"$set": {"action_executed": True, "action_result": result}}
    )
    
    return {"status": "success", "result": result}


# ============== HELPER FUNCTIONS ==============

async def build_system_context() -> str:
    """Build a context string with current system state"""
    context_parts = []
    
    # Projects summary
    projects = await db.projects.find({}, {"_id": 0}).to_list(100)
    if projects:
        active = len([p for p in projects if p.get("status_projeto") == "ativo"])
        delayed = len([p for p in projects if p.get("status_projeto") == "atrasado"])
        blocked = len([p for p in projects if p.get("status_projeto") == "bloqueado"])
        
        context_parts.append(f"""
PROJETOS:
- Total: {len(projects)}
- Ativos: {active}
- Atrasados: {delayed}
- Bloqueados: {blocked}
""")
        
        # Recent/problematic projects
        problem_projects = [p for p in projects if p.get("status_projeto") in ["atrasado", "bloqueado"]]
        if problem_projects:
            context_parts.append("Projetos com problemas:")
            for p in problem_projects[:5]:
                context_parts.append(f"  - {p.get('of_numero')}: {p.get('modelo')} - Status: {p.get('status_projeto')}")
    
    # Alerts
    alerts = await db.alerts.find({"resolvido": False}, {"_id": 0}).to_list(50)
    if alerts:
        context_parts.append(f"\nALERTAS ATIVOS: {len(alerts)}")
        for a in alerts[:5]:
            context_parts.append(f"  - [{a.get('prioridade')}] {a.get('mensagem')}")
    
    # Partners capacity
    partners = await db.partners.find({"tipo_servico": "confeccao", "ativo": True}, {"_id": 0}).to_list(20)
    if partners:
        context_parts.append(f"\nPARCEIROS DE CONFEÇÃO: {len(partners)}")
        for p in partners:
            capacity = p.get("capacidade_pecas_mes", 0)
            efficiency = p.get("eficiencia", 0)
            context_parts.append(f"  - {p.get('nome')}: {capacity} peças/mês, {efficiency}% eficiência")
    
    return "\n".join(context_parts)


async def execute_action(action_type: str, params: dict, user: dict) -> dict:
    """Execute a specific action"""
    now = datetime.now(timezone.utc).isoformat()
    
    if action_type == "change_status":
        project_id = params.get("project_id")
        new_status = params.get("status")
        if project_id and new_status:
            await db.projects.update_one(
                {"id": project_id},
                {"$set": {"status_projeto": new_status, "atualizado_em": now}}
            )
            return {"message": f"Status alterado para {new_status}"}
    
    elif action_type == "create_alert":
        alert = {
            "id": generate_id(),
            "projeto_id": params.get("project_id"),
            "tipo": params.get("tipo", "info"),
            "mensagem": params.get("mensagem"),
            "prioridade": params.get("prioridade", "media"),
            "visto": False,
            "resolvido": False,
            "criado_em": now,
            "criado_por": user["id"]
        }
        await db.alerts.insert_one(alert)
        return {"message": "Alerta criado", "alert_id": alert["id"]}
    
    elif action_type == "add_note":
        # Add to timeline as a note event
        event = {
            "id": generate_id(),
            "projeto_id": params.get("project_id"),
            "tipo_evento": "nota",
            "descricao": params.get("nota"),
            "criado_por": user["id"],
            "criado_por_nome": user.get("nome"),
            "data_evento": now,
            "resolvido": False
        }
        await db.timeline_events.insert_one(event)
        return {"message": "Nota adicionada"}
    
    elif action_type == "assign_partner":
        project_id = params.get("project_id")
        partner_id = params.get("partner_id")
        if project_id and partner_id:
            await db.projects.update_one(
                {"id": project_id},
                {"$set": {"parceiro_confeccao_id": partner_id, "atualizado_em": now}}
            )
            return {"message": "Parceiro atribuído"}
    
    return {"message": "Ação executada"}
