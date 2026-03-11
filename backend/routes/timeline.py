from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from models import TimelineEvent, TimelineEventCreate, TimelineEventType, ProblemType
from utils import db, get_current_user, generate_id, create_history_entry
from datetime import datetime, timezone, timedelta

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


# ==================== TIMELINE COMPLETA (TODOS OS EVENTOS) ====================

@router.get("/{project_id}/complete")
async def get_complete_timeline(
    project_id: str,
    filtro_tipo: Optional[str] = Query(None, description="Filtrar por tipo: timeline, history, checkpoint, stage"),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtém timeline COMPLETA do projeto incluindo:
    - Eventos manuais da timeline (pausas, problemas, notas)
    - Histórico de alterações (mudanças de campos)
    - Respostas de checkpoints
    - Mudanças de etapa
    """
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    # Carregar dados de referência
    users = await db.users.find({}, {"_id": 0, "id": 1, "nome": 1, "email": 1}).to_list(100)
    users_map = {u["id"]: u for u in users}
    
    stages = await db.stages.find({}, {"_id": 0, "id": 1, "nome": 1, "cor_identificacao": 1}).to_list(50)
    stages_map = {s["id"]: s for s in stages}
    
    checkpoints = await db.checkpoints.find({}, {"_id": 0}).to_list(200)
    checkpoints_map = {c["id"]: c for c in checkpoints}
    
    all_events = []
    
    # 1. EVENTOS DA TIMELINE (pausas, problemas, notas, etc)
    if not filtro_tipo or filtro_tipo == "timeline":
        timeline_events = await db.timeline_events.find(
            {"projeto_id": project_id},
            {"_id": 0}
        ).to_list(500)
        
        for event in timeline_events:
            user = users_map.get(event.get("criado_por"), {})
            event_type_info = next((e for e in EVENT_TYPES if e["value"] == event.get("tipo_evento")), None)
            problem_type_info = next((p for p in PROBLEM_TYPES if p["value"] == event.get("tipo_problema")), None)
            
            all_events.append({
                "id": event["id"],
                "source": "timeline",
                "tipo": event.get("tipo_evento"),
                "tipo_label": event_type_info["label"] if event_type_info else event.get("tipo_evento"),
                "tipo_cor": event_type_info["color"] if event_type_info else "#64748B",
                "tipo_icon": event_type_info["icon"] if event_type_info else "message",
                "subtipo": event.get("tipo_problema"),
                "subtipo_label": problem_type_info["label"] if problem_type_info else None,
                "descricao": event.get("descricao"),
                "impacto_dias": event.get("impacto_dias", 0),
                "resolvido": event.get("resolvido", False),
                "data": event.get("data_evento"),
                "autor_id": event.get("criado_por"),
                "autor_nome": user.get("nome", "Sistema"),
                "autor_email": user.get("email"),
                "etapa_key": event.get("etapa_key"),
                "importancia": "alta" if event.get("tipo_evento") in ["problema", "pausa", "conclusao"] else "normal"
            })
    
    # 2. HISTÓRICO DE ALTERAÇÕES
    if not filtro_tipo or filtro_tipo == "history":
        history_entries = await db.history.find(
            {"entidade": "project", "entidade_id": project_id},
            {"_id": 0}
        ).to_list(500)
        
        # Labels amigáveis para campos
        field_labels = {
            "status_projeto": "Estado do Projeto",
            "etapa_atual_id": "Etapa Atual",
            "progresso_percentagem": "Progresso",
            "data_prevista_entrega": "Data Prevista Entrega",
            "data_entrada_confecao": "Data Entrada Confecção",
            "parceiro_confeccao_id": "Parceiro Confecção",
            "quantidade": "Quantidade",
            "modelo": "Modelo",
            "timeline": "Timeline",
            "anexo_adicionado": "Anexo Adicionado",
            "anexo_eliminado": "Anexo Eliminado"
        }
        
        for entry in history_entries:
            user = users_map.get(entry.get("alterado_por"), {})
            campo = entry.get("campo", "")
            
            # Traduzir valores de etapa
            valor_anterior = entry.get("valor_anterior")
            valor_novo = entry.get("valor_novo")
            
            if campo == "etapa_atual_id":
                if valor_anterior and valor_anterior in stages_map:
                    valor_anterior = stages_map[valor_anterior]["nome"]
                if valor_novo and valor_novo in stages_map:
                    valor_novo = stages_map[valor_novo]["nome"]
            
            # Determinar importância
            importancia = "normal"
            if campo in ["status_projeto", "etapa_atual_id"]:
                importancia = "alta"
            elif campo == "timeline":
                importancia = "media"
            
            all_events.append({
                "id": entry["id"],
                "source": "history",
                "tipo": "alteracao",
                "tipo_label": field_labels.get(campo, campo.replace("_", " ").title()),
                "tipo_cor": "#6366F1",  # Indigo
                "tipo_icon": "edit",
                "campo": campo,
                "valor_anterior": valor_anterior,
                "valor_novo": valor_novo,
                "descricao": f"{field_labels.get(campo, campo)}: {valor_anterior or '(vazio)'} → {valor_novo or '(vazio)'}",
                "data": entry.get("data"),
                "autor_id": entry.get("alterado_por"),
                "autor_nome": user.get("nome", "Sistema"),
                "autor_email": user.get("email"),
                "importancia": importancia
            })
    
    # 3. RESPOSTAS DE CHECKPOINTS
    if not filtro_tipo or filtro_tipo == "checkpoint":
        checkpoint_responses = await db.checkpoint_responses.find(
            {"projeto_id": project_id},
            {"_id": 0}
        ).to_list(500)
        
        for response in checkpoint_responses:
            checkpoint = checkpoints_map.get(response.get("checkpoint_id"), {})
            user = users_map.get(response.get("respondido_por"), {})
            stage = stages_map.get(checkpoint.get("etapa_id"), {})
            
            # Formatar valor conforme tipo
            valor = response.get("valor")
            tipo_resposta = checkpoint.get("tipo_resposta", "texto")
            if tipo_resposta == "checkbox":
                valor_formatado = "Sim" if valor == "true" or valor is True else "Não"
            elif tipo_resposta == "data":
                valor_formatado = valor[:10] if valor else "-"
            else:
                valor_formatado = str(valor) if valor else "-"
            
            all_events.append({
                "id": response["id"],
                "source": "checkpoint",
                "tipo": "checkpoint",
                "tipo_label": "Checkpoint",
                "tipo_cor": "#10B981",  # Emerald
                "tipo_icon": "check-square",
                "checkpoint_nome": checkpoint.get("nome", "Checkpoint"),
                "checkpoint_tipo": tipo_resposta,
                "etapa_nome": stage.get("nome", ""),
                "etapa_cor": stage.get("cor_identificacao"),
                "valor": valor_formatado,
                "descricao": f"{checkpoint.get('nome', 'Checkpoint')}: {valor_formatado}",
                "data": response.get("data_resposta"),
                "autor_id": response.get("respondido_por"),
                "autor_nome": user.get("nome", "Sistema"),
                "autor_email": user.get("email"),
                "importancia": "normal"
            })
    
    # 4. EVENTO DE CRIAÇÃO DO PROJETO
    if not filtro_tipo or filtro_tipo == "history":
        criador = users_map.get(project.get("criado_por"), {})
        all_events.append({
            "id": f"created-{project_id}",
            "source": "system",
            "tipo": "criacao",
            "tipo_label": "Projeto Criado",
            "tipo_cor": "#22C55E",  # Green
            "tipo_icon": "plus-circle",
            "descricao": f"Projeto {project.get('of_numero')} criado",
            "data": project.get("criado_em"),
            "autor_id": project.get("criado_por"),
            "autor_nome": criador.get("nome", "Sistema"),
            "autor_email": criador.get("email"),
            "importancia": "alta"
        })
    
    # Ordenar por data (mais recente primeiro)
    all_events.sort(key=lambda x: x.get("data") or "", reverse=True)
    
    # Agrupar por data
    grouped_by_date = {}
    for event in all_events:
        event_date = event.get("data", "")[:10] if event.get("data") else "Sem data"
        if event_date not in grouped_by_date:
            grouped_by_date[event_date] = []
        grouped_by_date[event_date].append(event)
    
    # Estatísticas
    stats = {
        "total_eventos": len(all_events),
        "por_fonte": {
            "timeline": len([e for e in all_events if e["source"] == "timeline"]),
            "history": len([e for e in all_events if e["source"] == "history"]),
            "checkpoint": len([e for e in all_events if e["source"] == "checkpoint"]),
            "system": len([e for e in all_events if e["source"] == "system"])
        },
        "problemas_ativos": len([e for e in all_events if e.get("tipo") == "problema" and not e.get("resolvido")]),
        "checkpoints_respondidos": len([e for e in all_events if e["source"] == "checkpoint"]),
        "total_alteracoes": len([e for e in all_events if e["source"] == "history"]),
        "ultima_atividade": all_events[0].get("data") if all_events else None,
        "autores_unicos": len(set(e.get("autor_id") for e in all_events if e.get("autor_id")))
    }
    
    # Info do projeto
    projeto_info = {
        "id": project.get("id"),
        "of_numero": project.get("of_numero"),
        "modelo": project.get("modelo"),
        "status": project.get("status_projeto"),
        "progresso": project.get("progresso_percentagem", 0),
        "data_criacao": project.get("criado_em"),
        "data_entrega": project.get("data_prevista_entrega")
    }
    
    return {
        "projeto": projeto_info,
        "eventos": all_events,
        "eventos_por_data": grouped_by_date,
        "estatisticas": stats
    }
