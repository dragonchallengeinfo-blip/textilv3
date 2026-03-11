from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from utils import db, get_current_user, deserialize_datetime
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("/dashboard")
async def get_operator_dashboard(current_user: dict = Depends(get_current_user)):
    """
    Dashboard simplificado para operadores.
    Mostra projetos ativos, checkpoints pendentes e estatísticas básicas.
    """
    user_role = current_user.get("role", "")
    user_id = current_user.get("id", "")
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get active projects (limited view for operators)
    projects_query = {"status_projeto": {"$in": ["ativo", "atrasado"]}}
    
    # If operator role, filter by their assigned confeccao or stage
    projects = await db.projects.find(projects_query, {"_id": 0}).to_list(500)
    projects = deserialize_datetime(projects)
    
    # Get stages and partners for enrichment
    stages = {s["id"]: s async for s in db.stages.find({}, {"_id": 0})}
    partners = {p["id"]: p async for p in db.partners.find({}, {"_id": 0})}
    
    # Enrich projects
    enriched_projects = []
    for p in projects[:50]:  # Limit to 50 for operator view
        stage = stages.get(p.get("etapa_atual_id"))
        partner = partners.get(p.get("parceiro_confeccao_id"))
        
        enriched_projects.append({
            "id": p["id"],
            "of_numero": p.get("of_numero"),
            "modelo": p.get("modelo"),
            "quantidade": p.get("quantidade"),
            "etapa_atual": stage.get("nome") if stage else None,
            "etapa_cor": stage.get("cor_identificacao") if stage else None,
            "confeccao": partner.get("nome") if partner else None,
            "status": p.get("status_projeto"),
            "progresso": p.get("progresso_percentagem", 0),
            "data_prevista_entrega": p.get("data_prevista_entrega"),
            "dias_restantes": _calc_days_remaining(p.get("data_prevista_entrega"))
        })
    
    # Sort by urgency (days remaining)
    enriched_projects.sort(key=lambda x: x.get("dias_restantes") or 999)
    
    # Get pending checkpoints
    checkpoint_responses = await db.checkpoint_responses.find(
        {"valor": {"$in": [None, ""]}},
        {"_id": 0}
    ).to_list(100)
    
    checkpoints = {c["id"]: c async for c in db.checkpoints.find({}, {"_id": 0})}
    
    pending_checkpoints = []
    for cr in checkpoint_responses[:20]:
        cp = checkpoints.get(cr.get("checkpoint_id"))
        if cp and cp.get("obrigatorio"):
            # Find project
            project = await db.projects.find_one(
                {"id": cr.get("projeto_id")},
                {"_id": 0, "of_numero": 1, "modelo": 1}
            )
            if project:
                pending_checkpoints.append({
                    "checkpoint_id": cr.get("checkpoint_id"),
                    "checkpoint_nome": cp.get("nome"),
                    "projeto_id": cr.get("projeto_id"),
                    "projeto_of": project.get("of_numero"),
                    "projeto_modelo": project.get("modelo"),
                    "obrigatorio": cp.get("obrigatorio", False)
                })
    
    # Quick stats
    total_ativos = len([p for p in projects if p.get("status_projeto") == "ativo"])
    total_atrasados = len([p for p in projects if p.get("status_projeto") == "atrasado"])
    urgentes = len([p for p in enriched_projects if (p.get("dias_restantes") or 999) <= 3])
    
    return {
        "user": {
            "nome": current_user.get("nome"),
            "role": current_user.get("role")
        },
        "stats": {
            "total_ativos": total_ativos,
            "total_atrasados": total_atrasados,
            "urgentes": urgentes,
            "checkpoints_pendentes": len(pending_checkpoints)
        },
        "projects": enriched_projects,
        "pending_checkpoints": pending_checkpoints,
        "timestamp": now.isoformat()
    }


@router.get("/confeccao/{confeccao_id}/projects")
async def get_confeccao_projects(
    confeccao_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all projects for a specific confeccao with simplified view"""
    
    # Verify confeccao exists
    confeccao = await db.partners.find_one({"id": confeccao_id}, {"_id": 0})
    if not confeccao:
        raise HTTPException(status_code=404, detail="Confecção não encontrada")
    
    # Get projects
    projects = await db.projects.find(
        {"parceiro_confeccao_id": confeccao_id},
        {"_id": 0}
    ).to_list(1000)
    projects = deserialize_datetime(projects)
    
    # Get stages for enrichment
    stages = {s["id"]: s async for s in db.stages.find({}, {"_id": 0})}
    brands = {b["id"]: b async for b in db.brands.find({}, {"_id": 0})}
    
    # Enrich and simplify
    result = []
    for p in projects:
        stage = stages.get(p.get("etapa_atual_id"))
        brand = brands.get(p.get("marca_id"))
        
        result.append({
            "id": p["id"],
            "of_numero": p.get("of_numero"),
            "modelo": p.get("modelo"),
            "quantidade": p.get("quantidade"),
            "marca": brand.get("nome") if brand else None,
            "etapa_atual": stage.get("nome") if stage else None,
            "etapa_cor": stage.get("cor_identificacao") if stage else None,
            "status": p.get("status_projeto"),
            "progresso": p.get("progresso_percentagem", 0),
            "data_encomenda": p.get("data_encomenda"),
            "data_prevista_entrega": p.get("data_prevista_entrega"),
            "data_entrada_confecao": p.get("data_entrada_confecao"),
            "dias_restantes": _calc_days_remaining(p.get("data_prevista_entrega"))
        })
    
    # Sort by delivery date
    result.sort(key=lambda x: x.get("data_prevista_entrega") or "9999")
    
    # Stats
    total_pecas = sum(p.get("quantidade", 0) for p in result)
    ativos = len([p for p in result if p.get("status") == "ativo"])
    atrasados = len([p for p in result if p.get("status") == "atrasado"])
    concluidos = len([p for p in result if p.get("status") == "concluido"])
    
    return {
        "confeccao": confeccao,
        "stats": {
            "total_projetos": len(result),
            "total_pecas": total_pecas,
            "ativos": ativos,
            "atrasados": atrasados,
            "concluidos": concluidos
        },
        "projects": result
    }


@router.get("/my-tasks")
async def get_operator_tasks(current_user: dict = Depends(get_current_user)):
    """Get tasks/checkpoints assigned to current user or their role"""
    
    # Get checkpoints that need attention
    all_checkpoints = await db.checkpoints.find(
        {"obrigatorio": True},
        {"_id": 0}
    ).to_list(100)
    
    checkpoint_ids = [c["id"] for c in all_checkpoints]
    
    # Get pending responses
    pending = await db.checkpoint_responses.find(
        {
            "checkpoint_id": {"$in": checkpoint_ids},
            "$or": [
                {"valor": None},
                {"valor": ""}
            ]
        },
        {"_id": 0}
    ).to_list(200)
    
    checkpoints_map = {c["id"]: c for c in all_checkpoints}
    
    # Enrich with project info
    tasks = []
    for pr in pending:
        cp = checkpoints_map.get(pr.get("checkpoint_id"))
        if not cp:
            continue
            
        project = await db.projects.find_one(
            {"id": pr.get("projeto_id")},
            {"_id": 0, "of_numero": 1, "modelo": 1, "status_projeto": 1, "data_prevista_entrega": 1}
        )
        
        if project and project.get("status_projeto") in ["ativo", "atrasado"]:
            tasks.append({
                "tipo": "checkpoint",
                "checkpoint_id": pr.get("checkpoint_id"),
                "checkpoint_nome": cp.get("nome"),
                "checkpoint_tipo": cp.get("tipo_resposta"),
                "projeto_id": pr.get("projeto_id"),
                "projeto_of": project.get("of_numero"),
                "projeto_modelo": project.get("modelo"),
                "urgente": project.get("status_projeto") == "atrasado",
                "data_entrega": project.get("data_prevista_entrega")
            })
    
    # Sort by urgency
    tasks.sort(key=lambda x: (not x.get("urgente"), x.get("data_entrega") or "9999"))
    
    return {
        "total_tarefas": len(tasks),
        "tarefas": tasks[:50]  # Limit to 50
    }


def _calc_days_remaining(date_str: str) -> Optional[int]:
    """Calculate days remaining until date"""
    if not date_str:
        return None
    try:
        target = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        diff = (target - now).days
        return diff
    except:
        return None
