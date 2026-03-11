from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import Partner, PartnerCreate, PartnerUpdate
from utils import (
    db, get_current_user, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=List[Partner])
async def get_partners(tipo_servico: str = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if tipo_servico:
        query["tipo_servico"] = tipo_servico
    
    partners = await db.partners.find(query, {"_id": 0}).to_list(500)
    return deserialize_datetime(partners)

@router.get("/{partner_id}", response_model=Partner)
async def get_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    return deserialize_datetime(partner)

@router.post("/", response_model=Partner)
async def create_partner(partner: PartnerCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    partner_dict = partner.model_dump()
    
    partner_doc = {
        **partner_dict,
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.partners.insert_one(partner_doc)
    
    partner_doc['criado_em'] = now
    partner_doc['atualizado_em'] = now
    
    return partner_doc

@router.put("/{partner_id}", response_model=Partner)
async def update_partner(partner_id: str, partner_update: PartnerUpdate, current_user: dict = Depends(get_current_user)):
    partner = await db.partners.find_one({"id": partner_id})
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    update_data = partner_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.partners.update_one({"id": partner_id}, {"$set": update_data})
    
    updated_partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return deserialize_datetime(updated_partner)

@router.delete("/{partner_id}")
async def delete_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.partners.delete_one({"id": partner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    return {"message": "Parceiro eliminado"}
