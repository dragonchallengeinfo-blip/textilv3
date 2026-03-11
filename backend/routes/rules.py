from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import Rule, RuleCreate, RuleUpdate
from utils import (
    db, get_current_user, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/")
async def get_rules(current_user: dict = Depends(get_current_user)):
    rules = await db.rules.find({}, {"_id": 0}).to_list(500)
    return deserialize_datetime(rules)

@router.get("/{rule_id}")
async def get_rule(rule_id: str, current_user: dict = Depends(get_current_user)):
    rule = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Regra não encontrada")
    return deserialize_datetime(rule)

@router.post("/", response_model=Rule)
async def create_rule(rule: RuleCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    rule_dict = rule.model_dump()
    
    rule_doc = {
        **rule_dict,
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.rules.insert_one(rule_doc)
    
    rule_doc['criado_em'] = now
    rule_doc['atualizado_em'] = now
    
    return rule_doc

@router.put("/{rule_id}", response_model=Rule)
async def update_rule(rule_id: str, rule_update: RuleUpdate, current_user: dict = Depends(get_current_user)):
    rule = await db.rules.find_one({"id": rule_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Regra não encontrada")
    
    update_data = rule_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.rules.update_one({"id": rule_id}, {"$set": update_data})
    
    updated_rule = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    return deserialize_datetime(updated_rule)

@router.delete("/{rule_id}")
async def delete_rule(rule_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Regra não encontrada")
    
    return {"message": "Regra eliminada"}
