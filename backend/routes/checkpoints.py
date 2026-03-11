from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models import Checkpoint, CheckpointCreate, CheckpointUpdate, CheckpointResponse, CheckpointResponseCreate, CheckpointResponseUpdate
from utils import (
    db, get_current_user, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/")
async def get_checkpoints(etapa_id: str = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if etapa_id:
        query["etapa_id"] = etapa_id
    
    checkpoints = await db.checkpoints.find(query, {"_id": 0}).sort("ordem", 1).to_list(500)
    return deserialize_datetime(checkpoints)

@router.get("/{checkpoint_id}")
async def get_checkpoint(checkpoint_id: str, current_user: dict = Depends(get_current_user)):
    checkpoint = await db.checkpoints.find_one({"id": checkpoint_id}, {"_id": 0})
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint não encontrado")
    return deserialize_datetime(checkpoint)

@router.post("/", response_model=Checkpoint)
async def create_checkpoint(checkpoint: CheckpointCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    checkpoint_dict = checkpoint.model_dump()
    
    checkpoint_doc = {
        **checkpoint_dict,
        "id": generate_id(),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.checkpoints.insert_one(checkpoint_doc)
    
    checkpoint_doc['criado_em'] = now
    checkpoint_doc['atualizado_em'] = now
    
    return checkpoint_doc

@router.put("/{checkpoint_id}", response_model=Checkpoint)
async def update_checkpoint(checkpoint_id: str, checkpoint_update: CheckpointUpdate, current_user: dict = Depends(get_current_user)):
    checkpoint = await db.checkpoints.find_one({"id": checkpoint_id})
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint não encontrado")
    
    update_data = checkpoint_update.model_dump(exclude_unset=True)
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.checkpoints.update_one({"id": checkpoint_id}, {"$set": update_data})
    
    updated_checkpoint = await db.checkpoints.find_one({"id": checkpoint_id}, {"_id": 0})
    return deserialize_datetime(updated_checkpoint)

@router.delete("/{checkpoint_id}")
async def delete_checkpoint(checkpoint_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.checkpoints.delete_one({"id": checkpoint_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Checkpoint não encontrado")
    
    return {"message": "Checkpoint eliminado"}

# Get checkpoints with responses for a project
@router.get("/project/{project_id}/responses")
async def get_project_checkpoints_with_responses(project_id: str, current_user: dict = Depends(get_current_user)):
    """Get all checkpoints for a project's current stage with their response values"""
    
    # Get project to find current stage
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    etapa_id = project.get("etapa_atual_id")
    
    # Get checkpoints for the current stage
    query = {}
    if etapa_id:
        query["etapa_id"] = etapa_id
    
    checkpoints = await db.checkpoints.find(query, {"_id": 0}).sort("ordem", 1).to_list(500)
    
    # Get existing responses for this project
    responses = await db.checkpoint_responses.find({"projeto_id": project_id}, {"_id": 0}).to_list(500)
    responses_map = {r["checkpoint_id"]: r for r in responses}
    
    # Combine checkpoints with their responses
    result = []
    for cp in checkpoints:
        response = responses_map.get(cp["id"], {})
        result.append({
            "checkpoint_id": cp["id"],
            "checkpoint_nome": cp.get("nome"),
            "tipo_resposta": cp.get("tipo_resposta"),
            "obrigatorio": cp.get("obrigatorio", False),
            "categoria": cp.get("categoria"),
            "opcoes": cp.get("opcoes"),
            "valor": response.get("valor"),
            "observacao": response.get("observacao"),
            "respondido_por": response.get("respondido_por"),
            "data_resposta": response.get("data_resposta")
        })
    
    return result

# Respond to a checkpoint (create or update)
@router.post("/{checkpoint_id}/respond")
async def respond_to_checkpoint(
    checkpoint_id: str, 
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create or update a checkpoint response"""
    
    project_id = data.get("projeto_id")
    valor = data.get("valor")
    observacao = data.get("observacao", "")
    
    if not project_id:
        raise HTTPException(status_code=400, detail="projeto_id é obrigatório")
    
    # Check if checkpoint exists
    checkpoint = await db.checkpoints.find_one({"id": checkpoint_id})
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint não encontrado")
    
    now = datetime.now(timezone.utc)
    
    # Check if response already exists
    existing = await db.checkpoint_responses.find_one({
        "checkpoint_id": checkpoint_id,
        "projeto_id": project_id
    })
    
    if existing:
        # Update existing response
        await db.checkpoint_responses.update_one(
            {"id": existing["id"]},
            {"$set": {
                "valor": valor,
                "observacao": observacao,
                "respondido_por": current_user["id"],
                "data_resposta": now.isoformat()
            }}
        )
        
        # Create history entry
        await create_history_entry(
            "checkpoint_response", existing["id"], "valor",
            existing.get("valor"), valor, current_user["id"]
        )
        
        return {"message": "Resposta atualizada", "id": existing["id"]}
    else:
        # Create new response
        response_doc = {
            "id": generate_id(),
            "checkpoint_id": checkpoint_id,
            "projeto_id": project_id,
            "valor": valor,
            "observacao": observacao,
            "respondido_por": current_user["id"],
            "data_resposta": now.isoformat()
        }
        
        await db.checkpoint_responses.insert_one(response_doc)
        
        return {"message": "Resposta criada", "id": response_doc["id"]}

# Checkpoint Responses
@router.get("/responses/project/{project_id}", response_model=List[CheckpointResponse])
async def get_project_checkpoint_responses(project_id: str, current_user: dict = Depends(get_current_user)):
    responses = await db.checkpoint_responses.find({"projeto_id": project_id}, {"_id": 0}).to_list(500)
    return deserialize_datetime(responses)

@router.post("/responses", response_model=CheckpointResponse)
async def create_checkpoint_response(response: CheckpointResponseCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    response_dict = response.model_dump()
    
    response_doc = {
        **response_dict,
        "id": generate_id(),
        "respondido_por": current_user["id"],
        "data_resposta": now.isoformat()
    }
    
    await db.checkpoint_responses.insert_one(response_doc)
    
    response_doc['data_resposta'] = now
    
    # Check rules after response
    checkpoint = await db.checkpoints.find_one({"id": response.checkpoint_id})
    if checkpoint:
        # This would trigger rule evaluation - simplified for now
        pass
    
    return response_doc

@router.put("/responses/{response_id}", response_model=CheckpointResponse)
async def update_checkpoint_response(response_id: str, response_update: CheckpointResponseUpdate, current_user: dict = Depends(get_current_user)):
    response = await db.checkpoint_responses.find_one({"id": response_id})
    if not response:
        raise HTTPException(status_code=404, detail="Resposta não encontrada")
    
    update_data = response_update.model_dump(exclude_unset=True)
    
    await db.checkpoint_responses.update_one({"id": response_id}, {"$set": update_data})
    
    updated_response = await db.checkpoint_responses.find_one({"id": response_id}, {"_id": 0})
    return deserialize_datetime(updated_response)
