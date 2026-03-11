from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from models import StagePlanning, StagePlanningCreate, StagePlanningUpdate, StageStatus
from utils import db, get_current_user, generate_id, serialize_datetime, create_history_entry
from datetime import datetime, timezone, timedelta

router = APIRouter()

# Default planning stages (ordem fixa para planeamento)
PLANNING_STAGES = [
    {"key": "preparacao", "nome": "Preparação", "ordem": 1, "cor": "#3B82F6"},
    {"key": "corte", "nome": "Corte", "ordem": 2, "cor": "#8B5CF6"},
    {"key": "confecao", "nome": "Confeção", "ordem": 3, "cor": "#EC4899"},
    {"key": "lavandaria", "nome": "Lavandaria", "ordem": 4, "cor": "#14B8A6"},
    {"key": "acabamentos", "nome": "Acabamentos", "ordem": 5, "cor": "#F59E0B"},
    {"key": "fim", "nome": "Fim/Entrega", "ordem": 6, "cor": "#22C55E"}
]

# Default days per stage (can be customized)
DEFAULT_DAYS = {
    "preparacao": 3,
    "corte": 2,
    "confecao": 10,
    "lavandaria": 3,
    "acabamentos": 2,
    "fim": 0
}


def calculate_status(data_fim_prevista: datetime, data_fim_real: datetime = None) -> str:
    """Calculate stage status based on dates"""
    now = datetime.now(timezone.utc)
    
    if data_fim_real:
        # Stage completed
        if isinstance(data_fim_prevista, str):
            data_fim_prevista = datetime.fromisoformat(data_fim_prevista.replace('Z', '+00:00'))
        if isinstance(data_fim_real, str):
            data_fim_real = datetime.fromisoformat(data_fim_real.replace('Z', '+00:00'))
        
        # Ensure timezone awareness
        if data_fim_prevista.tzinfo is None:
            data_fim_prevista = data_fim_prevista.replace(tzinfo=timezone.utc)
        if data_fim_real.tzinfo is None:
            data_fim_real = data_fim_real.replace(tzinfo=timezone.utc)
        
        if data_fim_real <= data_fim_prevista:
            return "concluido"  # On time
        else:
            return "concluido_atrasado"  # Completed but late
    
    if isinstance(data_fim_prevista, str):
        data_fim_prevista = datetime.fromisoformat(data_fim_prevista.replace('Z', '+00:00'))
    
    # Ensure timezone awareness
    if data_fim_prevista.tzinfo is None:
        data_fim_prevista = data_fim_prevista.replace(tzinfo=timezone.utc)
    
    days_remaining = (data_fim_prevista - now).days
    
    if days_remaining < 0:
        return "atrasado"  # Red - overdue
    elif days_remaining <= 2:
        return "risco"  # Yellow - at risk
    else:
        return "dentro_prazo"  # Green - on track


@router.get("/stages")
async def get_planning_stages(current_user: dict = Depends(get_current_user)):
    """Get the list of planning stages"""
    return {
        "stages": PLANNING_STAGES,
        "default_days": DEFAULT_DAYS
    }


@router.get("/projects")
async def get_projects_for_planning(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get projects available for planning"""
    query = {}
    if search:
        query["$or"] = [
            {"of_numero": {"$regex": search, "$options": "i"}},
            {"modelo": {"$regex": search, "$options": "i"}}
        ]
    
    projects = await db.projects.find(
        query,
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, 
         "data_prevista_entrega": 1, "status_projeto": 1, "marca_id": 1,
         "comercial_responsavel_id": 1}
    ).sort("of_numero", -1).limit(100).to_list(100)
    
    # Check which projects have planning
    project_ids = [p["id"] for p in projects]
    planning_counts = {}
    
    for pid in project_ids:
        count = await db.stage_planning.count_documents({"projeto_id": pid})
        planning_counts[pid] = count
    
    # Get current stage for each project with planning
    for project in projects:
        project["has_planning"] = planning_counts.get(project["id"], 0) > 0
        
        if project["has_planning"]:
            # Get current active stage
            planning = await db.stage_planning.find(
                {"projeto_id": project["id"]},
                {"_id": 0, "etapa_key": 1, "nome": 1, "data_inicio_real": 1, "data_fim_real": 1}
            ).sort("ordem", 1).to_list(10)
            
            current_stage = None
            for p in planning:
                if p.get("data_inicio_real") and not p.get("data_fim_real"):
                    current_stage = p.get("nome")
                    break
            
            if not current_stage:
                for p in planning:
                    if not p.get("data_inicio_real"):
                        current_stage = p.get("nome")
                        break
            
            project["current_stage"] = current_stage or "Concluido"
    
    return projects


@router.get("/{project_id}")
async def get_project_planning(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get planning data for a specific project"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    # Get existing planning stages
    planning = await db.stage_planning.find(
        {"projeto_id": project_id},
        {"_id": 0}
    ).sort("ordem", 1).to_list(20)
    
    # Create a map of existing planning by stage key
    planning_map = {p.get("etapa_key"): p for p in planning}
    
    # Get system stages to map with planning stages
    system_stages = await db.stages.find({"ativa": True}, {"_id": 0}).to_list(100)
    
    # Create mapping from planning stage name to system stage ID
    # This allows checkpoints to be associated correctly
    stage_name_to_id = {}
    for s in system_stages:
        nome_lower = s["nome"].lower()
        # Map common names
        if "planear" in nome_lower or "preparação" in nome_lower or "material" in nome_lower:
            stage_name_to_id["preparacao"] = s["id"]
        elif "corte" in nome_lower:
            stage_name_to_id["corte"] = s["id"]
        elif "confec" in nome_lower or "confeção" in nome_lower:
            stage_name_to_id["confecao"] = s["id"]
        elif "lavand" in nome_lower:
            stage_name_to_id["lavandaria"] = s["id"]
        elif "acabament" in nome_lower:
            stage_name_to_id["acabamentos"] = s["id"]
        elif "conclu" in nome_lower or "fim" in nome_lower or "entrega" in nome_lower:
            stage_name_to_id["fim"] = s["id"]
    
    # Build full planning with all stages
    full_planning = []
    for stage in PLANNING_STAGES:
        existing = planning_map.get(stage["key"])
        
        # Get the corresponding system stage ID for checkpoints
        etapa_id = stage_name_to_id.get(stage["key"])
        
        if existing:
            # Calculate status
            if existing.get("data_fim_prevista"):
                existing["status_calculado"] = calculate_status(
                    existing["data_fim_prevista"],
                    existing.get("data_fim_real")
                )
            full_planning.append({**stage, **existing, "etapa_id": etapa_id})
        else:
            full_planning.append({
                **stage,
                "id": None,
                "projeto_id": project_id,
                "etapa_key": stage["key"],
                "etapa_id": etapa_id,  # System stage ID for checkpoints
                "data_inicio_prevista": None,
                "data_fim_prevista": None,
                "data_inicio_real": None,
                "data_fim_real": None,
                "dias_previstos": DEFAULT_DAYS.get(stage["key"], 0),
                "status_calculado": "nao_iniciado"
            })
    
    return {
        "project": project,
        "planning": full_planning
    }


@router.post("/calculate")
async def calculate_planning_dates(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Calculate suggested dates based on delivery date and confection date"""
    data_entrega = data.get("data_entrega")
    data_confecao = data.get("data_confecao")
    dias_por_etapa = data.get("dias_por_etapa", DEFAULT_DAYS)
    
    if not data_entrega:
        raise HTTPException(status_code=400, detail="Data de entrega é obrigatória")
    
    # Parse dates
    if isinstance(data_entrega, str):
        data_entrega = datetime.fromisoformat(data_entrega.replace('Z', '+00:00'))
    
    if data_confecao and isinstance(data_confecao, str):
        data_confecao = datetime.fromisoformat(data_confecao.replace('Z', '+00:00'))
    
    # Calculate backwards from delivery date
    result = {}
    
    # Fim/Entrega - ends on delivery date
    result["fim"] = {
        "data_inicio_prevista": data_entrega.isoformat(),
        "data_fim_prevista": data_entrega.isoformat(),
        "dias_previstos": 0
    }
    
    # Acabamentos - before Fim
    dias_acabamentos = dias_por_etapa.get("acabamentos", 2)
    data_fim_acabamentos = data_entrega - timedelta(days=1)
    data_inicio_acabamentos = data_fim_acabamentos - timedelta(days=dias_acabamentos - 1) if dias_acabamentos > 0 else data_fim_acabamentos
    result["acabamentos"] = {
        "data_inicio_prevista": data_inicio_acabamentos.isoformat(),
        "data_fim_prevista": data_fim_acabamentos.isoformat(),
        "dias_previstos": dias_acabamentos
    }
    
    # Lavandaria - before Acabamentos
    dias_lavandaria = dias_por_etapa.get("lavandaria", 3)
    data_fim_lavandaria = data_inicio_acabamentos - timedelta(days=1)
    data_inicio_lavandaria = data_fim_lavandaria - timedelta(days=dias_lavandaria - 1) if dias_lavandaria > 0 else data_fim_lavandaria
    result["lavandaria"] = {
        "data_inicio_prevista": data_inicio_lavandaria.isoformat(),
        "data_fim_prevista": data_fim_lavandaria.isoformat(),
        "dias_previstos": dias_lavandaria
    }
    
    # Confeção - use provided date or calculate
    dias_confecao = dias_por_etapa.get("confecao", 10)
    if data_confecao:
        data_fim_confecao = data_confecao
        data_inicio_confecao = data_confecao - timedelta(days=dias_confecao - 1) if dias_confecao > 0 else data_confecao
    else:
        data_fim_confecao = data_inicio_lavandaria - timedelta(days=1)
        data_inicio_confecao = data_fim_confecao - timedelta(days=dias_confecao - 1) if dias_confecao > 0 else data_fim_confecao
    result["confecao"] = {
        "data_inicio_prevista": data_inicio_confecao.isoformat(),
        "data_fim_prevista": data_fim_confecao.isoformat(),
        "dias_previstos": dias_confecao
    }
    
    # Corte - before Confeção
    dias_corte = dias_por_etapa.get("corte", 2)
    data_fim_corte = data_inicio_confecao - timedelta(days=1)
    data_inicio_corte = data_fim_corte - timedelta(days=dias_corte - 1) if dias_corte > 0 else data_fim_corte
    result["corte"] = {
        "data_inicio_prevista": data_inicio_corte.isoformat(),
        "data_fim_prevista": data_fim_corte.isoformat(),
        "dias_previstos": dias_corte
    }
    
    # Preparação - before Corte
    dias_preparacao = dias_por_etapa.get("preparacao", 3)
    data_fim_preparacao = data_inicio_corte - timedelta(days=1)
    data_inicio_preparacao = data_fim_preparacao - timedelta(days=dias_preparacao - 1) if dias_preparacao > 0 else data_fim_preparacao
    result["preparacao"] = {
        "data_inicio_prevista": data_inicio_preparacao.isoformat(),
        "data_fim_prevista": data_fim_preparacao.isoformat(),
        "dias_previstos": dias_preparacao
    }
    
    return result


@router.post("/{project_id}")
async def save_project_planning(
    project_id: str,
    planning_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Save planning for a project"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    stages = planning_data.get("stages", [])
    now = datetime.now(timezone.utc)
    
    saved_stages = []
    for stage_data in stages:
        etapa_key = stage_data.get("etapa_key") or stage_data.get("key")
        if not etapa_key:
            continue
        
        # Check if planning exists for this stage
        existing = await db.stage_planning.find_one(
            {"projeto_id": project_id, "etapa_key": etapa_key},
            {"_id": 0}
        )
        
        stage_info = next((s for s in PLANNING_STAGES if s["key"] == etapa_key), None)
        
        planning_doc = {
            "projeto_id": project_id,
            "etapa_key": etapa_key,
            "nome": stage_info["nome"] if stage_info else etapa_key,
            "ordem": stage_info["ordem"] if stage_info else 0,
            "cor": stage_info["cor"] if stage_info else "#64748B",
            "data_inicio_prevista": stage_data.get("data_inicio_prevista"),
            "data_fim_prevista": stage_data.get("data_fim_prevista"),
            "data_inicio_real": stage_data.get("data_inicio_real"),
            "data_fim_real": stage_data.get("data_fim_real"),
            "dias_previstos": stage_data.get("dias_previstos", 0),
            "observacoes": stage_data.get("observacoes"),
            "atualizado_em": now.isoformat()
        }
        
        if existing:
            # Update
            await db.stage_planning.update_one(
                {"id": existing["id"]},
                {"$set": planning_doc}
            )
            planning_doc["id"] = existing["id"]
        else:
            # Create
            planning_doc["id"] = generate_id()
            planning_doc["criado_em"] = now.isoformat()
            await db.stage_planning.insert_one(planning_doc)
        
        # Remove MongoDB _id if present
        planning_doc.pop("_id", None)
        
        # Calculate status
        if planning_doc.get("data_fim_prevista"):
            planning_doc["status_calculado"] = calculate_status(
                planning_doc["data_fim_prevista"],
                planning_doc.get("data_fim_real")
            )
        
        saved_stages.append(planning_doc)
    
    # Create history entry
    await create_history_entry(
        entidade="project",
        entidade_id=project_id,
        campo="planeamento",
        valor_anterior=None,
        valor_novo=f"Planeamento atualizado com {len(saved_stages)} etapas",
        alterado_por=current_user["id"]
    )
    
    return {
        "success": True,
        "project_id": project_id,
        "stages": saved_stages
    }


@router.patch("/{project_id}/stage/{stage_key}")
async def update_stage_real_dates(
    project_id: str,
    stage_key: str,
    update_data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update real dates for a specific stage"""
    existing = await db.stage_planning.find_one(
        {"projeto_id": project_id, "etapa_key": stage_key},
        {"_id": 0}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Planeamento de etapa não encontrado")
    
    now = datetime.now(timezone.utc)
    update_fields = {
        "atualizado_em": now.isoformat()
    }
    
    if "data_inicio_real" in update_data:
        update_fields["data_inicio_real"] = update_data["data_inicio_real"]
    if "data_fim_real" in update_data:
        update_fields["data_fim_real"] = update_data["data_fim_real"]
    if "observacoes" in update_data:
        update_fields["observacoes"] = update_data["observacoes"]
    
    await db.stage_planning.update_one(
        {"id": existing["id"]},
        {"$set": update_fields}
    )
    
    # Calculate new status
    data_fim_prevista = existing.get("data_fim_prevista")
    data_fim_real = update_data.get("data_fim_real") or existing.get("data_fim_real")
    status = calculate_status(data_fim_prevista, data_fim_real) if data_fim_prevista else "nao_iniciado"
    
    # Create history entry
    await create_history_entry(
        entidade="project",
        entidade_id=project_id,
        campo=f"etapa_{stage_key}",
        valor_anterior=str(existing.get("data_fim_real")),
        valor_novo=str(update_data.get("data_fim_real")),
        alterado_por=current_user["id"]
    )
    
    return {
        "success": True,
        "stage_key": stage_key,
        "status_calculado": status,
        **update_fields
    }
