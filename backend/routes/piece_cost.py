from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from utils import db, get_current_user, generate_id, serialize_datetime, deserialize_datetime, create_history_entry

router = APIRouter()

# ============== MODELS ==============

class PieceCostConfig(BaseModel):
    """Configuration for piece cost calculation"""
    custo_hora_confeccao: float = 8.0  # €/hour default
    custo_hora_minimo: float = 5.0
    custo_hora_maximo: float = 25.0
    margem_percentagem: float = 15.0  # % margin
    incluir_margem: bool = True
    moeda: str = "EUR"

class PieceCostCalculation(BaseModel):
    """A single calculation record for a project"""
    id: str
    projeto_id: str
    modo_calculo: str  # "custo_para_tempo" or "tempo_para_custo"
    # Input values
    custo_input: Optional[float] = None  # € per piece
    tempo_input: Optional[float] = None  # minutes per piece
    # Calculated results (suggestions)
    tempo_calculado: Optional[float] = None  # minutes
    custo_calculado: Optional[float] = None  # €
    # Final values (operator decision)
    tempo_final: Optional[float] = None
    custo_final: Optional[float] = None
    # Operator confirmation
    confirmado: bool = False
    confirmado_por: Optional[str] = None
    confirmado_em: Optional[str] = None
    # Config used
    custo_hora: float
    margem_aplicada: float = 0
    # Metadata
    notas: Optional[str] = None
    criado_em: str
    criado_por: str
    atualizado_em: str

class PieceCostCalculateRequest(BaseModel):
    modo_calculo: str  # "custo_para_tempo" or "tempo_para_custo"
    custo_input: Optional[float] = None
    tempo_input: Optional[float] = None
    custo_hora: float = 8.0
    margem_percentagem: float = 0
    incluir_margem: bool = False

class PieceCostSaveRequest(BaseModel):
    modo_calculo: str
    custo_input: Optional[float] = None
    tempo_input: Optional[float] = None
    tempo_calculado: Optional[float] = None
    custo_calculado: Optional[float] = None
    tempo_final: float
    custo_final: float
    custo_hora: float
    margem_aplicada: float = 0
    notas: Optional[str] = None
    confirmado: bool = False

class PieceCostConfirmRequest(BaseModel):
    tempo_final: float
    custo_final: float
    notas: Optional[str] = None


# ============== CONFIG ROUTES ==============

@router.get("/config")
async def get_piece_cost_config(current_user: dict = Depends(get_current_user)):
    """Get the global piece cost configuration"""
    config = await db.piece_cost_config.find_one({}, {"_id": 0})
    if not config:
        # Return defaults
        return PieceCostConfig().model_dump()
    return config

@router.put("/config")
async def update_piece_cost_config(
    config: PieceCostConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update the global piece cost configuration (admin only)"""
    if current_user.get("role") not in ["administrador", "direcao"]:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar configuração")
    
    config_dict = config.model_dump()
    config_dict["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    config_dict["atualizado_por"] = current_user["id"]
    
    await db.piece_cost_config.update_one({}, {"$set": config_dict}, upsert=True)
    return config_dict


# ============== CALCULATION ROUTES ==============

@router.post("/calculate")
async def calculate_piece_cost(
    req: PieceCostCalculateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate piece cost/time based on input.
    Does NOT save - just returns the calculation result.
    """
    result = {
        "modo_calculo": req.modo_calculo,
        "custo_input": req.custo_input,
        "tempo_input": req.tempo_input,
        "custo_hora": req.custo_hora,
        "margem_percentagem": req.margem_percentagem,
        "tempo_calculado": None,
        "custo_calculado": None,
        "custo_sem_margem": None,
        "margem_valor": None
    }
    
    if req.modo_calculo == "custo_para_tempo":
        # Given cost per piece (€), calculate time (minutes)
        if req.custo_input and req.custo_input > 0 and req.custo_hora > 0:
            custo_base = req.custo_input
            if req.incluir_margem and req.margem_percentagem > 0:
                # Remove margin to get base cost
                custo_base = req.custo_input / (1 + req.margem_percentagem / 100)
            
            # custo_base = (tempo_minutos / 60) * custo_hora
            # tempo_minutos = (custo_base * 60) / custo_hora
            tempo_minutos = (custo_base * 60) / req.custo_hora
            result["tempo_calculado"] = round(tempo_minutos, 2)
            result["custo_sem_margem"] = round(custo_base, 4)
            result["margem_valor"] = round(req.custo_input - custo_base, 4) if req.incluir_margem else 0
            
    elif req.modo_calculo == "tempo_para_custo":
        # Given time per piece (minutes), calculate cost (€)
        if req.tempo_input and req.tempo_input > 0 and req.custo_hora > 0:
            # custo_base = (tempo_minutos / 60) * custo_hora
            custo_base = (req.tempo_input / 60) * req.custo_hora
            
            if req.incluir_margem and req.margem_percentagem > 0:
                custo_final = custo_base * (1 + req.margem_percentagem / 100)
            else:
                custo_final = custo_base
            
            result["custo_calculado"] = round(custo_final, 4)
            result["custo_sem_margem"] = round(custo_base, 4)
            result["margem_valor"] = round(custo_final - custo_base, 4) if req.incluir_margem else 0
    
    return result


# ============== PROJECT PIECE COST ROUTES ==============

@router.get("/{project_id}")
async def get_project_piece_costs(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all piece cost calculations for a project"""
    calculations = await db.piece_cost_calculations.find(
        {"projeto_id": project_id},
        {"_id": 0}
    ).sort("criado_em", -1).to_list(100)
    return deserialize_datetime(calculations)

@router.get("/{project_id}/current")
async def get_current_piece_cost(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the current (confirmed) piece cost for a project"""
    calculation = await db.piece_cost_calculations.find_one(
        {"projeto_id": project_id, "confirmado": True},
        {"_id": 0}
    )
    return deserialize_datetime(calculation) if calculation else None

@router.post("/{project_id}")
async def save_piece_cost(
    project_id: str,
    req: PieceCostSaveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save a new piece cost calculation for a project"""
    # Check project exists
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    now = datetime.now(timezone.utc).isoformat()
    
    calculation = {
        "id": generate_id(),
        "projeto_id": project_id,
        "modo_calculo": req.modo_calculo,
        "custo_input": req.custo_input,
        "tempo_input": req.tempo_input,
        "tempo_calculado": req.tempo_calculado,
        "custo_calculado": req.custo_calculado,
        "tempo_final": req.tempo_final,
        "custo_final": req.custo_final,
        "custo_hora": req.custo_hora,
        "margem_aplicada": req.margem_aplicada,
        "notas": req.notas,
        "confirmado": req.confirmado,
        "confirmado_por": current_user["id"] if req.confirmado else None,
        "confirmado_em": now if req.confirmado else None,
        "criado_em": now,
        "criado_por": current_user["id"],
        "atualizado_em": now
    }
    
    # If confirming, unconfirm previous
    if req.confirmado:
        await db.piece_cost_calculations.update_many(
            {"projeto_id": project_id, "confirmado": True},
            {"$set": {"confirmado": False}}
        )
    
    await db.piece_cost_calculations.insert_one(calculation)
    
    # Create history entry
    await create_history_entry(
        "project", project_id, "custo_peca",
        None, f"Tempo: {req.tempo_final}min, Custo: €{req.custo_final}",
        current_user["id"]
    )
    
    # Remove _id before returning
    calculation.pop("_id", None)
    return calculation

@router.patch("/{project_id}/{calculation_id}/confirm")
async def confirm_piece_cost(
    project_id: str,
    calculation_id: str,
    req: PieceCostConfirmRequest,
    current_user: dict = Depends(get_current_user)
):
    """Confirm a piece cost calculation with final values (operator decision)"""
    calculation = await db.piece_cost_calculations.find_one(
        {"id": calculation_id, "projeto_id": project_id}
    )
    if not calculation:
        raise HTTPException(status_code=404, detail="Cálculo não encontrado")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Unconfirm any previous confirmed
    await db.piece_cost_calculations.update_many(
        {"projeto_id": project_id, "confirmado": True},
        {"$set": {"confirmado": False}}
    )
    
    # Update this one
    update_data = {
        "tempo_final": req.tempo_final,
        "custo_final": req.custo_final,
        "notas": req.notas,
        "confirmado": True,
        "confirmado_por": current_user["id"],
        "confirmado_em": now,
        "atualizado_em": now
    }
    
    await db.piece_cost_calculations.update_one(
        {"id": calculation_id},
        {"$set": update_data}
    )
    
    # Create history entry
    await create_history_entry(
        "project", project_id, "custo_peca_confirmado",
        None, f"Tempo: {req.tempo_final}min, Custo: €{req.custo_final}",
        current_user["id"]
    )
    
    updated = await db.piece_cost_calculations.find_one(
        {"id": calculation_id},
        {"_id": 0}
    )
    return deserialize_datetime(updated)

@router.delete("/{project_id}/{calculation_id}")
async def delete_piece_cost(
    project_id: str,
    calculation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a piece cost calculation"""
    result = await db.piece_cost_calculations.delete_one(
        {"id": calculation_id, "projeto_id": project_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cálculo não encontrado")
    return {"message": "Cálculo eliminado"}
