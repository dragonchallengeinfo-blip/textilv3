from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import Alert, AlertCreate
from utils import db, get_current_user, generate_id, deserialize_datetime
from datetime import datetime, timezone, timedelta

router = APIRouter()


async def create_automatic_alert(projeto_id: str, tipo: str, mensagem: str, prioridade: str = "media"):
    """Helper function to create automatic alerts"""
    now = datetime.now(timezone.utc)
    
    # Check if similar alert already exists (not resolved)
    existing = await db.alerts.find_one({
        "projeto_id": projeto_id,
        "tipo": tipo,
        "resolvido": False
    })
    
    if existing:
        return None  # Don't create duplicate alerts
    
    alert_doc = {
        "id": generate_id(),
        "projeto_id": projeto_id,
        "tipo": tipo,
        "mensagem": mensagem,
        "prioridade": prioridade,
        "visto": False,
        "resolvido": False,
        "criado_em": now.isoformat(),
        "automatico": True
    }
    
    await db.alerts.insert_one(alert_doc)
    return alert_doc


@router.post("/check-delays")
async def check_project_delays(current_user: dict = Depends(get_current_user)):
    """Check all projects for delays and create automatic alerts"""
    now = datetime.now(timezone.utc)
    alerts_created = []
    
    # Get all active projects
    projects = await db.projects.find({
        "status_projeto": {"$in": ["ativo", "atrasado", "bloqueado"]}
    }, {"_id": 0}).to_list(1000)
    
    for project in projects:
        # Check if delivery date is approaching or passed
        if project.get("data_prevista_entrega"):
            delivery_date = datetime.fromisoformat(project["data_prevista_entrega"].replace('Z', '+00:00'))
            days_until = (delivery_date - now).days
            
            # Alert: Delivery in less than 7 days
            if 0 < days_until <= 7:
                alert = await create_automatic_alert(
                    project["id"],
                    "entrega_proxima",
                    f"Entrega prevista em {days_until} dias para OF {project['of_numero']}",
                    "alta" if days_until <= 3 else "media"
                )
                if alert:
                    alerts_created.append(alert)
            
            # Alert: Delivery date passed
            elif days_until < 0:
                alert = await create_automatic_alert(
                    project["id"],
                    "entrega_atrasada",
                    f"OF {project['of_numero']} passou da data de entrega há {abs(days_until)} dias",
                    "alta"
                )
                if alert:
                    alerts_created.append(alert)
                
                # Update project status to delayed
                if project.get("status_projeto") != "atrasado":
                    await db.projects.update_one(
                        {"id": project["id"]},
                        {"$set": {"status_projeto": "atrasado"}}
                    )
        
        # Check stage planning for delays
        stage_planning = await db.stage_planning.find({
            "projeto_id": project["id"]
        }, {"_id": 0}).to_list(100)
        
        for stage in stage_planning:
            if stage.get("data_fim_prevista") and stage.get("status_etapa") not in ["concluido", "nao_iniciado"]:
                stage_end_str = stage["data_fim_prevista"]
                # Handle timezone-aware datetime parsing
                if stage_end_str.endswith('Z'):
                    stage_end_str = stage_end_str.replace('Z', '+00:00')
                stage_end = datetime.fromisoformat(stage_end_str)
                # Make sure both datetimes are timezone-aware for comparison
                if stage_end.tzinfo is None:
                    stage_end = stage_end.replace(tzinfo=timezone.utc)
                
                days_late = (now - stage_end).days
                
                if days_late > 0:
                    # Get stage name
                    stage_info = await db.stages.find_one({"id": stage.get("etapa_id")}, {"_id": 0})
                    stage_name = stage_info.get("nome", "Etapa") if stage_info else "Etapa"
                    
                    alert = await create_automatic_alert(
                        project["id"],
                        "etapa_atrasada",
                        f"Etapa '{stage_name}' da OF {project['of_numero']} está atrasada {days_late} dias",
                        "alta" if days_late > 3 else "media"
                    )
                    if alert:
                        alerts_created.append(alert)
    
    return {
        "checked_projects": len(projects),
        "alerts_created": len(alerts_created),
        "alerts": alerts_created
    }


@router.post("/check-capacity")
async def check_capacity_alerts(current_user: dict = Depends(get_current_user)):
    """Check partner capacity and create alerts for overload"""
    alerts_created = []
    
    # Get all active partners with capacity info
    partners = await db.partners.find({
        "ativo": True,
        "capacidade_pecas_mes": {"$exists": True, "$gt": 0}
    }, {"_id": 0}).to_list(100)
    
    for partner in partners:
        # Count active projects for this partner
        active_projects = await db.projects.find({
            "parceiro_confeccao_id": partner["id"],
            "status_projeto": {"$in": ["ativo", "atrasado"]}
        }, {"_id": 0}).to_list(100)
        
        total_pieces = sum(p.get("quantidade", 0) for p in active_projects)
        capacity = partner.get("capacidade_pecas_mes", 0)
        
        if capacity > 0:
            usage_percent = (total_pieces / capacity) * 100
            
            if usage_percent > 100:
                alert = await create_automatic_alert(
                    partner["id"],
                    "capacidade_excedida",
                    f"Parceiro {partner['nome']} está com {int(usage_percent)}% de capacidade ({total_pieces}/{capacity} peças)",
                    "alta"
                )
                if alert:
                    alerts_created.append(alert)
            elif usage_percent > 80:
                alert = await create_automatic_alert(
                    partner["id"],
                    "capacidade_alta",
                    f"Parceiro {partner['nome']} está com {int(usage_percent)}% de capacidade",
                    "media"
                )
                if alert:
                    alerts_created.append(alert)
    
    return {
        "checked_partners": len(partners),
        "alerts_created": len(alerts_created),
        "alerts": alerts_created
    }


@router.get("/summary")
async def get_alerts_summary(current_user: dict = Depends(get_current_user)):
    """Get summary of alerts"""
    total = await db.alerts.count_documents({})
    unread = await db.alerts.count_documents({"visto": False})
    unresolved = await db.alerts.count_documents({"resolvido": False})
    high_priority = await db.alerts.count_documents({"prioridade": "alta", "resolvido": False})
    
    # By type
    pipeline = [
        {"$match": {"resolvido": False}},
        {"$group": {"_id": "$tipo", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    by_type = []
    async for doc in db.alerts.aggregate(pipeline):
        by_type.append({"tipo": doc["_id"], "count": doc["count"]})
    
    return {
        "total": total,
        "unread": unread,
        "unresolved": unresolved,
        "high_priority": high_priority,
        "by_type": by_type
    }


@router.get("/", response_model=List[Alert])
async def get_alerts(
    projeto_id: str = None,
    visto: bool = None,
    resolvido: bool = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if projeto_id:
        query["projeto_id"] = projeto_id
    if visto is not None:
        query["visto"] = visto
    if resolvido is not None:
        query["resolvido"] = resolvido
    
    alerts = await db.alerts.find(query, {"_id": 0}).sort("criado_em", -1).to_list(500)
    return deserialize_datetime(alerts)

@router.post("/", response_model=Alert)
async def create_alert(alert: AlertCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    alert_dict = alert.model_dump()
    
    alert_doc = {
        **alert_dict,
        "id": generate_id(),
        "criado_em": now.isoformat()
    }
    
    await db.alerts.insert_one(alert_doc)
    
    alert_doc['criado_em'] = now
    
    return alert_doc

@router.put("/{alert_id}/mark-seen")
async def mark_alert_seen(alert_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.alerts.update_one({"id": alert_id}, {"$set": {"visto": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    return {"message": "Alerta marcado como visto"}

@router.put("/{alert_id}/mark-resolved")
async def mark_alert_resolved(alert_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.alerts.update_one({"id": alert_id}, {"$set": {"resolvido": True, "visto": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    return {"message": "Alerta marcado como resolvido"}

@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.alerts.delete_one({"id": alert_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    return {"message": "Alerta eliminado"}
