from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from models import CustomView, CustomViewCreate, CustomViewUpdate
from utils import db, get_current_user, generate_id, serialize_datetime, create_history_entry
from datetime import datetime, timezone

router = APIRouter()

# Available fields for custom views
AVAILABLE_FIELDS = {
    "project": [
        {"field": "of_numero", "label": "Nº OF", "type": "text"},
        {"field": "modelo", "label": "Modelo", "type": "text"},
        {"field": "quantidade", "label": "Quantidade", "type": "number"},
        {"field": "status_projeto", "label": "Status", "type": "status"},
        {"field": "etapa_atual_nome", "label": "Etapa Atual", "type": "stage"},
        {"field": "parceiro_confeccao_nome", "label": "Parceiro Confecção", "type": "text"},
        {"field": "data_encomenda", "label": "Data Encomenda", "type": "date"},
        {"field": "data_prevista_entrega", "label": "Data Entrega Prevista", "type": "date"},
        {"field": "data_real_entrega", "label": "Data Entrega Real", "type": "date"},
        {"field": "producao_confirmada", "label": "Produção Confirmada", "type": "boolean"},
        {"field": "producao_loteada", "label": "Produção Loteada", "type": "boolean"},
        {"field": "progresso_percentagem", "label": "Progresso (%)", "type": "number"},
        {"field": "referencia_tecido", "label": "Referência Tecido", "type": "text"},
        {"field": "fornecedor_tecido_nome", "label": "Fornecedor Tecido", "type": "text"},
        {"field": "observacoes", "label": "Observações", "type": "text"},
        {"field": "criado_em", "label": "Data Criação", "type": "date"},
    ]
}

# Editable fields (fields that can be edited inline)
EDITABLE_FIELDS = [
    "modelo", "quantidade", "status_projeto", "data_prevista_entrega",
    "data_real_entrega", "producao_confirmada", "producao_loteada",
    "progresso_percentagem", "referencia_tecido", "observacoes"
]


@router.get("/fields", response_model=Dict[str, Any])
async def get_available_fields(current_user: dict = Depends(get_current_user)):
    """Get all available fields for creating custom views, organized by category"""
    
    # Organize OF fields by category
    of_fields = []
    for field in AVAILABLE_FIELDS["project"]:
        of_fields.append({
            **field,
            "category": "of",
            "category_label": "Ordem de Fabrico"
        })
    
    # Fetch all stages for organizing checkpoints
    stages = await db.stages.find({}, {"_id": 0}).sort("ordem", 1).to_list(100)
    stages_map = {s["id"]: s for s in stages}
    
    # Fetch all checkpoints and organize by stage
    checkpoints = await db.checkpoints.find({}, {"_id": 0}).to_list(100)
    
    # Group checkpoints by stage
    checkpoints_by_stage = {}
    for checkpoint in checkpoints:
        etapa_id = checkpoint.get("etapa_id")
        if etapa_id not in checkpoints_by_stage:
            checkpoints_by_stage[etapa_id] = []
        
        # Map checkpoint type to field type
        checkpoint_type = checkpoint.get("tipo_resposta", "texto")
        field_type = "boolean" if checkpoint_type == "checkbox" else checkpoint_type
        if field_type in ["escolha_unica", "escolha_multipla"]:
            field_type = "text"
        
        stage = stages_map.get(etapa_id, {})
        stage_name = stage.get("nome", "Sem Etapa")
        stage_ordem = stage.get("ordem", 999)
        
        checkpoints_by_stage[etapa_id].append({
            "field": f"checkpoint_{checkpoint['id']}",
            "label": checkpoint['nome'],
            "type": field_type,
            "category": "checkpoint",
            "category_label": "Checkpoints",
            "is_checkpoint": True,
            "checkpoint_id": checkpoint["id"],
            "etapa_id": etapa_id,
            "etapa_nome": stage_name,
            "etapa_ordem": stage_ordem,
            "etapa_cor": stage.get("cor_identificacao", "#64748B")
        })
    
    # Build checkpoint fields sorted by stage order
    checkpoint_fields = []
    for etapa_id in sorted(checkpoints_by_stage.keys(), key=lambda x: stages_map.get(x, {}).get("ordem", 999)):
        checkpoint_fields.extend(checkpoints_by_stage[etapa_id])
    
    # Build grouped structure for frontend
    grouped_fields = {
        "of": {
            "label": "Ordem de Fabrico",
            "icon": "FileText",
            "fields": of_fields
        },
        "checkpoints": {
            "label": "Checkpoints por Etapa",
            "icon": "CheckSquare",
            "stages": []
        }
    }
    
    # Organize checkpoints by stage for nested display
    for stage in stages:
        stage_checkpoints = [cp for cp in checkpoint_fields if cp.get("etapa_id") == stage["id"]]
        if stage_checkpoints:
            grouped_fields["checkpoints"]["stages"].append({
                "id": stage["id"],
                "nome": stage["nome"],
                "cor": stage.get("cor_identificacao", "#64748B"),
                "ordem": stage.get("ordem", 0),
                "fields": stage_checkpoints
            })
    
    # Also return flat list for backwards compatibility
    all_fields = of_fields + checkpoint_fields
    
    return {
        "fields": {"project": all_fields},
        "grouped_fields": grouped_fields,
        "editable_fields": EDITABLE_FIELDS
    }


@router.get("/", response_model=List[CustomView])
async def get_custom_views(
    current_user: dict = Depends(get_current_user)
):
    """Get all custom views (user's own + public with role access + user-specific allowed)"""
    from utils import get_user_permissions
    
    user_role = current_user.get("role", "consulta")
    user_id = current_user.get("id")
    
    # Get user permissions to check allowed_listings
    user_perms = await get_user_permissions(current_user)
    allowed_listings = user_perms.get("allowed_listings", [])
    can_manage = user_perms.get("can_manage_all_projects", False) or user_perms.get("can_configure_system", False)
    
    # Build query based on permissions
    if can_manage:
        # Admins and managers see all
        query = {
            "$or": [
                {"criado_por": user_id},
                {"is_public": True}
            ]
        }
    elif allowed_listings:
        # User has specific listings assigned - show only those
        query = {
            "$or": [
                {"criado_por": user_id},  # Own views
                {"id": {"$in": allowed_listings}}  # Specifically assigned listings
            ]
        }
    else:
        # No specific listings - show by role
        query = {
            "$or": [
                {"criado_por": user_id},
                {
                    "is_public": True,
                    "$or": [
                        {"allowed_roles": None},
                        {"allowed_roles": []},
                        {"allowed_roles": {"$in": [user_role]}}
                    ]
                }
            ]
        }
    
    # Ordenar por ordem de apresentação (menor = primeiro), depois por nome
    views = await db.custom_views.find(query, {"_id": 0}).sort([("ordem", 1), ("nome", 1)]).to_list(100)
    return views


@router.get("/{view_id}", response_model=CustomView)
async def get_custom_view(
    view_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific custom view"""
    view = await db.custom_views.find_one(
        {
            "id": view_id,
            "$or": [
                {"criado_por": current_user["id"]},
                {"is_public": True}
            ]
        },
        {"_id": 0}
    )
    if not view:
        raise HTTPException(status_code=404, detail="Vista não encontrada")
    return view


@router.post("/", response_model=CustomView, status_code=status.HTTP_201_CREATED)
async def create_custom_view(
    view_data: CustomViewCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new custom view"""
    now = datetime.now(timezone.utc)
    
    view_dict = view_data.model_dump()
    view_doc = {
        **serialize_datetime(view_dict),
        "id": generate_id(),
        "criado_por": current_user["id"],
        "criado_em": now.isoformat(),
        "atualizado_em": now.isoformat()
    }
    
    await db.custom_views.insert_one(view_doc)
    
    view_doc.pop("_id", None)
    return view_doc


@router.put("/{view_id}", response_model=CustomView)
async def update_custom_view(
    view_id: str,
    view_data: CustomViewUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a custom view"""
    existing = await db.custom_views.find_one(
        {"id": view_id, "criado_por": current_user["id"]},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Vista não encontrada ou sem permissão")
    
    update_data = {k: v for k, v in view_data.model_dump().items() if v is not None}
    update_data["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    
    await db.custom_views.update_one(
        {"id": view_id},
        {"$set": serialize_datetime(update_data)}
    )
    
    updated = await db.custom_views.find_one({"id": view_id}, {"_id": 0})
    return updated


@router.delete("/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_view(
    view_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom view"""
    result = await db.custom_views.delete_one(
        {"id": view_id, "criado_por": current_user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vista não encontrada ou sem permissão")


@router.get("/{view_id}/data", response_model=Dict[str, Any])
async def get_view_data(
    view_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get data for a custom view with all related entity names and checkpoint values"""
    view = await db.custom_views.find_one(
        {
            "id": view_id,
            "$or": [
                {"criado_por": current_user["id"]},
                {"is_public": True}
            ]
        },
        {"_id": 0}
    )
    if not view:
        raise HTTPException(status_code=404, detail="Vista não encontrada")
    
    # Separate checkpoint columns from regular columns
    checkpoint_columns = []
    regular_columns = []
    for col in view.get("columns", []):
        if col["field"].startswith("checkpoint_"):
            checkpoint_columns.append(col)
        else:
            regular_columns.append(col)
    
    # Build projection from regular columns
    projection = {"_id": 0, "id": 1}
    for col in regular_columns:
        base_field = col["field"].split("_nome")[0] if col["field"].endswith("_nome") else col["field"]
        projection[base_field] = 1
        # Also include ID fields for related entities
        if col["field"] == "etapa_atual_nome":
            projection["etapa_atual_id"] = 1
        elif col["field"] == "parceiro_confeccao_nome":
            projection["parceiro_confeccao_id"] = 1
        elif col["field"] == "fornecedor_tecido_nome":
            projection["fornecedor_tecido_id"] = 1
    
    # Build filter query
    query = view.get("filters", {}) or {}
    
    # Aplicar filtro de estados se definido na vista
    status_filter = view.get("status_filter")
    if status_filter and len(status_filter) > 0:
        query["status_projeto"] = {"$in": status_filter}
    
    # Build sort
    sort_field = view.get("sort_by") or "criado_em"
    sort_order = 1 if view.get("sort_order", "asc") == "asc" else -1
    
    # Get projects
    projects = await db.projects.find(query, projection).sort([(sort_field, sort_order)]).skip(skip).limit(limit).to_list(limit)
    total = await db.projects.count_documents(query)
    
    # Enrich with related entity names
    stage_ids = set()
    partner_ids = set()
    supplier_ids = set()
    project_ids = []
    
    for p in projects:
        project_ids.append(p["id"])
        if p.get("etapa_atual_id"):
            stage_ids.add(p["etapa_atual_id"])
        if p.get("parceiro_confeccao_id"):
            partner_ids.add(p["parceiro_confeccao_id"])
        if p.get("fornecedor_tecido_id"):
            supplier_ids.add(p["fornecedor_tecido_id"])
    
    # Fetch related entities
    stages_map = {}
    if stage_ids:
        stages = await db.stages.find({"id": {"$in": list(stage_ids)}}, {"_id": 0, "id": 1, "nome": 1, "cor_identificacao": 1}).to_list(100)
        stages_map = {s["id"]: s for s in stages}
    
    partners_map = {}
    if partner_ids:
        partners = await db.partners.find({"id": {"$in": list(partner_ids)}}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
        partners_map = {p["id"]: p for p in partners}
    
    suppliers_map = {}
    if supplier_ids:
        suppliers = await db.suppliers.find({"id": {"$in": list(supplier_ids)}}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
        suppliers_map = {s["id"]: s for s in suppliers}
    
    # Fetch checkpoint responses for projects if there are checkpoint columns
    checkpoint_responses_map = {}  # {project_id: {checkpoint_id: response_value}}
    if checkpoint_columns and project_ids:
        checkpoint_ids = [col.get("checkpoint_id") or col["field"].replace("checkpoint_", "") for col in checkpoint_columns]
        responses = await db.checkpoint_responses.find(
            {"projeto_id": {"$in": project_ids}, "checkpoint_id": {"$in": checkpoint_ids}},
            {"_id": 0}
        ).to_list(1000)
        
        for resp in responses:
            pid = resp["projeto_id"]
            cid = resp["checkpoint_id"]
            if pid not in checkpoint_responses_map:
                checkpoint_responses_map[pid] = {}
            checkpoint_responses_map[pid][cid] = resp.get("valor")
    
    # Enrich projects with names and checkpoint values
    for p in projects:
        if p.get("etapa_atual_id") and p["etapa_atual_id"] in stages_map:
            stage = stages_map[p["etapa_atual_id"]]
            p["etapa_atual_nome"] = stage["nome"]
            p["etapa_atual_cor"] = stage.get("cor_identificacao", "#64748B")
        if p.get("parceiro_confeccao_id") and p["parceiro_confeccao_id"] in partners_map:
            p["parceiro_confeccao_nome"] = partners_map[p["parceiro_confeccao_id"]]["nome"]
        if p.get("fornecedor_tecido_id") and p["fornecedor_tecido_id"] in suppliers_map:
            p["fornecedor_tecido_nome"] = suppliers_map[p["fornecedor_tecido_id"]]["nome"]
        
        # Add checkpoint values
        if p["id"] in checkpoint_responses_map:
            for col in checkpoint_columns:
                checkpoint_id = col.get("checkpoint_id") or col["field"].replace("checkpoint_", "")
                if checkpoint_id in checkpoint_responses_map[p["id"]]:
                    p[col["field"]] = checkpoint_responses_map[p["id"]][checkpoint_id]
                else:
                    p[col["field"]] = None
        else:
            # No responses for this project
            for col in checkpoint_columns:
                p[col["field"]] = None
    
    return {
        "data": projects,
        "total": total,
        "skip": skip,
        "limit": limit,
        "view": view
    }


@router.patch("/{view_id}/data/{project_id}", response_model=Dict[str, Any])
async def update_view_data_field(
    view_id: str,
    project_id: str,
    field_update: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update a single field in a project via custom view (with audit trail)"""
    user_role = current_user.get("role", "consulta")
    
    # Verify view exists and user has access
    view = await db.custom_views.find_one(
        {
            "id": view_id,
            "$or": [
                {"criado_por": current_user["id"]},
                {"is_public": True}
            ]
        },
        {"_id": 0}
    )
    if not view:
        raise HTTPException(status_code=404, detail="Vista não encontrada")
    
    # Check edit permissions
    edit_roles = view.get("edit_roles") or []
    user_role = current_user.get("role", "consulta")
    
    # Map role names (edit_roles uses short names, user has full names)
    role_mapping = {
        "administrador": "admin",
        "admin": "admin",
        "direcao": "admin",
        "producao": "producao",
        "comercial": "comercial",
        "operador": "operador"
    }
    mapped_user_role = role_mapping.get(user_role, user_role)
    
    # Admin/administrador can always edit
    if len(edit_roles) > 0 and mapped_user_role not in edit_roles and user_role != "administrador":
        raise HTTPException(status_code=403, detail="Não tem permissão para editar nesta listagem")
    
    # Verify field is editable in this view
    field_name = field_update.get("field")
    new_value = field_update.get("value")
    
    if not field_name:
        raise HTTPException(status_code=400, detail="Campo não especificado")
    
    # Check if field is editable in this view
    view_columns = {col["field"]: col for col in view.get("columns", [])}
    if field_name not in view_columns or not view_columns[field_name].get("editable"):
        raise HTTPException(status_code=403, detail=f"Campo '{field_name}' não é editável nesta vista")
    
    # Handle checkpoint fields differently
    if field_name.startswith("checkpoint_"):
        checkpoint_id = field_name.replace("checkpoint_", "")
        
        # Get project to verify it exists
        project = await db.projects.find_one({"id": project_id}, {"_id": 0, "id": 1})
        if not project:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
        # Get existing response
        existing_response = await db.checkpoint_responses.find_one(
            {"projeto_id": project_id, "checkpoint_id": checkpoint_id},
            {"_id": 0}
        )
        old_value = existing_response.get("valor") if existing_response else None
        
        now = datetime.now(timezone.utc).isoformat()
        
        if existing_response:
            # Update existing response
            await db.checkpoint_responses.update_one(
                {"projeto_id": project_id, "checkpoint_id": checkpoint_id},
                {"$set": {"valor": new_value, "preenchido_em": now, "preenchido_por": current_user["id"]}}
            )
        else:
            # Create new response
            from utils import generate_id
            response_doc = {
                "id": generate_id(),
                "projeto_id": project_id,
                "checkpoint_id": checkpoint_id,
                "valor": new_value,
                "preenchido_em": now,
                "preenchido_por": current_user["id"],
                "criado_em": now
            }
            await db.checkpoint_responses.insert_one(response_doc)
        
        # Create audit trail
        await create_history_entry(
            entidade="checkpoint_response",
            entidade_id=f"{project_id}_{checkpoint_id}",
            campo="valor",
            valor_anterior=str(old_value) if old_value is not None else None,
            valor_novo=str(new_value) if new_value is not None else None,
            alterado_por=current_user["id"]
        )
        
        return {
            "success": True,
            "project_id": project_id,
            "field": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "updated_by": current_user["nome"],
            "updated_at": now
        }
    
    # Regular field - check if field is in the editable fields list
    if field_name not in EDITABLE_FIELDS:
        raise HTTPException(status_code=403, detail=f"Campo '{field_name}' não pode ser editado")
    
    # Get current project value
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    old_value = project.get(field_name)
    
    # Update project
    update_data = {
        field_name: new_value,
        "atualizado_em": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    # Create audit trail entry
    await create_history_entry(
        entidade="project",
        entidade_id=project_id,
        campo=field_name,
        valor_anterior=str(old_value) if old_value is not None else None,
        valor_novo=str(new_value) if new_value is not None else None,
        alterado_por=current_user["id"]
    )
    
    return {
        "success": True,
        "project_id": project_id,
        "field": field_name,
        "old_value": old_value,
        "new_value": new_value,
        "updated_by": current_user["nome"],
        "updated_at": update_data["atualizado_em"]
    }
