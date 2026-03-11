from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from functools import lru_cache
import os
import uuid

# ========== CONEXÃO MONGODB OTIMIZADA ==========
# Singleton pattern - uma única conexão para toda a aplicação
# Configuração com connection pooling otimizado

_client = None
_db = None

def get_mongo_client():
    """Get MongoDB client singleton with optimized connection pool"""
    global _client
    if _client is None:
        mongo_url = os.environ['MONGO_URL']
        _client = AsyncIOMotorClient(
            mongo_url,
            maxPoolSize=50,           # Máximo de conexões no pool
            minPoolSize=5,            # Mínimo de conexões mantidas
            maxIdleTimeMS=30000,      # Tempo máximo idle (30s)
            serverSelectionTimeoutMS=5000,  # Timeout de seleção do servidor
            connectTimeoutMS=10000,   # Timeout de conexão
            socketTimeoutMS=30000,    # Timeout de socket
        )
    return _client

def get_database():
    """Get database instance"""
    global _db
    if _db is None:
        client = get_mongo_client()
        _db = client[os.environ['DB_NAME']]
    return _db

# Alias para compatibilidade com código existente
db = property(lambda self: get_database())

# Acesso directo para imports existentes
class DBAccessor:
    @property
    def users(self):
        return get_database().users
    @property
    def projects(self):
        return get_database().projects
    @property
    def stages(self):
        return get_database().stages
    @property
    def partners(self):
        return get_database().partners
    @property
    def suppliers(self):
        return get_database().suppliers
    @property
    def order_types(self):
        return get_database().order_types
    @property
    def checkpoints(self):
        return get_database().checkpoints
    @property
    def checkpoint_responses(self):
        return get_database().checkpoint_responses
    @property
    def rules(self):
        return get_database().rules
    @property
    def alerts(self):
        return get_database().alerts
    @property
    def history(self):
        return get_database().history
    @property
    def stage_planning(self):
        return get_database().stage_planning
    @property
    def custom_views(self):
        return get_database().custom_views
    @property
    def timeline_events(self):
        return get_database().timeline_events
    @property
    def brands(self):
        return get_database().brands
    @property
    def reservas(self):
        return get_database().reservas
    @property
    def piece_cost_calculations(self):
        return get_database().piece_cost_calculations
    @property
    def permissions(self):
        return get_database().permissions
    @property
    def role_permissions(self):
        return get_database().role_permissions
    @property
    def user_permissions(self):
        return get_database().user_permissions
    @property
    def rule_execution_logs(self):
        return get_database().rule_execution_logs
    @property
    def attachments(self):
        return get_database().attachments
    @property
    def notifications(self):
        return get_database().notifications
    @property
    def negociacoes(self):
        return get_database().negociacoes

# Instância global para compatibilidade
db = DBAccessor()

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET", "textile-ops-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise credentials_exception
    
    # Convert datetime strings back to datetime objects
    if isinstance(user.get('criado_em'), str):
        user['criado_em'] = datetime.fromisoformat(user['criado_em'])
    if isinstance(user.get('atualizado_em'), str):
        user['atualizado_em'] = datetime.fromisoformat(user['atualizado_em'])
    
    return user

def generate_id() -> str:
    return str(uuid.uuid4())

def serialize_datetime(obj):
    """Convert datetime objects to ISO format strings for MongoDB"""
    if isinstance(obj, dict):
        return {k: serialize_datetime(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_datetime(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def deserialize_datetime(obj, datetime_fields=None):
    """Convert ISO format strings back to datetime objects"""
    if datetime_fields is None:
        datetime_fields = ['criado_em', 'atualizado_em', 'data_resposta', 'data', 
                          'data_encomenda', 'data_prevista_entrega', 'data_real_entrega',
                          'data_inicio_prevista', 'data_fim_prevista', 
                          'data_inicio_real', 'data_fim_real']
    
    if isinstance(obj, dict):
        for field in datetime_fields:
            if field in obj and isinstance(obj[field], str):
                obj[field] = datetime.fromisoformat(obj[field])
        return obj
    elif isinstance(obj, list):
        return [deserialize_datetime(item, datetime_fields) for item in obj]
    return obj

async def create_history_entry(entidade: str, entidade_id: str, campo: str, 
                              valor_anterior: str, valor_novo: str, alterado_por: str):
    """Create a history entry for audit trail"""
    entry = {
        "id": generate_id(),
        "entidade": entidade,
        "entidade_id": entidade_id,
        "campo": campo,
        "valor_anterior": valor_anterior,
        "valor_novo": valor_novo,
        "alterado_por": alterado_por,
        "data": datetime.now(timezone.utc).isoformat()
    }
    await db.history.insert_one(entry)



# ========== PERMISSÕES E FILTRAGEM DE DADOS ==========

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
        "menus": ["dashboard", "operator", "projects", "confeccao-planning", "timeline", "reports", "listings"],
        "actions": ["view", "edit", "export"],
        "can_manage_all_projects": False,
        "can_view_all_reports": False,
        "can_configure_system": False
    },
    "operador": {
        "menus": ["dashboard", "operator", "projects", "listings"],
        "actions": ["view"],
        "can_manage_all_projects": False,
        "can_view_all_reports": False,
        "can_configure_system": False
    }
}

async def get_user_permissions(user: dict) -> dict:
    """Get effective permissions for a user (role + user-specific)"""
    role = user.get("role", "operador")
    user_id = user.get("id")
    
    # Get role permissions
    role_perms = await db.role_permissions.find_one({"role": role}, {"_id": 0})
    if not role_perms:
        role_perms = {"role": role, **DEFAULT_ROLE_PERMISSIONS.get(role, DEFAULT_ROLE_PERMISSIONS["operador"])}
    
    # Get user-specific permissions
    user_perms = await db.user_permissions.find_one({"user_id": user_id}, {"_id": 0})
    
    # Merge permissions
    return {
        "user_id": user_id,
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

async def get_allowed_project_ids(user: dict) -> list:
    """Get list of project IDs the user has access to based on their allowed listings"""
    perms = await get_user_permissions(user)
    
    # Admin and users with can_manage_all_projects see everything
    if perms.get("can_manage_all_projects"):
        return None  # None means no filter needed
    
    # Get allowed listings
    allowed_listings = perms.get("allowed_listings", [])
    
    # If no listings assigned, return empty (no access)
    if not allowed_listings:
        return []
    
    # Get all custom views and their filters
    project_ids = set()
    
    for listing_id in allowed_listings:
        view = await db.custom_views.find_one({"id": listing_id}, {"_id": 0, "filters": 1})
        if view:
            # Get projects matching this view's filters
            filters = view.get("filters", {}) or {}
            projects = await db.projects.find(filters, {"_id": 0, "id": 1}).to_list(1000)
            project_ids.update(p["id"] for p in projects)
    
    return list(project_ids)

async def build_project_filter_for_user(user: dict, base_filter: dict = None) -> dict:
    """Build MongoDB filter that restricts to user's allowed projects"""
    if base_filter is None:
        base_filter = {}
    
    allowed_ids = await get_allowed_project_ids(user)
    
    # None means no filter needed (admin)
    if allowed_ids is None:
        return base_filter
    
    # Add project ID filter
    if allowed_ids:
        return {**base_filter, "id": {"$in": allowed_ids}}
    else:
        # No allowed projects - return impossible filter
        return {**base_filter, "id": {"$in": ["__none__"]}}
