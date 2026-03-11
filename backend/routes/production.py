from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from models import Project
from utils import db, get_current_user, deserialize_datetime

router = APIRouter()

@router.get("/", response_model=List[Project])
async def get_production_view(
    status: Optional[str] = None,
    etapa_id: Optional[str] = None,
    parceiro_id: Optional[str] = None,
    comercial_id: Optional[str] = None,
    tipo_ordem_id: Optional[str] = None,
    atrasado: Optional[bool] = None,
    bloqueado: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if status:
        query["status_projeto"] = status
    if etapa_id:
        query["etapa_atual_id"] = etapa_id
    if parceiro_id:
        query["parceiro_confeccao_id"] = parceiro_id
    if comercial_id:
        query["comercial_responsavel_id"] = comercial_id
    if tipo_ordem_id:
        query["tipo_ordem_id"] = tipo_ordem_id
    if atrasado is not None:
        if atrasado:
            query["status_projeto"] = "atrasado"
    if bloqueado is not None:
        if bloqueado:
            query["status_projeto"] = "bloqueado"
    
    projects = await db.projects.find(query, {"_id": 0}).sort("data_prevista_entrega", 1).to_list(1000)
    return deserialize_datetime(projects)
