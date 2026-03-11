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

@router.post("/", response_model=Partner, status_code=201)
async def create_partner(partner: PartnerCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    partner_dict = partner.model_dump()
    
    # Calculate capacity for confeccao partners
    if (partner_dict.get('tipo_servico') == 'confeccao' and 
        partner_dict.get('num_trabalhadores') and 
        partner_dict.get('eficiencia') and 
        partner_dict.get('taxa_ocupacao')):
        
        workers = partner_dict['num_trabalhadores']
        efficiency = partner_dict['eficiencia'] / 100
        occupancy = partner_dict['taxa_ocupacao'] / 100
        hours_per_day = 8
        days_per_month = 22
        
        # Calculate available capacity: workers × 8h × 22 days × efficiency × occupancy
        total_capacity = workers * hours_per_day * days_per_month * efficiency
        available_capacity = int(total_capacity * occupancy)
        
        partner_dict['capacidade_horas_mes'] = available_capacity
    
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
    
    # Recalculate capacity for confeccao partners if relevant fields are updated
    current_tipo = partner.get('tipo_servico', update_data.get('tipo_servico'))
    if current_tipo == 'confeccao':
        # Get current values and merge with updates
        workers = update_data.get('num_trabalhadores', partner.get('num_trabalhadores'))
        efficiency = update_data.get('eficiencia', partner.get('eficiencia'))  
        occupancy = update_data.get('taxa_ocupacao', partner.get('taxa_ocupacao'))
        
        if workers and efficiency is not None and occupancy is not None:
            efficiency_rate = efficiency / 100
            occupancy_rate = occupancy / 100
            hours_per_day = 8
            days_per_month = 22
            
            # Calculate available capacity: workers × 8h × 22 days × efficiency × occupancy  
            total_capacity = workers * hours_per_day * days_per_month * efficiency_rate
            available_capacity = int(total_capacity * occupancy_rate)
            
            update_data['capacidade_horas_mes'] = available_capacity
    
    await db.partners.update_one({"id": partner_id}, {"$set": update_data})
    
    updated_partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return deserialize_datetime(updated_partner)

@router.delete("/{partner_id}", status_code=204)
async def delete_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.partners.delete_one({"id": partner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    return {"message": "Parceiro eliminado"}
