from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from models import HistoryEntry
from utils import db, get_current_user, deserialize_datetime

router = APIRouter()

@router.get("/", response_model=List[HistoryEntry])
async def get_history(
    entidade: Optional[str] = None,
    entidade_id: Optional[str] = None,
    alterado_por: Optional[str] = None,
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if entidade:
        query["entidade"] = entidade
    if entidade_id:
        query["entidade_id"] = entidade_id
    if alterado_por:
        query["alterado_por"] = alterado_por
    
    history = await db.history.find(query, {"_id": 0}).sort("data", -1).limit(limit).to_list(limit)
    return deserialize_datetime(history)
