from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import OrderType, OrderTypeCreate, OrderTypeUpdate
from utils import (
    db, get_current_user, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=List[OrderType])
async def get_order_types(current_user: dict = Depends(get_current_user)):
    order_types = await db.order_types.find({}, {"_id": 0}).to_list(100)
    return deserialize_datetime(order_types)

@router.get("/{order_type_id}", response_model=OrderType)
async def get_order_type(order_type_id: str, current_user: dict = Depends(get_current_user)):
    order_type = await db.order_types.find_one({"id": order_type_id}, {"_id": 0})
    if not order_type:
        raise HTTPException(status_code=404, detail="Tipo de ordem não encontrado")
    return deserialize_datetime(order_type)

@router.post("/", response_model=OrderType)
async def create_order_type(order_type: OrderTypeCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    order_type_dict = order_type.model_dump()
    
    order_type_doc = {
        **order_type_dict,
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.order_types.insert_one(order_type_doc)
    
    order_type_doc['criado_em'] = now
    order_type_doc['atualizado_em'] = now
    
    return order_type_doc

@router.put("/{order_type_id}", response_model=OrderType)
async def update_order_type(order_type_id: str, order_type_update: OrderTypeUpdate, current_user: dict = Depends(get_current_user)):
    order_type = await db.order_types.find_one({"id": order_type_id})
    if not order_type:
        raise HTTPException(status_code=404, detail="Tipo de ordem não encontrado")
    
    update_data = order_type_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.order_types.update_one({"id": order_type_id}, {"$set": update_data})
    
    updated_order_type = await db.order_types.find_one({"id": order_type_id}, {"_id": 0})
    return deserialize_datetime(updated_order_type)

@router.delete("/{order_type_id}")
async def delete_order_type(order_type_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.order_types.delete_one({"id": order_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tipo de ordem não encontrado")
    
    return {"message": "Tipo de ordem eliminado"}
