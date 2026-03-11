from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import Supplier, SupplierCreate, SupplierUpdate
from utils import (
    db, get_current_user, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=List[Supplier])
async def get_suppliers(current_user: dict = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(500)
    return deserialize_datetime(suppliers)

@router.get("/{supplier_id}", response_model=Supplier)
async def get_supplier(supplier_id: str, current_user: dict = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return deserialize_datetime(supplier)

@router.post("/", response_model=Supplier)
async def create_supplier(supplier: SupplierCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    supplier_dict = supplier.model_dump()
    
    supplier_doc = {
        **supplier_dict,
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.suppliers.insert_one(supplier_doc)
    
    supplier_doc['criado_em'] = now
    supplier_doc['atualizado_em'] = now
    
    return supplier_doc

@router.put("/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, supplier_update: SupplierUpdate, current_user: dict = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    
    update_data = supplier_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.suppliers.update_one({"id": supplier_id}, {"$set": update_data})
    
    updated_supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    return deserialize_datetime(updated_supplier)

@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    
    return {"message": "Fornecedor eliminado"}
