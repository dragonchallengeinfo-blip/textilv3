from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import Brand, BrandCreate, BrandUpdate
from utils import (
    db, get_current_user, generate_id,
    deserialize_datetime
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=List[Brand])
async def get_brands(current_user: dict = Depends(get_current_user)):
    brands = await db.brands.find({}, {"_id": 0}).sort("nome", 1).to_list(500)
    return deserialize_datetime(brands)

@router.get("/{brand_id}", response_model=Brand)
async def get_brand(brand_id: str, current_user: dict = Depends(get_current_user)):
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Marca não encontrada")
    return deserialize_datetime(brand)

@router.post("/", response_model=Brand)
async def create_brand(brand: BrandCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    brand_dict = brand.model_dump()
    
    brand_doc = {
        **brand_dict,
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.brands.insert_one(brand_doc)
    
    brand_doc['criado_em'] = now
    brand_doc['atualizado_em'] = now
    
    return brand_doc

@router.put("/{brand_id}", response_model=Brand)
async def update_brand(brand_id: str, brand_update: BrandUpdate, current_user: dict = Depends(get_current_user)):
    brand = await db.brands.find_one({"id": brand_id})
    if not brand:
        raise HTTPException(status_code=404, detail="Marca não encontrada")
    
    update_data = brand_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.brands.update_one({"id": brand_id}, {"$set": update_data})
    
    updated_brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    return deserialize_datetime(updated_brand)

@router.delete("/{brand_id}")
async def delete_brand(brand_id: str, current_user: dict = Depends(get_current_user)):
    # Check if brand is in use
    project_count = await db.projects.count_documents({"marca_id": brand_id})
    if project_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Não é possível eliminar a marca. Está associada a {project_count} projeto(s)."
        )
    
    result = await db.brands.delete_one({"id": brand_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Marca não encontrada")
    
    return {"message": "Marca eliminada"}
