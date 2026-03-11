from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from utils import db, get_current_user, get_user_permissions, build_project_filter_for_user
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/", response_model=Dict[str, Any])
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    """
    Dashboard otimizado com agregações MongoDB
    - Filtra dados baseado nas permissões do utilizador
    - Reduz N+1 queries para agregações únicas
    - Usa índices compostos
    - Projeções específicas
    """
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    week_end = now + timedelta(days=7)
    
    # Get user permissions and build project filter
    user_perms = await get_user_permissions(current_user)
    project_filter = await build_project_filter_for_user(current_user)
    
    # ========== AGREGAÇÃO ÚNICA PARA CONTAGENS POR STATUS ==========
    # Substitui 5 count_documents por 1 aggregation
    status_pipeline = [
        {"$match": project_filter},
        {"$group": {"_id": "$status_projeto", "count": {"$sum": 1}}}
    ]
    status_counts = {}
    async for doc in db.projects.aggregate(status_pipeline):
        status_counts[doc["_id"]] = doc["count"]
    
    total_projects = sum(status_counts.values())
    active_projects = status_counts.get("ativo", 0)
    delayed_projects = status_counts.get("atrasado", 0)
    blocked_projects = status_counts.get("bloqueado", 0)
    completed_projects = status_counts.get("concluido", 0)
    
    # ========== AGREGAÇÃO PARA PROJETOS POR ETAPA ==========
    stages = await db.stages.find({"ativa": True}, {"_id": 0}).sort("ordem", 1).to_list(100)
    stage_ids = [s["id"] for s in stages]
    
    stage_pipeline = [
        {"$match": {**project_filter, "etapa_atual_id": {"$in": stage_ids}}},
        {"$group": {"_id": "$etapa_atual_id", "count": {"$sum": 1}}}
    ]
    stage_counts = {}
    async for doc in db.projects.aggregate(stage_pipeline):
        stage_counts[doc["_id"]] = doc["count"]
    
    projects_by_stage = []
    seen_stages = set()
    for stage in stages:
        if stage["nome"] not in seen_stages:
            seen_stages.add(stage["nome"])
            projects_by_stage.append({
                "stage_id": stage["id"],
                "stage_name": stage["nome"],
                "count": stage_counts.get(stage["id"], 0),
                "color": stage.get("cor_identificacao", "#64748B")
            })
    
    # ========== QUERIES PARALELAS OTIMIZADAS ==========
    # New projects (last 7 days) - com projeção específica
    new_filter = {**project_filter, "criado_em": {"$gte": week_ago.isoformat()}}
    new_projects = await db.projects.find(
        new_filter,
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, "criado_em": 1, "status_projeto": 1}
    ).sort("criado_em", -1).limit(5).to_list(5)
    new_projects_count = await db.projects.count_documents(new_filter)
    
    # Projects without confecao assigned - índice composto (parceiro_confeccao_id, status_projeto)
    sem_confeccao_query = {
        **project_filter,
        "parceiro_confeccao_id": {"$in": [None, ""]},
        "status_projeto": {"$nin": ["concluido", "cancelado"]}
    }
    projects_sem_confeccao = await db.projects.find(
        sem_confeccao_query,
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, "data_prevista_entrega": 1, "progresso_percentagem": 1}
    ).sort("data_prevista_entrega", 1).limit(10).to_list(10)
    projects_sem_confeccao_count = await db.projects.count_documents(sem_confeccao_query)
    
    # ========== PROJETOS SEM CUSTO PEÇA - AGREGAÇÃO COM LOOKUP ==========
    # Substitui lógica manual por aggregation
    sem_custo_pipeline = [
        {"$match": {**project_filter, "status_projeto": {"$nin": ["concluido", "cancelado"]}}},
        {
            "$lookup": {
                "from": "piece_cost_calculations",
                "let": {"projeto_id": "$id"},
                "pipeline": [
                    {"$match": {"$expr": {"$and": [
                        {"$eq": ["$projeto_id", "$$projeto_id"]},
                        {"$eq": ["$confirmado", True]}
                    ]}}}
                ],
                "as": "custo_confirmado"
            }
        },
        {"$match": {"custo_confirmado": {"$size": 0}}},
        {"$project": {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1}},
        {"$limit": 10}
    ]
    
    projects_sem_custo_peca = []
    async for doc in db.projects.aggregate(sem_custo_pipeline):
        projects_sem_custo_peca.append(doc)
    
    # Contagem separada (mais eficiente)
    sem_custo_count_pipeline = [
        {"$match": {**project_filter, "status_projeto": {"$nin": ["concluido", "cancelado"]}}},
        {
            "$lookup": {
                "from": "piece_cost_calculations",
                "let": {"projeto_id": "$id"},
                "pipeline": [
                    {"$match": {"$expr": {"$and": [
                        {"$eq": ["$projeto_id", "$$projeto_id"]},
                        {"$eq": ["$confirmado", True]}
                    ]}}}
                ],
                "as": "custo_confirmado"
            }
        },
        {"$match": {"custo_confirmado": {"$size": 0}}},
        {"$count": "total"}
    ]
    
    projects_sem_custo_peca_count = 0
    async for doc in db.projects.aggregate(sem_custo_count_pipeline):
        projects_sem_custo_peca_count = doc.get("total", 0)
    
    # Delayed projects with details
    delayed_filter = {**project_filter, "status_projeto": "atrasado"}
    delayed_projects_list = await db.projects.find(
        delayed_filter,
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, "data_prevista_entrega": 1, "progresso_percentagem": 1}
    ).sort("data_prevista_entrega", 1).limit(10).to_list(10)
    
    # Deliveries this week - projeção limitada
    deliveries_filter = {
        **project_filter,
        "data_prevista_entrega": {
            "$gte": now.isoformat(),
            "$lte": week_end.isoformat()
        }
    }
    deliveries_this_week = await db.projects.find(
        deliveries_filter,
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, "data_prevista_entrega": 1, "status_projeto": 1}
    ).sort("data_prevista_entrega", 1).limit(20).to_list(20)
    
    # Upcoming confecao entries
    confeccao_filter = {
        **project_filter,
        "data_entrada_confecao": {
            "$gte": now.isoformat(),
            "$lte": (now + timedelta(days=14)).isoformat()
        },
        "status_projeto": {"$nin": ["concluido", "cancelado"]}
    }
    confeccao_entries = await db.projects.find(
        confeccao_filter,
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, "data_entrada_confecao": 1, "parceiro_confeccao_id": 1}
    ).sort("data_entrada_confecao", 1).limit(10).to_list(10)
    
    # Enrich with partner names (cache-friendly - poucas entidades)
    partners_map = {}
    partners = await db.partners.find({}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    for p in partners:
        partners_map[p["id"]] = p["nome"]
    
    for entry in confeccao_entries:
        entry["parceiro_nome"] = partners_map.get(entry.get("parceiro_confeccao_id"), "Não atribuído")
    
    # Recent alerts (unread) - usa índice composto (visto, criado_em)
    recent_alerts = await db.alerts.find(
        {"visto": False},
        {"_id": 0}
    ).sort("criado_em", -1).limit(10).to_list(10)
    alerts_count = await db.alerts.count_documents({"visto": False})
    
    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "delayed_projects": delayed_projects,
        "blocked_projects": blocked_projects,
        "completed_projects": completed_projects,
        "new_projects_count": new_projects_count,
        "new_projects": new_projects,
        "projects_by_stage": projects_by_stage,
        "deliveries_this_week": deliveries_this_week,
        "recent_alerts": recent_alerts,
        "alerts_count": alerts_count,
        "delayed_projects_list": delayed_projects_list,
        "confeccao_entries": confeccao_entries,
        "projects_sem_confeccao": projects_sem_confeccao,
        "projects_sem_confeccao_count": projects_sem_confeccao_count,
        "projects_sem_custo_peca": projects_sem_custo_peca,
        "projects_sem_custo_peca_count": projects_sem_custo_peca_count
    }
