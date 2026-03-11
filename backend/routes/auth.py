from fastapi import APIRouter, HTTPException, status
from models import UserLogin, Token, User, UserCreate
from utils import (
    db, verify_password, get_password_hash, create_access_token,
    generate_id, serialize_datetime
)
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(user_login: UserLogin):
    # Find user by email
    user = await db.users.find_one({"email": user_login.email}, {"_id": 0})
    
    if not user or not verify_password(user_login.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou password incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("ativo", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilizador inativo"
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user["id"], "email": user["email"]},
        expires_delta=timedelta(minutes=60 * 24 * 7)  # 7 days
    )
    
    # Remove password from response
    user.pop("hashed_password", None)
    
    # Convert datetime strings
    if isinstance(user.get('criado_em'), str):
        user['criado_em'] = datetime.fromisoformat(user['criado_em'])
    if isinstance(user.get('atualizado_em'), str):
        user['atualizado_em'] = datetime.fromisoformat(user['atualizado_em'])
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/register", response_model=User)
async def register(user_create: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_create.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email já registado"
        )
    
    # Create user
    now = datetime.now(timezone.utc)
    user_dict = user_create.model_dump()
    password = user_dict.pop("password")
    
    user_doc = {
        **user_dict,
        "id": generate_id(),
        "hashed_password": get_password_hash(password),
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Remove password and convert dates for response
    user_doc.pop("hashed_password")
    user_doc['criado_em'] = now
    user_doc['atualizado_em'] = now
    
    return user_doc
