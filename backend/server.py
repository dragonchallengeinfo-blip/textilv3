from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET", "textile-ops-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Import routes
from routes import auth, users, projects, order_types, stages, partners, suppliers, checkpoints, rules, dashboard, production, alerts, history, rule_engine, custom_views, planning, timeline, capacity, brands, reservas, piece_cost, ai_assistant, reports, permissions, export, operator, realtime

# Include all routers
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(order_types.router, prefix="/order-types", tags=["order-types"])
api_router.include_router(stages.router, prefix="/stages", tags=["stages"])
api_router.include_router(partners.router, prefix="/partners", tags=["partners"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(checkpoints.router, prefix="/checkpoints", tags=["checkpoints"])
api_router.include_router(rules.router, prefix="/rules", tags=["rules"])
api_router.include_router(rule_engine.router, prefix="/rule-engine", tags=["rule-engine"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(production.router, prefix="/production", tags=["production"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
api_router.include_router(custom_views.router, prefix="/custom-views", tags=["custom-views"])
api_router.include_router(planning.router, prefix="/planning", tags=["planning"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
api_router.include_router(capacity.router, prefix="/capacity", tags=["capacity"])
api_router.include_router(brands.router, prefix="/brands", tags=["brands"])
api_router.include_router(reservas.router, prefix="/reservas", tags=["reservas"])
api_router.include_router(piece_cost.router, prefix="/piece-cost", tags=["piece-cost"])
api_router.include_router(ai_assistant.router, prefix="/ai", tags=["ai-assistant"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(operator.router, prefix="/operator", tags=["operator"])
api_router.include_router(realtime.router, prefix="/realtime", tags=["realtime"])

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def startup_db():
    # ========== ÍNDICES OTIMIZADOS ==========
    
    # Users - índice único
    await db.users.create_index("email", unique=True)
    
    # Projects - índices simples
    await db.projects.create_index("of_numero")
    await db.projects.create_index("status_projeto")
    await db.projects.create_index("etapa_atual_id")
    
    # Projects - índices compostos para queries frequentes (NOVO)
    await db.projects.create_index([
        ("status_projeto", 1),
        ("data_prevista_entrega", 1)
    ], name="idx_status_entrega")
    
    await db.projects.create_index([
        ("parceiro_confeccao_id", 1),
        ("status_projeto", 1)
    ], name="idx_confeccao_status")
    
    await db.projects.create_index("marca_id", name="idx_marca")
    await db.projects.create_index("comercial_responsavel_id", name="idx_comercial")
    await db.projects.create_index("data_prevista_entrega", name="idx_data_entrega")
    await db.projects.create_index("criado_em", name="idx_criado_em")
    
    # Stage Planning - índices para joins
    await db.stage_planning.create_index("projeto_id", name="idx_planning_projeto")
    await db.stage_planning.create_index([
        ("projeto_id", 1),
        ("etapa_key", 1)
    ], name="idx_planning_projeto_etapa")
    
    # Checkpoint Responses - índices para joins
    await db.checkpoint_responses.create_index("projeto_id", name="idx_checkpoint_projeto")
    await db.checkpoint_responses.create_index([
        ("checkpoint_id", 1),
        ("projeto_id", 1)
    ], name="idx_checkpoint_checkpoint_projeto")
    
    # Alerts - índices para dashboard
    await db.alerts.create_index("projeto_id", name="idx_alerts_projeto")
    await db.alerts.create_index([
        ("visto", 1),
        ("criado_em", -1)
    ], name="idx_alerts_visto_data")
    
    # Rule Execution Logs - TTL index (auto-delete após 90 dias)
    await db.rule_execution_logs.create_index(
        "executed_at",
        expireAfterSeconds=90 * 24 * 60 * 60,  # 90 dias
        name="idx_logs_ttl"
    )
    
    # History - índices para auditoria
    await db.history.create_index("entidade_id", name="idx_history_entidade")
    await db.history.create_index([
        ("entidade", 1),
        ("entidade_id", 1)
    ], name="idx_history_entidade_id")
    
    # Timeline Events - índices
    await db.timeline_events.create_index("projeto_id", name="idx_timeline_projeto")
    await db.timeline_events.create_index([
        ("projeto_id", 1),
        ("tipo_evento", 1)
    ], name="idx_timeline_projeto_tipo")
    
    # Attachments - índice
    await db.attachments.create_index("projeto_id", name="idx_attachments_projeto")
    
    logger.info("Database indexes created (optimized version)")
