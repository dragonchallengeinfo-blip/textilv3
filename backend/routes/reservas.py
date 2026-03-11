from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from utils import db, get_current_user, generate_id, deserialize_datetime
from datetime import datetime, timezone, timedelta
import asyncio

router = APIRouter()


# ==================== MODELS ====================

class ReservaCreate(BaseModel):
    confeccao_id: str
    projeto_id: Optional[str] = None
    descricao: str
    quantidade_pecas: int
    tempo_peca: float = 1.2
    data_inicio: str
    data_fim: str
    prioridade: str = "media"  # baixa, media, alta
    status: str = "pendente"  # pendente, confirmada, cancelada

class ReservaUpdate(BaseModel):
    confeccao_id: Optional[str] = None
    descricao: Optional[str] = None
    quantidade_pecas: Optional[int] = None
    tempo_peca: Optional[float] = None
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None

class NotificationCreate(BaseModel):
    tipo: str  # sobrecarga, conflito, prazo, capacidade
    titulo: str
    mensagem: str
    entidade_tipo: Optional[str] = None  # confeccao, projeto, reserva
    entidade_id: Optional[str] = None
    prioridade: str = "media"  # baixa, media, alta, critica


# ==================== NEGOCIACOES MODEL ====================

class NegociacaoCreate(BaseModel):
    projeto_id: Optional[str] = None
    confeccao_id: str
    quantidade_pecas: int
    tempo_peca_estimado: float = 1.2
    data_inicio_pretendida: Optional[str] = None
    data_fim_pretendida: Optional[str] = None
    notas: Optional[str] = None
    prioridade: str = "media"

class NegociacaoUpdate(BaseModel):
    confeccao_id: Optional[str] = None
    quantidade_pecas: Optional[int] = None
    tempo_peca_estimado: Optional[float] = None
    tempo_peca_real: Optional[float] = None
    data_inicio_pretendida: Optional[str] = None
    data_fim_pretendida: Optional[str] = None
    data_inicio_acordada: Optional[str] = None
    data_fim_acordada: Optional[str] = None
    preco_total: Optional[float] = None
    notas: Optional[str] = None
    resposta_confeccao: Optional[str] = None
    status: Optional[str] = None
    prioridade: Optional[str] = None


# ==================== NEGOCIACOES ROUTES ====================

@router.get("/negociacoes")
async def get_negociacoes(
    status: str = None,
    confeccao_id: str = None,
    projeto_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar negociacoes com confeccoes"""
    query = {}
    if status:
        query["status"] = status
    if confeccao_id:
        query["confeccao_id"] = confeccao_id
    if projeto_id:
        query["projeto_id"] = projeto_id
    
    negociacoes = await db.negociacoes.find(query, {"_id": 0}).sort("criado_em", -1).to_list(500)
    
    # Enrich with confeccao and project info
    confeccoes = await db.partners.find({"tipo_servico": "confeccao"}, {"_id": 0}).to_list(100)
    conf_map = {c["id"]: c for c in confeccoes}
    
    projects = await db.projects.find({}, {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1}).to_list(500)
    proj_map = {p["id"]: p for p in projects}
    
    for neg in negociacoes:
        conf = conf_map.get(neg.get("confeccao_id"), {})
        neg["confeccao_nome"] = conf.get("nome", "-")
        neg["confeccao_taxa_qualidade"] = conf.get("taxa_qualidade", 0)
        neg["confeccao_eficiencia"] = conf.get("eficiencia", 0)
        
        proj = proj_map.get(neg.get("projeto_id"), {})
        neg["projeto_of"] = proj.get("of_numero", "-")
        neg["projeto_modelo"] = proj.get("modelo", "-")
        
        # Calculate hours
        neg["horas_totais"] = neg.get("quantidade_pecas", 0) * neg.get("tempo_peca_estimado", 1.2)
    
    return deserialize_datetime(negociacoes)


@router.get("/negociacoes/stats")
async def get_negociacoes_stats(current_user: dict = Depends(get_current_user)):
    """Estatisticas das negociacoes"""
    total = await db.negociacoes.count_documents({})
    pendentes = await db.negociacoes.count_documents({"status": "pendente"})
    em_negociacao = await db.negociacoes.count_documents({"status": "em_negociacao"})
    aprovadas = await db.negociacoes.count_documents({"status": "aprovada"})
    rejeitadas = await db.negociacoes.count_documents({"status": "rejeitada"})
    
    return {
        "total": total,
        "pendentes": pendentes,
        "em_negociacao": em_negociacao,
        "aprovadas": aprovadas,
        "rejeitadas": rejeitadas
    }


@router.post("/negociacoes")
async def create_negociacao(
    negociacao: NegociacaoCreate,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova negociacao"""
    now = datetime.now(timezone.utc)
    
    negociacao_doc = {
        "id": generate_id(),
        **negociacao.model_dump(),
        "status": "pendente",
        "tempo_peca_real": None,
        "data_inicio_acordada": None,
        "data_fim_acordada": None,
        "preco_total": None,
        "resposta_confeccao": None,
        "criado_por": current_user["id"],
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.negociacoes.insert_one(negociacao_doc)
    
    return {**negociacao_doc, "_id": None}


@router.get("/negociacoes/{negociacao_id}")
async def get_negociacao(
    negociacao_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma negociacao"""
    negociacao = await db.negociacoes.find_one({"id": negociacao_id}, {"_id": 0})
    if not negociacao:
        raise HTTPException(status_code=404, detail="Negociacao nao encontrada")
    return deserialize_datetime(negociacao)


@router.put("/negociacoes/{negociacao_id}")
async def update_negociacao(
    negociacao_id: str,
    negociacao_update: NegociacaoUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar negociacao"""
    existing = await db.negociacoes.find_one({"id": negociacao_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Negociacao nao encontrada")
    
    update_data = negociacao_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.negociacoes.update_one({"id": negociacao_id}, {"$set": update_data})
    
    updated = await db.negociacoes.find_one({"id": negociacao_id}, {"_id": 0})
    return deserialize_datetime(updated)


@router.post("/negociacoes/{negociacao_id}/iniciar")
async def iniciar_negociacao(
    negociacao_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mudar status para em_negociacao"""
    negociacao = await db.negociacoes.find_one({"id": negociacao_id})
    if not negociacao:
        raise HTTPException(status_code=404, detail="Negociacao nao encontrada")
    
    await db.negociacoes.update_one(
        {"id": negociacao_id},
        {"$set": {
            "status": "em_negociacao",
            "atualizado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Negociacao iniciada"}


@router.post("/negociacoes/{negociacao_id}/aprovar")
async def aprovar_negociacao(
    negociacao_id: str,
    data_inicio_acordada: str = Query(None),
    data_fim_acordada: str = Query(None),
    preco_total: float = Query(None),
    tempo_peca_real: float = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Aprovar negociacao e criar reserva"""
    negociacao = await db.negociacoes.find_one({"id": negociacao_id})
    if not negociacao:
        raise HTTPException(status_code=404, detail="Negociacao nao encontrada")
    
    now = datetime.now(timezone.utc)
    
    update_data = {
        "status": "aprovada",
        "atualizado_em": now.isoformat()
    }
    
    if data_inicio_acordada:
        update_data["data_inicio_acordada"] = data_inicio_acordada
    if data_fim_acordada:
        update_data["data_fim_acordada"] = data_fim_acordada
    if preco_total:
        update_data["preco_total"] = preco_total
    if tempo_peca_real:
        update_data["tempo_peca_real"] = tempo_peca_real
    
    await db.negociacoes.update_one({"id": negociacao_id}, {"$set": update_data})
    
    # Create confirmed reserva if dates are provided
    if data_inicio_acordada and data_fim_acordada:
        reserva_doc = {
            "id": generate_id(),
            "confeccao_id": negociacao["confeccao_id"],
            "projeto_id": negociacao.get("projeto_id"),
            "descricao": f"Reserva aprovada - {negociacao.get('notas', 'Negociacao')}",
            "quantidade_pecas": negociacao["quantidade_pecas"],
            "tempo_peca": tempo_peca_real or negociacao["tempo_peca_estimado"],
            "data_inicio": data_inicio_acordada,
            "data_fim": data_fim_acordada,
            "prioridade": negociacao.get("prioridade", "media"),
            "status": "confirmada",
            "negociacao_id": negociacao_id,
            "criado_por": current_user["id"],
            "criado_em": now.isoformat(),
            "atualizado_em": now.isoformat()
        }
        await db.reservas.insert_one(reserva_doc)
    
    return {"message": "Negociacao aprovada"}


@router.post("/negociacoes/{negociacao_id}/rejeitar")
async def rejeitar_negociacao(
    negociacao_id: str,
    motivo: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Rejeitar negociacao"""
    negociacao = await db.negociacoes.find_one({"id": negociacao_id})
    if not negociacao:
        raise HTTPException(status_code=404, detail="Negociacao nao encontrada")
    
    update_data = {
        "status": "rejeitada",
        "atualizado_em": datetime.now(timezone.utc).isoformat()
    }
    
    if motivo:
        update_data["resposta_confeccao"] = motivo
    
    await db.negociacoes.update_one({"id": negociacao_id}, {"$set": update_data})
    
    return {"message": "Negociacao rejeitada"}


@router.delete("/negociacoes/{negociacao_id}")
async def delete_negociacao(
    negociacao_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar negociacao"""
    result = await db.negociacoes.delete_one({"id": negociacao_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Negociacao nao encontrada")
    return {"message": "Negociacao eliminada"}


# ==================== RESERVAS ====================

@router.get("/reservas")
async def get_reservas(
    confeccao_id: str = None,
    status: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Listar reservas de capacidade"""
    query = {}
    if confeccao_id:
        query["confeccao_id"] = confeccao_id
    if status:
        query["status"] = status
    
    reservas = await db.reservas.find(query, {"_id": 0}).sort("data_inicio", 1).to_list(500)
    
    # Enrich with confeccao and project names
    confeccoes = await db.partners.find({"tipo_servico": "confeccao"}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    conf_map = {c["id"]: c["nome"] for c in confeccoes}
    
    projects = await db.projects.find({}, {"_id": 0, "id": 1, "of_numero": 1}).to_list(500)
    proj_map = {p["id"]: p["of_numero"] for p in projects}
    
    for r in reservas:
        r["confeccao_nome"] = conf_map.get(r.get("confeccao_id"), "-")
        r["projeto_of"] = proj_map.get(r.get("projeto_id"), "-")
        # Calculate hours
        r["horas_totais"] = r.get("quantidade_pecas", 0) * r.get("tempo_peca", 1.2)
    
    return deserialize_datetime(reservas)


@router.post("/reservas")
async def create_reserva(
    reserva: ReservaCreate,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova reserva de capacidade"""
    now = datetime.now(timezone.utc)
    
    reserva_doc = {
        "id": generate_id(),
        **reserva.model_dump(),
        "criado_por": current_user["id"],
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.reservas.insert_one(reserva_doc)
    
    # Check for conflicts
    await check_conflicts_and_notify(reserva.confeccao_id, reserva.data_inicio, reserva.data_fim)
    
    return {**reserva_doc, "_id": None}


@router.put("/reservas/{reserva_id}")
async def update_reserva(
    reserva_id: str,
    reserva_update: ReservaUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar reserva"""
    existing = await db.reservas.find_one({"id": reserva_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Reserva nao encontrada")
    
    update_data = reserva_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.reservas.update_one({"id": reserva_id}, {"$set": update_data})
    
    updated = await db.reservas.find_one({"id": reserva_id}, {"_id": 0})
    return deserialize_datetime(updated)


@router.delete("/reservas/{reserva_id}")
async def delete_reserva(
    reserva_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar reserva"""
    result = await db.reservas.delete_one({"id": reserva_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reserva nao encontrada")
    return {"message": "Reserva eliminada"}


@router.post("/reservas/{reserva_id}/confirm")
async def confirm_reserva(
    reserva_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Confirmar uma reserva"""
    reserva = await db.reservas.find_one({"id": reserva_id})
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva nao encontrada")
    
    await db.reservas.update_one(
        {"id": reserva_id},
        {"$set": {"status": "confirmada", "atualizado_em": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Reserva confirmada"}


@router.post("/reservas/move")
async def move_reserva(
    reserva_id: str = Query(...),
    nova_confeccao_id: str = Query(...),
    nova_data_inicio: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Mover reserva para outra confeccao (drag & drop)"""
    reserva = await db.reservas.find_one({"id": reserva_id})
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva nao encontrada")
    
    update_data = {
        "confeccao_id": nova_confeccao_id,
        "atualizado_em": datetime.now(timezone.utc).isoformat()
    }
    
    # If new start date, calculate new end date maintaining duration
    if nova_data_inicio:
        old_start = datetime.fromisoformat(reserva["data_inicio"].replace("Z", "+00:00"))
        old_end = datetime.fromisoformat(reserva["data_fim"].replace("Z", "+00:00"))
        duration = old_end - old_start
        
        new_start = datetime.fromisoformat(nova_data_inicio.replace("Z", "+00:00"))
        new_end = new_start + duration
        
        update_data["data_inicio"] = new_start.isoformat()
        update_data["data_fim"] = new_end.isoformat()
    
    await db.reservas.update_one({"id": reserva_id}, {"$set": update_data})
    
    # Check for conflicts in new location
    await check_conflicts_and_notify(
        nova_confeccao_id, 
        update_data.get("data_inicio", reserva["data_inicio"]),
        update_data.get("data_fim", reserva["data_fim"])
    )
    
    updated = await db.reservas.find_one({"id": reserva_id}, {"_id": 0})
    return deserialize_datetime(updated)


@router.post("/reservas/{reserva_id}/resize")
async def resize_reserva(
    reserva_id: str,
    data_inicio: str = Query(...),
    data_fim: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Redimensionar reserva (alterar datas via drag-resize)"""
    reserva = await db.reservas.find_one({"id": reserva_id})
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva nao encontrada")
    
    # Validate dates
    start = datetime.fromisoformat(data_inicio.replace("Z", "+00:00"))
    end = datetime.fromisoformat(data_fim.replace("Z", "+00:00"))
    
    if end <= start:
        raise HTTPException(status_code=400, detail="Data fim deve ser posterior a data inicio")
    
    update_data = {
        "data_inicio": start.isoformat(),
        "data_fim": end.isoformat(),
        "atualizado_em": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reservas.update_one({"id": reserva_id}, {"$set": update_data})
    
    # Check for conflicts
    await check_conflicts_and_notify(reserva["confeccao_id"], data_inicio, data_fim)
    
    updated = await db.reservas.find_one({"id": reserva_id}, {"_id": 0})
    return deserialize_datetime(updated)


@router.post("/trabalhos/{trabalho_id}/resize")
async def resize_trabalho(
    trabalho_id: str,
    data_inicio: str = Query(...),
    data_fim: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Redimensionar trabalho/projeto (alterar datas via drag-resize)"""
    project = await db.projects.find_one({"id": trabalho_id})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto nao encontrado")
    
    # Validate dates
    start = datetime.fromisoformat(data_inicio.replace("Z", "+00:00"))
    end = datetime.fromisoformat(data_fim.replace("Z", "+00:00"))
    
    if end <= start:
        raise HTTPException(status_code=400, detail="Data fim deve ser posterior a data inicio")
    
    update_data = {
        "data_encomenda": start.isoformat(),
        "data_prevista_entrega": end.isoformat(),
        "atualizado_em": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one({"id": trabalho_id}, {"$set": update_data})
    
    updated = await db.projects.find_one({"id": trabalho_id}, {"_id": 0})
    return deserialize_datetime(updated)


# ==================== NOTIFICACOES ====================

@router.get("/notifications")
async def get_notifications(
    lida: bool = None,
    tipo: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Listar notificacoes"""
    query = {}
    if lida is not None:
        query["lida"] = lida
    if tipo:
        query["tipo"] = tipo
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("criado_em", -1).to_list(limit)
    return deserialize_datetime(notifications)


@router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Obter contagem de notificacoes nao lidas"""
    count = await db.notifications.count_documents({"lida": False})
    critical = await db.notifications.count_documents({"lida": False, "prioridade": "critica"})
    return {"unread": count, "critical": critical}


@router.post("/notifications")
async def create_notification(
    notification: NotificationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Criar notificacao manual"""
    return await create_system_notification(
        notification.tipo,
        notification.titulo,
        notification.mensagem,
        notification.entidade_tipo,
        notification.entidade_id,
        notification.prioridade
    )


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Marcar notificacao como lida"""
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"lida": True, "lida_em": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notificacao nao encontrada")
    return {"message": "Notificacao marcada como lida"}


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Marcar todas as notificacoes como lidas"""
    result = await db.notifications.update_many(
        {"lida": False},
        {"$set": {"lida": True, "lida_em": datetime.now(timezone.utc).isoformat()}}
    )
    return {"marked": result.modified_count}


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar notificacao"""
    result = await db.notifications.delete_one({"id": notification_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notificacao nao encontrada")
    return {"message": "Notificacao eliminada"}


# ==================== VERIFICACAO AUTOMATICA ====================

async def create_system_notification(
    tipo: str,
    titulo: str,
    mensagem: str,
    entidade_tipo: str = None,
    entidade_id: str = None,
    prioridade: str = "media"
):
    """Helper para criar notificacao do sistema"""
    now = datetime.now(timezone.utc)
    
    notification_doc = {
        "id": generate_id(),
        "tipo": tipo,
        "titulo": titulo,
        "mensagem": mensagem,
        "entidade_tipo": entidade_tipo,
        "entidade_id": entidade_id,
        "prioridade": prioridade,
        "lida": False,
        "criado_em": now.isoformat()
    }
    
    await db.notifications.insert_one(notification_doc)
    return {**notification_doc, "_id": None}


async def check_conflicts_and_notify(confeccao_id: str, data_inicio: str, data_fim: str):
    """Verificar conflitos de reservas e criar notificacoes"""
    # Get confeccao info
    confeccao = await db.partners.find_one({"id": confeccao_id}, {"_id": 0})
    conf_nome = confeccao.get("nome", "Confeccao") if confeccao else "Confeccao"
    
    # Get all reservas for this confeccao that overlap
    start = datetime.fromisoformat(data_inicio.replace("Z", "+00:00"))
    end = datetime.fromisoformat(data_fim.replace("Z", "+00:00"))
    
    overlapping = await db.reservas.find({
        "confeccao_id": confeccao_id,
        "status": {"$ne": "cancelada"},
        "$or": [
            {"data_inicio": {"$lte": data_fim}, "data_fim": {"$gte": data_inicio}}
        ]
    }, {"_id": 0}).to_list(100)
    
    # If more than 1 overlapping (including the new one), there's a conflict
    if len(overlapping) > 1:
        await create_system_notification(
            tipo="conflito",
            titulo=f"Conflito de Reservas - {conf_nome}",
            mensagem=f"Existem {len(overlapping)} reservas sobrepostas no periodo {data_inicio[:10]} a {data_fim[:10]}",
            entidade_tipo="confeccao",
            entidade_id=confeccao_id,
            prioridade="alta"
        )


@router.post("/check-overload")
async def check_overload_and_notify(current_user: dict = Depends(get_current_user)):
    """Verificar sobrecarga de confeccoes e criar notificacoes"""
    notifications_created = []
    
    # Get all confeccoes
    confeccoes = await db.partners.find(
        {"tipo_servico": "confeccao", "ativo": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get all active projects
    trabalhos = await db.projects.find(
        {"status_projeto": {"$in": ["ativo", "atrasado"]}, "parceiro_confeccao_id": {"$exists": True}},
        {"_id": 0}
    ).to_list(500)
    
    # Get all pending/confirmed reservas
    reservas = await db.reservas.find(
        {"status": {"$in": ["pendente", "confirmada"]}},
        {"_id": 0}
    ).to_list(500)
    
    for conf in confeccoes:
        conf_id = conf["id"]
        conf_nome = conf["nome"]
        
        # Calculate capacity
        num_trabalhadores = conf.get("num_trabalhadores", 10)
        eficiencia = conf.get("eficiencia", 80) / 100
        tempo_peca = conf.get("tempo_medio_peca", 1.2)
        capacidade_hora_mes = num_trabalhadores * 8 * 22 * eficiencia
        
        # Calculate load from active projects
        conf_trabalhos = [t for t in trabalhos if t.get("parceiro_confeccao_id") == conf_id]
        horas_trabalhos = sum(t.get("quantidade", 0) * tempo_peca for t in conf_trabalhos)
        
        # Calculate load from reservas
        conf_reservas = [r for r in reservas if r.get("confeccao_id") == conf_id]
        horas_reservas = sum(r.get("quantidade_pecas", 0) * r.get("tempo_peca", 1.2) for r in conf_reservas)
        
        total_horas = horas_trabalhos + horas_reservas
        ocupacao = (total_horas / capacidade_hora_mes * 100) if capacidade_hora_mes > 0 else 0
        
        # Create notification if overloaded
        if ocupacao > 100:
            notif = await create_system_notification(
                tipo="sobrecarga",
                titulo=f"Sobrecarga - {conf_nome}",
                mensagem=f"Confeccao esta com {int(ocupacao)}% de ocupacao ({int(total_horas)}h de {int(capacidade_hora_mes)}h capacidade)",
                entidade_tipo="confeccao",
                entidade_id=conf_id,
                prioridade="critica"
            )
            notifications_created.append(notif)
        elif ocupacao > 80:
            notif = await create_system_notification(
                tipo="capacidade",
                titulo=f"Capacidade Alta - {conf_nome}",
                mensagem=f"Confeccao esta com {int(ocupacao)}% de ocupacao. Considere redistribuir trabalhos.",
                entidade_tipo="confeccao",
                entidade_id=conf_id,
                prioridade="alta"
            )
            notifications_created.append(notif)
    
    return {
        "checked_confeccoes": len(confeccoes),
        "notifications_created": len(notifications_created),
        "notifications": notifications_created
    }


@router.post("/check-deadlines")
async def check_deadlines_and_notify(current_user: dict = Depends(get_current_user)):
    """Verificar prazos proximos e criar notificacoes"""
    notifications_created = []
    now = datetime.now(timezone.utc)
    
    # Get projects with upcoming deadlines
    projects = await db.projects.find(
        {"status_projeto": {"$in": ["ativo", "atrasado"]}, "data_prevista_entrega": {"$exists": True}},
        {"_id": 0}
    ).to_list(500)
    
    for project in projects:
        delivery_str = project.get("data_prevista_entrega")
        if not delivery_str:
            continue
            
        delivery = datetime.fromisoformat(delivery_str.replace("Z", "+00:00"))
        days_until = (delivery - now).days
        
        # Already notified today?
        existing = await db.notifications.find_one({
            "entidade_tipo": "projeto",
            "entidade_id": project["id"],
            "tipo": "prazo",
            "criado_em": {"$gte": (now - timedelta(hours=24)).isoformat()}
        })
        
        if existing:
            continue
        
        if days_until < 0:
            # Overdue
            notif = await create_system_notification(
                tipo="prazo",
                titulo=f"Prazo Ultrapassado - {project['of_numero']}",
                mensagem=f"Projeto esta atrasado ha {abs(days_until)} dias!",
                entidade_tipo="projeto",
                entidade_id=project["id"],
                prioridade="critica"
            )
            notifications_created.append(notif)
        elif days_until <= 3:
            # Very close
            notif = await create_system_notification(
                tipo="prazo",
                titulo=f"Prazo Iminente - {project['of_numero']}",
                mensagem=f"Entrega prevista em {days_until} dias ({delivery_str[:10]})",
                entidade_tipo="projeto",
                entidade_id=project["id"],
                prioridade="alta"
            )
            notifications_created.append(notif)
        elif days_until <= 7:
            # Close
            notif = await create_system_notification(
                tipo="prazo",
                titulo=f"Prazo Proximo - {project['of_numero']}",
                mensagem=f"Entrega prevista em {days_until} dias",
                entidade_tipo="projeto",
                entidade_id=project["id"],
                prioridade="media"
            )
            notifications_created.append(notif)
    
    return {
        "checked_projects": len(projects),
        "notifications_created": len(notifications_created)
    }
