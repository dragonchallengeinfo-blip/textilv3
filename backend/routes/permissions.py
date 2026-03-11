from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from utils import db, get_current_user, generate_id

router = APIRouter()

# ============== MODELS ==============

# Default permissions by role
DEFAULT_ROLE_PERMISSIONS = {
    "administrador": {
        "menus": ["dashboard", "operator", "projects", "confeccao-planning", "confeccao-performance", 
                  "planning", "timeline", "capacity", "reports", "listings", "order-types",
                  "stages", "checkpoints", "rules", "brands", "partners", "suppliers", 
                  "users", "history", "permissions"],
        "actions": ["create", "edit", "delete", "view", "approve", "export", "manage_users", "manage_permissions"],
        "can_manage_all_projects": True,
        "can_view_all_reports": True,
        "can_configure_system": True
    },
    "direcao": {
        "menus": ["dashboard", "operator", "projects", "confeccao-planning", "confeccao-performance",
                  "planning", "timeline", "capacity", "reports", "listings", "brands", 
                  "partners", "suppliers", "history"],
        "actions": ["create", "edit", "view", "approve", "export"],
        "can_manage_all_projects": True,
        "can_view_all_reports": True,
        "can_configure_system": False
    },
    "comercial": {
        "menus": ["dashboard", "projects", "planning", "timeline", "reports"],
        "actions": ["create", "edit", "view", "export"],
        "can_manage_all_projects": False,
        "can_view_all_reports": False,
        "can_configure_system": False
    },
    "producao": {
        "menus": ["dashboard", "operator", "projects", "confeccao-planning", "timeline", "reports"],
        "actions": ["view", "edit", "export"],
        "can_manage_all_projects": False,
        "can_view_all_reports": False,
        "can_configure_system": False,
        "checkpoint_stages": []  # Will be filled with stage IDs this role can do checkpoints
    },
    "operador": {
        "menus": ["dashboard", "operator", "projects"],
        "actions": ["view"],
        "can_manage_all_projects": False,
        "can_view_all_reports": False,
        "can_configure_system": False,
        "checkpoint_stages": []  # Specific stages where they can fill checkpoints
    }
}

# All available menus
ALL_MENUS = [
    {"id": "dashboard", "label": "Dashboard", "category": "principal"},
    {"id": "projects", "label": "Projetos", "category": "principal"},
    {"id": "operator", "label": "Confeções", "category": "principal"},
    {"id": "confeccao-planning", "label": "Plan. Confeções", "category": "principal"},
    {"id": "confeccao-performance", "label": "Performance Conf.", "category": "principal"},
    {"id": "planning", "label": "Planeamento", "category": "principal"},
    {"id": "timeline", "label": "Timeline", "category": "principal"},
    {"id": "capacity", "label": "Capacidade", "category": "principal"},
    {"id": "reports", "label": "Relatórios", "category": "principal"},
    {"id": "listings", "label": "Listagens", "category": "configuracoes"},
    {"id": "order-types", "label": "Tipos de Ordem", "category": "configuracoes"},
    {"id": "stages", "label": "Etapas", "category": "configuracoes"},
    {"id": "checkpoints", "label": "Checkpoints", "category": "configuracoes"},
    {"id": "rules", "label": "Regras", "category": "configuracoes"},
    {"id": "brands", "label": "Marcas", "category": "configuracoes"},
    {"id": "partners", "label": "Parceiros", "category": "configuracoes"},
    {"id": "suppliers", "label": "Fornecedores", "category": "configuracoes"},
    {"id": "users", "label": "Utilizadores", "category": "admin"},
    {"id": "history", "label": "Histórico", "category": "admin"},
    {"id": "permissions", "label": "Permissões", "category": "admin"}
]

# All available actions
ALL_ACTIONS = [
    {"id": "view", "label": "Visualizar"},
    {"id": "create", "label": "Criar"},
    {"id": "edit", "label": "Editar"},
    {"id": "delete", "label": "Eliminar"},
    {"id": "approve", "label": "Aprovar"},
    {"id": "export", "label": "Exportar"},
    {"id": "manage_users", "label": "Gerir Utilizadores"},
    {"id": "manage_permissions", "label": "Gerir Permissões"}
]


class RolePermissions(BaseModel):
    role: str
    menus: List[str] = []
    actions: List[str] = []
    can_manage_all_projects: bool = False
    can_view_all_reports: bool = False
    can_configure_system: bool = False
    checkpoint_stages: List[str] = []  # Stage IDs where role can do checkpoints
    allowed_listings: List[str] = []  # Custom listing IDs this role can access


class UserPermissions(BaseModel):
    user_id: str
    custom_menus: Optional[List[str]] = None  # If set, overrides role menus
    custom_actions: Optional[List[str]] = None
    checkpoint_stages: List[str] = []  # Additional stages for this specific user
    allowed_listings: List[str] = []  # Additional listings for this user


# ============== ROUTES ==============

@router.get("/options")
async def get_permission_options(current_user: dict = Depends(get_current_user)):
    """Get all available menus, actions, stages for permission configuration"""
    if current_user.get("role") not in ["administrador"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    stages = await db.stages.find({"ativa": True}, {"_id": 0, "id": 1, "nome": 1}).sort("ordem", 1).to_list(100)
    listings = await db.custom_views.find({}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    
    return {
        "menus": ALL_MENUS,
        "actions": ALL_ACTIONS,
        "stages": stages,
        "listings": listings,
        "roles": list(DEFAULT_ROLE_PERMISSIONS.keys())
    }


@router.get("/roles")
async def get_role_permissions(current_user: dict = Depends(get_current_user)):
    """Get permissions for all roles"""
    if current_user.get("role") not in ["administrador"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Get saved permissions from DB or use defaults
    role_permissions = {}
    for role in DEFAULT_ROLE_PERMISSIONS.keys():
        saved = await db.role_permissions.find_one({"role": role}, {"_id": 0})
        if saved:
            role_permissions[role] = saved
        else:
            role_permissions[role] = {"role": role, **DEFAULT_ROLE_PERMISSIONS[role]}
    
    return role_permissions


@router.get("/roles/{role}")
async def get_single_role_permissions(
    role: str,
    current_user: dict = Depends(get_current_user)
):
    """Get permissions for a specific role"""
    if current_user.get("role") not in ["administrador"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    saved = await db.role_permissions.find_one({"role": role}, {"_id": 0})
    if saved:
        return saved
    
    if role in DEFAULT_ROLE_PERMISSIONS:
        return {"role": role, **DEFAULT_ROLE_PERMISSIONS[role]}
    
    raise HTTPException(status_code=404, detail="Role não encontrado")


@router.put("/roles/{role}")
async def update_role_permissions(
    role: str,
    permissions: RolePermissions,
    current_user: dict = Depends(get_current_user)
):
    """Update permissions for a role"""
    if current_user.get("role") not in ["administrador"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    now = datetime.now(timezone.utc).isoformat()
    
    perm_dict = permissions.model_dump()
    perm_dict["atualizado_em"] = now
    perm_dict["atualizado_por"] = current_user["id"]
    
    await db.role_permissions.update_one(
        {"role": role},
        {"$set": perm_dict},
        upsert=True
    )
    
    return perm_dict


@router.get("/users/{user_id}")
async def get_user_permissions(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific permissions for a user"""
    if current_user.get("role") not in ["administrador"] and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Get user
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    # Get role permissions
    role = user.get("role", "operador")
    role_perms = await db.role_permissions.find_one({"role": role}, {"_id": 0})
    if not role_perms:
        role_perms = {"role": role, **DEFAULT_ROLE_PERMISSIONS.get(role, DEFAULT_ROLE_PERMISSIONS["operador"])}
    
    # Get user-specific permissions
    user_perms = await db.user_permissions.find_one({"user_id": user_id}, {"_id": 0})
    
    # Merge permissions
    final_perms = {
        "user_id": user_id,
        "user_name": user.get("nome"),
        "role": role,
        "menus": user_perms.get("custom_menus") if user_perms and user_perms.get("custom_menus") else role_perms.get("menus", []),
        "actions": user_perms.get("custom_actions") if user_perms and user_perms.get("custom_actions") else role_perms.get("actions", []),
        "can_manage_all_projects": role_perms.get("can_manage_all_projects", False),
        "can_view_all_reports": role_perms.get("can_view_all_reports", False),
        "can_configure_system": role_perms.get("can_configure_system", False),
        "checkpoint_stages": list(set(
            role_perms.get("checkpoint_stages", []) + 
            (user_perms.get("checkpoint_stages", []) if user_perms else [])
        )),
        "allowed_listings": list(set(
            role_perms.get("allowed_listings", []) + 
            (user_perms.get("allowed_listings", []) if user_perms else [])
        ))
    }
    
    return final_perms


@router.put("/users/{user_id}")
async def update_user_permissions(
    user_id: str,
    permissions: UserPermissions,
    current_user: dict = Depends(get_current_user)
):
    """Update specific permissions for a user"""
    if current_user.get("role") not in ["administrador"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    # Verify user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    
    now = datetime.now(timezone.utc).isoformat()
    
    perm_dict = permissions.model_dump()
    perm_dict["atualizado_em"] = now
    perm_dict["atualizado_por"] = current_user["id"]
    
    await db.user_permissions.update_one(
        {"user_id": user_id},
        {"$set": perm_dict},
        upsert=True
    )
    
    return perm_dict


@router.get("/my-permissions")
async def get_my_permissions(current_user: dict = Depends(get_current_user)):
    """Get current user's effective permissions"""
    from utils import get_user_permissions as get_perms
    return await get_perms(current_user)


# ============== LISTING PERMISSIONS ==============

@router.put("/listings/{listing_id}/access")
async def update_listing_access(
    listing_id: str,
    allowed_roles: List[str],
    allowed_users: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Update who can access a specific listing"""
    if current_user.get("role") not in ["administrador", "direcao"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    listing = await db.custom_views.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listagem não encontrada")
    
    await db.custom_views.update_one(
        {"id": listing_id},
        {"$set": {
            "allowed_roles": allowed_roles,
            "allowed_users": allowed_users,
            "atualizado_em": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Permissões atualizadas"}


# ============== CHECKPOINT STAGE PERMISSIONS ==============

@router.post("/checkpoint-complete")
async def complete_checkpoint_and_check_advance(
    project_id: str,
    checkpoint_id: str,
    response_value: Any,
    current_user: dict = Depends(get_current_user)
):
    """
    Complete a checkpoint and check if all mandatory checkpoints are done
    to advance to the next stage
    """
    # Get project
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    current_stage_id = project.get("etapa_atual_id")
    
    # Check if user has permission for this stage
    user_perms = await get_user_permissions(current_user["id"], current_user)
    allowed_stages = user_perms.get("checkpoint_stages", [])
    
    # Admins and directors can do any checkpoint
    if current_user.get("role") not in ["administrador", "direcao"]:
        if current_stage_id not in allowed_stages and len(allowed_stages) > 0:
            raise HTTPException(status_code=403, detail="Sem permissão para preencher checkpoints nesta etapa")
    
    # Get checkpoint
    checkpoint = await db.checkpoints.find_one({"id": checkpoint_id})
    if not checkpoint:
        raise HTTPException(status_code=404, detail="Checkpoint não encontrado")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Save checkpoint response
    response_doc = {
        "id": generate_id(),
        "projeto_id": project_id,
        "checkpoint_id": checkpoint_id,
        "valor": response_value,
        "respondido_por": current_user["id"],
        "respondido_por_nome": current_user.get("nome"),
        "data_resposta": now
    }
    
    # Update or insert
    await db.checkpoint_responses.update_one(
        {"projeto_id": project_id, "checkpoint_id": checkpoint_id},
        {"$set": response_doc},
        upsert=True
    )
    
    # Check if all mandatory checkpoints for current stage are done
    mandatory_checkpoints = await db.checkpoints.find({
        "etapa_id": current_stage_id,
        "obrigatorio": True,
        "ativo": True
    }, {"_id": 0, "id": 1}).to_list(100)
    
    mandatory_ids = [c["id"] for c in mandatory_checkpoints]
    
    if mandatory_ids:
        responses = await db.checkpoint_responses.find({
            "projeto_id": project_id,
            "checkpoint_id": {"$in": mandatory_ids}
        }).to_list(100)
        
        completed_ids = [r["checkpoint_id"] for r in responses]
        
        all_done = all(mid in completed_ids for mid in mandatory_ids)
        
        if all_done:
            # Get next stage
            current_stage = await db.stages.find_one({"id": current_stage_id})
            if current_stage:
                next_stage = await db.stages.find_one({
                    "ordem": {"$gt": current_stage.get("ordem", 0)},
                    "ativa": True
                }, sort=[("ordem", 1)])
                
                if next_stage:
                    # Advance to next stage
                    await db.projects.update_one(
                        {"id": project_id},
                        {"$set": {
                            "etapa_atual_id": next_stage["id"],
                            "atualizado_em": now
                        }}
                    )
                    
                    # Create timeline event
                    event = {
                        "id": generate_id(),
                        "projeto_id": project_id,
                        "tipo_evento": "avanco_etapa",
                        "descricao": f"Avançou de {current_stage.get('nome')} para {next_stage.get('nome')}",
                        "etapa_anterior_id": current_stage_id,
                        "etapa_nova_id": next_stage["id"],
                        "criado_por": current_user["id"],
                        "criado_por_nome": current_user.get("nome"),
                        "data_evento": now,
                        "automatico": True
                    }
                    await db.timeline_events.insert_one(event)
                    
                    return {
                        "checkpoint_saved": True,
                        "stage_advanced": True,
                        "new_stage": next_stage.get("nome"),
                        "message": f"Checkpoint guardado. Projeto avançou para {next_stage.get('nome')}"
                    }
    
    return {
        "checkpoint_saved": True,
        "stage_advanced": False,
        "message": "Checkpoint guardado"
    }
