from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from models import TimelineEvent, TimelineEventCreate, TimelineEventType, ProblemType
from utils import db, get_current_user, generate_id, create_history_entry
from datetime import datetime, timezone

router = APIRouter()

# Problem types with labels
PROBLEM_TYPES = [
    {"value": "falta_material", "label": "Falta de Material"},
    {"value": "defeito_qualidade", "label": "Defeito de Qualidade"},
    {"value": "atraso_fornecedor", "label": "Atraso do Fornecedor"},
    {"value": "maquina_avariada", "label": "Máquina Avariada"},
    {"value": "falta_capacidade", "label": "Falta de Capacidade"},
    {"value": "erro_corte", "label": "Erro de Corte"},
    {"value": "problema_tecido", "label": "Problema com Tecido"},
    {"value": "outro", "label": "Outro"}
]

EVENT_TYPES = [
    {"value": "inicio", "label": "Início", "icon": "play", "color": "#22C55E"},
    {"value": "pausa", "label": "Pausa", "icon": "pause", "color": "#F59E0B"},
    {"value": "retoma", "label": "Retoma", "icon": "play", "color": "#3B82F6"},
    {"value": "problema", "label": "Problema", "icon": "alert", "color": "#EF4444"},
    {"value": "problema_resolvido", "label": "Problema Resolvido", "icon": "check", "color": "#22C55E"},
    {"value": "mudanca_etapa", "label": "Mudança de Etapa", "icon": "arrow-right", "color": "#8B5CF6"},
    {"value": "conclusao", "label": "Conclusão", "icon": "flag", "color": "#22C55E"},
    {"value": "nota", "label": "Nota", "icon": "message", "color": "#64748B"}
]


@router.get("/types")
async def get_event_types(current_user: dict = Depends(get_current_user)):
    """Get available event and problem types"""
    return {
        "event_types": EVENT_TYPES,
        "problem_types": PROBLEM_TYPES
    }


@router.get("/{project_id}")
async def get_project_timeline(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get timeline events for a project"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    events = await db.timeline_events.find(
        {"projeto_id": project_id},
        {"_id": 0}
    ).sort("data_evento", -1).to_list(500)
    
    # Get user names for events
    user_ids = list(set(e.get("criado_por") for e in events if e.get("criado_por")))
    users_map = {}
    if user_ids:
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
        users_map = {u["id"]: u["nome"] for u in users}
    
    for event in events:
        event["criado_por_nome"] = users_map.get(event.get("criado_por"), "Desconhecido")
    
    # Calculate project status summary
    active_problems = [e for e in events if e.get("tipo_evento") == "problema" and not e.get("resolvido")]
    is_paused = False
    for e in sorted(events, key=lambda x: x.get("data_evento", ""), reverse=True):
        if e.get("tipo_evento") == "pausa":
            is_paused = True
            break
        elif e.get("tipo_evento") in ["retoma", "inicio"]:
            is_paused = False
            break
    
    return {
        "project": project,
        "events": events,
        "summary": {
            "total_events": len(events),
            "active_problems": len(active_problems),
            "is_paused": is_paused,
            "problems_list": active_problems
        }
    }


@router.post("/{project_id}")
async def add_timeline_event(
    project_id: str,
    event_data: TimelineEventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new event to project timeline"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    now = datetime.now(timezone.utc)
    
    event_doc = {
        "id": generate_id(),
        "projeto_id": project_id,
        "etapa_key": event_data.etapa_key,
        "tipo_evento": event_data.tipo_evento,
        "tipo_problema": event_data.tipo_problema,
        "descricao": event_data.descricao,
        "impacto_dias": event_data.impacto_dias,
        "resolvido": event_data.resolvido,
        "criado_por": current_user["id"],
        "data_evento": now.isoformat()
    }
    
    await db.timeline_events.insert_one(event_doc)
    event_doc.pop("_id", None)
    event_doc["criado_por_nome"] = current_user["nome"]
    
    # Update project status based on event type
    update_project = {}
    if event_data.tipo_evento == "pausa":
        update_project["status_projeto"] = "bloqueado"
    elif event_data.tipo_evento == "retoma":
        update_project["status_projeto"] = "ativo"
    elif event_data.tipo_evento == "conclusao":
        update_project["status_projeto"] = "concluido"
    elif event_data.tipo_evento == "problema":
        # Check if there are multiple active problems
        active_problems = await db.timeline_events.count_documents({
            "projeto_id": project_id,
            "tipo_evento": "problema",
            "resolvido": False
        })
        if active_problems >= 1:
            update_project["status_projeto"] = "atrasado"
    
    if update_project:
        update_project["atualizado_em"] = now.isoformat()
        await db.projects.update_one({"id": project_id}, {"$set": update_project})
    
    # Create history entry
    event_label = next((e["label"] for e in EVENT_TYPES if e["value"] == event_data.tipo_evento), event_data.tipo_evento)
    await create_history_entry(
        entidade="project",
        entidade_id=project_id,
        campo="timeline",
        valor_anterior=None,
        valor_novo=f"{event_label}: {event_data.descricao or 'Sem descrição'}",
        alterado_por=current_user["id"]
    )
    
    return event_doc


@router.patch("/{project_id}/event/{event_id}")
async def update_timeline_event(
    project_id: str,
    event_id: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update a timeline event (e.g., mark problem as resolved)"""
    event = await db.timeline_events.find_one(
        {"id": event_id, "projeto_id": project_id},
        {"_id": 0}
    )
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    allowed_fields = ["resolvido", "descricao", "impacto_dias"]
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if update_fields:
        await db.timeline_events.update_one(
            {"id": event_id},
            {"$set": update_fields}
        )
    
    # If resolving a problem, check if we should update project status
    if update_data.get("resolvido") and event.get("tipo_evento") == "problema":
        # Check remaining active problems
        remaining_problems = await db.timeline_events.count_documents({
            "projeto_id": project_id,
            "tipo_evento": "problema",
            "resolvido": False,
            "id": {"$ne": event_id}
        })
        if remaining_problems == 0:
            # No more active problems, set back to active
            await db.projects.update_one(
                {"id": project_id},
                {"$set": {"status_projeto": "ativo", "atualizado_em": datetime.now(timezone.utc).isoformat()}}
            )
        
        # Add resolved event
        await db.timeline_events.insert_one({
            "id": generate_id(),
            "projeto_id": project_id,
            "etapa_key": event.get("etapa_key"),
            "tipo_evento": "problema_resolvido",
            "tipo_problema": event.get("tipo_problema"),
            "descricao": f"Resolvido: {event.get('descricao', '')}",
            "resolvido": True,
            "criado_por": current_user["id"],
            "data_evento": datetime.now(timezone.utc).isoformat()
        })
    
    updated = await db.timeline_events.find_one({"id": event_id}, {"_id": 0})
    return updated


@router.delete("/{project_id}/event/{event_id}")
async def delete_timeline_event(
    project_id: str,
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a timeline event"""
    result = await db.timeline_events.delete_one(
        {"id": event_id, "projeto_id": project_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    
    return {"message": "Evento eliminado"}
