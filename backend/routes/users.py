from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from models import User, UserCreate, UserUpdate
from utils import (
    db, get_current_user, get_password_hash, generate_id,
    serialize_datetime, deserialize_datetime, create_history_entry
)
from datetime import datetime, timezone

router = APIRouter()

@router.get("/", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(1000)
    return deserialize_datetime(users)

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return current_user

@router.get("/{user_id}", response_model=User)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    return deserialize_datetime(user)

@router.post("/", response_model=User)
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    # Check if admin
    if current_user.get("role") != "administrador":
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já existe")
    
    now = datetime.now(timezone.utc)
    user_dict = user.model_dump()
    password = user_dict.pop("password")
    
    user_doc = {
        **user_dict,
        "id": generate_id(),
        "hashed_password": get_password_hash(password),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    user_doc.pop("hashed_password")
    user_doc['criado_em'] = now
    user_doc['atualizado_em'] = now
    
    return user_doc

@router.put("/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    # Check permissions
    if current_user.get("role") != "administrador" and current_user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    # Create history entries
    for field, new_value in update_data.items():
        if field in user and user[field] != new_value:
            await create_history_entry(
                "user", user_id, field,
                str(user[field]), str(new_value),
                current_user["id"]
            )
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    return deserialize_datetime(updated_user)

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "administrador":
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    return {"message": "Utilizador eliminado"}

@router.post("/complete-setup")
async def complete_setup(current_user: dict = Depends(get_current_user)):
    """Mark setup wizard as completed for current user"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"setup_completed": True, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Setup concluído com sucesso"}

@router.post("/reset-setup")
async def reset_setup(current_user: dict = Depends(get_current_user)):
    """Reset setup wizard to show it again"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"setup_completed": False, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Setup resetado"}
