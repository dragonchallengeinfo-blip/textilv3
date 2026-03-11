from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import Stage, StageCreate, StageUpdate
from utils import (
    db, get_current_user, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=List[Stage])
async def get_stages(current_user: dict = Depends(get_current_user)):
    stages = await db.stages.find({}, {"_id": 0}).sort("ordem", 1).to_list(100)
    return deserialize_datetime(stages)

@router.get("/{stage_id}", response_model=Stage)
async def get_stage(stage_id: str, current_user: dict = Depends(get_current_user)):
    stage = await db.stages.find_one({"id": stage_id}, {"_id": 0})
    if not stage:
        raise HTTPException(status_code=404, detail="Etapa não encontrada")
    return deserialize_datetime(stage)

@router.post("/", response_model=Stage)
async def create_stage(stage: StageCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    stage_dict = stage.model_dump()
    
    stage_doc = {
        **stage_dict,
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.stages.insert_one(stage_doc)
    
    stage_doc['criado_em'] = now
    stage_doc['atualizado_em'] = now
    
    return stage_doc

@router.put("/{stage_id}", response_model=Stage)
async def update_stage(stage_id: str, stage_update: StageUpdate, current_user: dict = Depends(get_current_user)):
    stage = await db.stages.find_one({"id": stage_id})
    if not stage:
        raise HTTPException(status_code=404, detail="Etapa não encontrada")
    
    update_data = stage_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.stages.update_one({"id": stage_id}, {"$set": update_data})
    
    updated_stage = await db.stages.find_one({"id": stage_id}, {"_id": 0})
    return deserialize_datetime(updated_stage)

@router.delete("/{stage_id}")
async def delete_stage(stage_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.stages.delete_one({"id": stage_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Etapa não encontrada")
    
    return {"message": "Etapa eliminada"}
