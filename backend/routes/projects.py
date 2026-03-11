from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks, Response, status
from typing import List, Optional
from models import Project, ProjectCreate, ProjectUpdate, StagePlanning, StagePlanningCreate
from utils import (
    db, get_current_user, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone
from pydantic import BaseModel
import base64
import os

# Import WebSocket notifications
from websocket_manager import notify_project_change, notify_dashboard_update, EventType

router = APIRouter()

class AttachmentResponse(BaseModel):
    id: str
    projeto_id: str
    nome: str
    tipo: str
    tamanho: int
    criado_em: str
    criado_por: str

class PaginatedProjectsResponse(BaseModel):
    """Response model para projetos paginados"""
    projects: List[dict]
    total: int
    page: int
    per_page: int
    total_pages: int

# ========== ENDPOINT OTIMIZADO COM PAGINAÇÃO SERVER-SIDE ==========
@router.get("/paginated", response_model=PaginatedProjectsResponse)
async def get_projects_paginated(
    page: int = Query(1, ge=1, description="Número da página"),
    per_page: int = Query(25, ge=1, le=100, description="Itens por página"),
    search: Optional[str] = Query(None, description="Pesquisa por OF ou modelo"),
    status: Optional[str] = Query(None, description="Filtro por status"),
    marca_id: Optional[str] = Query(None, description="Filtro por marca"),
    tipo_ordem_id: Optional[str] = Query(None, description="Filtro por tipo de ordem"),
    comercial_id: Optional[str] = Query(None, description="Filtro por comercial"),
    confeccao_id: Optional[str] = Query(None, description="Filtro por confecção"),
    data_inicio: Optional[str] = Query(None, description="Data entrega início"),
    data_fim: Optional[str] = Query(None, description="Data entrega fim"),
    sort_by: str = Query("data_prevista_entrega", description="Campo para ordenação"),
    sort_order: str = Query("asc", description="Direção: asc ou desc"),
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint otimizado com:
    - Paginação server-side
    - Filtros aplicados na query MongoDB
    - Projeção de campos (só retorna o necessário)
    - Ordenação no servidor
    """
    # Construir query
    query = {}
    
    # Filtro de pesquisa (OF ou modelo)
    if search:
        query["$or"] = [
            {"of_numero": {"$regex": search, "$options": "i"}},
            {"modelo": {"$regex": search, "$options": "i"}}
        ]
    
    # Filtros específicos
    if status:
        query["status_projeto"] = status
    if marca_id:
        query["marca_id"] = marca_id
    if tipo_ordem_id:
        query["tipo_ordem_id"] = tipo_ordem_id
    if comercial_id:
        query["comercial_responsavel_id"] = comercial_id
    if confeccao_id:
        query["parceiro_confeccao_id"] = confeccao_id
    
    # Filtro de datas
    if data_inicio or data_fim:
        query["data_prevista_entrega"] = {}
        if data_inicio:
            query["data_prevista_entrega"]["$gte"] = data_inicio
        if data_fim:
            query["data_prevista_entrega"]["$lte"] = data_fim
    
    # Projeção - só campos necessários para listagem
    projection = {
        "_id": 0,
        "id": 1,
        "of_numero": 1,
        "modelo": 1,
        "quantidade": 1,
        "marca_id": 1,
        "tipo_ordem_id": 1,
        "comercial_responsavel_id": 1,
        "parceiro_confeccao_id": 1,
        "status_projeto": 1,
        "progresso_percentagem": 1,
        "data_prevista_entrega": 1,
        "data_encomenda": 1,
        "criado_em": 1
    }
    
    # Ordenação
    sort_direction = 1 if sort_order == "asc" else -1
    sort_field = sort_by if sort_by in projection else "data_prevista_entrega"
    
    # Contagem total (para paginação)
    total = await db.projects.count_documents(query)
    
    # Calcular skip
    skip = (page - 1) * per_page
    
    # Query com paginação
    cursor = db.projects.find(query, projection)
    cursor = cursor.sort(sort_field, sort_direction)
    cursor = cursor.skip(skip).limit(per_page)
    
    projects = await cursor.to_list(per_page)
    
    # Calcular total de páginas
    total_pages = (total + per_page - 1) // per_page
    
    return {
        "projects": deserialize_datetime(projects),
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages
    }

# Endpoint original mantido para compatibilidade
@router.get("/", response_model=List[Project])
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    return deserialize_datetime(projects)

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return deserialize_datetime(project)

@router.post("/", response_model=Project)
async def create_project(
    project: ProjectCreate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    # Check if OF number exists
    existing = await db.projects.find_one({"of_numero": project.of_numero})
    if existing:
        raise HTTPException(status_code=400, detail="Número OF já existe")
    
    now = datetime.now(timezone.utc)
    project_dict = project.model_dump()
    
    project_doc = {
        **serialize_datetime(project_dict),
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat(),
        "criado_por": current_user["id"]
    }
    
    await db.projects.insert_one(project_doc)
    
    # Create stage planning based on order type
    order_type = await db.order_types.find_one({"id": project.tipo_ordem_id}, {"_id": 0})
    if order_type and order_type.get("ordem_padrao_etapas"):
        for idx, stage_id in enumerate(order_type["ordem_padrao_etapas"]):
            stage = await db.stages.find_one({"id": stage_id}, {"_id": 0})
            if stage:
                planning = {
                    "id": generate_id(),
                    "projeto_id": project_doc["id"],
                    "etapa_id": stage_id,
                    "status_etapa": "nao_iniciado",
                    "atraso_dias": 0,
                    "bloqueada": False,
                    "criado_em": now.isoformat(),
                    "atualizado_em": now.isoformat()
                }
                # Set dependency on previous stage
                if idx > 0:
                    planning["depende_de_etapa_id"] = order_type["ordem_padrao_etapas"][idx - 1]
                
                await db.stage_planning.insert_one(planning)
        
        # Set first stage as current
        if order_type["ordem_padrao_etapas"]:
            await db.projects.update_one(
                {"id": project_doc["id"]},
                {"$set": {"etapa_atual_id": order_type["ordem_padrao_etapas"][0]}}
            )
            project_doc["etapa_atual_id"] = order_type["ordem_padrao_etapas"][0]
    
    # ========== WEBSOCKET: Notificar criação de projeto ==========
    background_tasks.add_task(
        notify_project_change,
        EventType.PROJECT_CREATED,
        project_doc["id"],
        project_doc,
        current_user["id"]
    )
    background_tasks.add_task(notify_dashboard_update)
    
    return deserialize_datetime(project_doc)

@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: str, 
    project_update: ProjectUpdate, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    update_data = serialize_datetime(project_update.model_dump(exclude_unset=True))
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    # Detectar mudanças importantes para WebSocket
    status_changed = "status_projeto" in update_data and update_data["status_projeto"] != project.get("status_projeto")
    stage_changed = "etapa_atual_id" in update_data and update_data["etapa_atual_id"] != project.get("etapa_atual_id")
    
    # Create history entries
    for field, new_value in update_data.items():
        if field in project and str(project[field]) != str(new_value):
            await create_history_entry(
                "project", project_id, field,
                str(project[field]), str(new_value),
                current_user["id"]
            )
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    
    updated_project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    
    # ========== WEBSOCKET: Notificar atualização ==========
    if status_changed:
        background_tasks.add_task(
            notify_project_change,
            EventType.PROJECT_STATUS_CHANGED,
            project_id,
            updated_project,
            current_user["id"],
            {"old_status": project.get("status_projeto"), "new_status": update_data["status_projeto"]}
        )
    elif stage_changed:
        background_tasks.add_task(
            notify_project_change,
            EventType.PROJECT_STAGE_CHANGED,
            project_id,
            updated_project,
            current_user["id"],
            {"old_stage": project.get("etapa_atual_id"), "new_stage": update_data["etapa_atual_id"]}
        )
    else:
        background_tasks.add_task(
            notify_project_change,
            EventType.PROJECT_UPDATED,
            project_id,
            updated_project,
            current_user["id"]
        )
    
    background_tasks.add_task(notify_dashboard_update)
    
    return deserialize_datetime(updated_project)

@router.delete("/{project_id}")
async def delete_project(
    project_id: str, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    # Guardar dados antes de eliminar para notificação
    project = await db.projects.find_one({"id": project_id}, {"_id": 0, "of_numero": 1, "modelo": 1})
    
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    # Delete related stage planning
    await db.stage_planning.delete_many({"projeto_id": project_id})
    await db.checkpoint_responses.delete_many({"projeto_id": project_id})
    await db.alerts.delete_many({"projeto_id": project_id})
    
    # ========== WEBSOCKET: Notificar eliminação ==========
    background_tasks.add_task(
        notify_project_change,
        EventType.PROJECT_DELETED,
        project_id,
        project,
        current_user["id"]
    )
    background_tasks.add_task(notify_dashboard_update)
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{project_id}/stage-planning", response_model=List[StagePlanning])
async def get_project_stage_planning(project_id: str, current_user: dict = Depends(get_current_user)):
    planning = await db.stage_planning.find({"projeto_id": project_id}, {"_id": 0}).to_list(100)
    return deserialize_datetime(planning)


# ============== ATTACHMENTS ==============

@router.get("/{project_id}/attachments")
async def get_project_attachments(project_id: str, current_user: dict = Depends(get_current_user)):
    """Get all attachments for a project"""
    attachments = await db.attachments.find({"projeto_id": project_id}, {"_id": 0, "data": 0}).to_list(100)
    return deserialize_datetime(attachments)


@router.post("/{project_id}/attachments")
async def upload_attachment(
    project_id: str, 
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an attachment to a project"""
    # Check project exists
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    # Read file content
    content = await file.read()
    
    # Limit file size to 10MB
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ficheiro muito grande (máx 10MB)")
    
    now = datetime.now(timezone.utc)
    
    attachment = {
        "id": generate_id(),
        "projeto_id": project_id,
        "nome": file.filename,
        "tipo": file.content_type or "application/octet-stream",
        "tamanho": len(content),
        "data": base64.b64encode(content).decode('utf-8'),
        "criado_em": now.isoformat(),
        "criado_por": current_user["id"]
    }
    
    await db.attachments.insert_one(attachment)
    
    # Create history entry
    await create_history_entry(
        "project", project_id, "anexo_adicionado",
        None, file.filename, current_user["id"]
    )
    
    # Return without data field
    return {
        "id": attachment["id"],
        "projeto_id": attachment["projeto_id"],
        "nome": attachment["nome"],
        "tipo": attachment["tipo"],
        "tamanho": attachment["tamanho"],
        "criado_em": attachment["criado_em"],
        "criado_por": attachment["criado_por"]
    }


@router.get("/{project_id}/attachments/{attachment_id}")
async def get_attachment(project_id: str, attachment_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific attachment (with data for download)"""
    attachment = await db.attachments.find_one(
        {"id": attachment_id, "projeto_id": project_id}, 
        {"_id": 0}
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    
    return attachment


@router.delete("/{project_id}/attachments/{attachment_id}")
async def delete_attachment(project_id: str, attachment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an attachment"""
    attachment = await db.attachments.find_one({"id": attachment_id, "projeto_id": project_id})
    if not attachment:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    
    await db.attachments.delete_one({"id": attachment_id})
    
    # Create history entry
    await create_history_entry(
        "project", project_id, "anexo_eliminado",
        attachment.get("nome"), None, current_user["id"]
    )
    
    return {"message": "Anexo eliminado"}

