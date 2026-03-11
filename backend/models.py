from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "administrador"
    DIRECTION = "direcao"
    COMMERCIAL = "comercial"
    PRODUCTION = "producao"
    QUALITY = "qualidade"
    OPERATOR = "operador"
    PARTNER = "parceiro_externo"
    VIEW_ONLY = "consulta"

class ProjectStatus(str, Enum):
    DRAFT = "rascunho"
    ACTIVE = "ativo"
    DELAYED = "atrasado"
    BLOCKED = "bloqueado"
    COMPLETED = "concluido"
    CANCELLED = "cancelado"

class StageStatus(str, Enum):
    NOT_STARTED = "nao_iniciado"
    IN_PROGRESS = "em_progresso"
    ON_TIME = "dentro_prazo"
    AT_RISK = "risco"
    DELAYED = "atrasado"
    COMPLETED = "concluido"
    BLOCKED = "bloqueado"

class PartnerType(str, Enum):
    CONFECTION = "confeccao"
    LAUNDRY = "lavandaria"
    FINISHING = "acabamento"
    PRINTING = "estampagem"
    EMBROIDERY = "bordado"
    OTHER = "outro"

class CheckpointType(str, Enum):
    DATE = "data"
    CHECKBOX = "checkbox"
    TEXT = "texto"
    LONG_TEXT = "texto_longo"
    NUMBER = "numero"
    MULTIPLE_CHOICE = "multipla_escolha"
    SINGLE_CHOICE = "escolha_unica"
    STATUS = "status"
    PARTNER = "parceiro"
    OPERATOR = "operador"
    ALERT = "alerta"
    FILE = "upload"
    STAGE_TRANSITION = "transicao_etapa"

class CheckpointCategory(str, Enum):
    INFORMATIVE = "informativo"
    VALIDATION = "validacao"
    ALERT = "alerta"
    TRANSITION = "transicao"
    AUTOMATION = "automacao"

class RuleOperator(str, Enum):
    EQUAL = "igual"
    NOT_EQUAL = "diferente"
    GREATER = "maior"
    LESS = "menor"
    FILLED = "preenchido"
    EMPTY = "vazio"
    DATE_BEFORE = "data_anterior"
    DATE_AFTER = "data_posterior"

class RuleAction(str, Enum):
    CHANGE_STAGE = "mudar_etapa"
    CHANGE_STATUS = "mudar_status"
    BLOCK_STAGE = "bloquear_etapa"
    UNBLOCK_STAGE = "desbloquear_etapa"
    CREATE_ALERT = "criar_alerta"
    ASSIGN_RESPONSIBLE = "atribuir_responsavel"
    GO_BACK_STAGE = "voltar_etapa"
    COMPLETE_PROJECT = "concluir_projeto"
    FILL_FIELD = "preencher_campo"
    MAKE_REQUIRED = "tornar_obrigatorio"

# Base Models
class UserBase(BaseModel):
    email: str
    nome: str
    role: UserRole
    ativo: bool = True
    setup_completed: bool = False

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    role: Optional[UserRole] = None
    ativo: Optional[bool] = None
    password: Optional[str] = None
    setup_completed: Optional[bool] = None

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Order Types
class OrderTypeBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    ativo: bool = True
    ordem_padrao_etapas: List[str] = []  # List of stage IDs

class OrderTypeCreate(OrderTypeBase):
    pass

class OrderTypeUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None
    ordem_padrao_etapas: Optional[List[str]] = None

class OrderType(OrderTypeBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

# Stages
class StageBase(BaseModel):
    nome: str
    ordem: int
    cor_identificacao: str = "#64748B"
    descricao: Optional[str] = None
    ativa: bool = True
    permite_parceiro: bool = True
    exige_checkpoint_obrigatorio: bool = False
    bloqueia_proxima_etapa: bool = False

class StageCreate(StageBase):
    pass

class StageUpdate(BaseModel):
    nome: Optional[str] = None
    ordem: Optional[int] = None
    cor_identificacao: Optional[str] = None
    descricao: Optional[str] = None
    ativa: Optional[bool] = None
    permite_parceiro: Optional[bool] = None
    exige_checkpoint_obrigatorio: Optional[bool] = None
    bloqueia_proxima_etapa: Optional[bool] = None

class Stage(StageBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

# Partners
class PartnerBase(BaseModel):
    nome: str
    codigo: Optional[str] = None
    tipo_servico: PartnerType
    email: Optional[str] = None
    telefone: Optional[str] = None
    morada: Optional[str] = None
    # Capacity fields for confeccao
    num_trabalhadores: Optional[int] = None
    capacidade_pecas_mes: Optional[int] = None
    capacidade_projetos_mes: Optional[int] = None
    taxa_ocupacao: Optional[float] = None  # % of capacity dedicated to this user
    eficiencia: Optional[float] = None  # % efficiency rating
    taxa_qualidade: Optional[float] = None
    capacidade_horas_mes: Optional[int] = None  # Calculated available hours
    # Simplified profile fields for lavandaria, acabamento, etc
    tempo_processamento_medio: Optional[float] = None  # Average processing time in hours
    capacidade_pecas_dia: Optional[int] = None  # Pieces per day capacity
    prazo_entrega_padrao: Optional[int] = None  # Standard delivery time in days
    ativo: bool = True

class PartnerCreate(PartnerBase):
    pass

class PartnerUpdate(BaseModel):
    nome: Optional[str] = None
    codigo: Optional[str] = None
    tipo_servico: Optional[PartnerType] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    morada: Optional[str] = None
    num_trabalhadores: Optional[int] = None
    capacidade_pecas_mes: Optional[int] = None
    capacidade_projetos_mes: Optional[int] = None
    taxa_ocupacao: Optional[float] = None
    eficiencia: Optional[float] = None
    taxa_qualidade: Optional[float] = None
    capacidade_horas_mes: Optional[int] = None
    tempo_processamento_medio: Optional[float] = None
    capacidade_pecas_dia: Optional[int] = None
    prazo_entrega_padrao: Optional[int] = None
    ativo: Optional[bool] = None

class Partner(PartnerBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

# Suppliers
class SupplierBase(BaseModel):
    nome: str
    codigo: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    morada: Optional[str] = None
    ativo: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    nome: Optional[str] = None
    codigo: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    morada: Optional[str] = None
    ativo: Optional[bool] = None

class Supplier(SupplierBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

# Brands (Marcas)
class BrandBase(BaseModel):
    nome: str
    codigo: Optional[str] = None
    logo_url: Optional[str] = None
    ativo: bool = True

class BrandCreate(BrandBase):
    pass

class BrandUpdate(BaseModel):
    nome: Optional[str] = None
    codigo: Optional[str] = None
    logo_url: Optional[str] = None
    ativo: Optional[bool] = None

class Brand(BrandBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime


# Projects
class ProjectBase(BaseModel):
    of_numero: str
    tipo_ordem_id: str
    marca_id: Optional[str] = None
    cliente_id: Optional[str] = None
    modelo: str
    quantidade: int
    proto_id: Optional[str] = None
    comercial_responsavel_id: Optional[str] = None
    parceiro_confeccao_id: Optional[str] = None
    data_encomenda: datetime
    data_prevista_entrega: datetime
    data_real_entrega: Optional[datetime] = None
    data_entrada_confecao: Optional[datetime] = None  # New: Garment factory entry date
    producao_confirmada: bool = False
    producao_loteada: bool = False
    obriga_prototipo: bool = False
    fornecedor_tecido_id: Optional[str] = None
    referencia_tecido: Optional[str] = None
    descricao: Optional[str] = None
    observacoes: Optional[str] = None
    status_projeto: ProjectStatus = ProjectStatus.DRAFT
    etapa_atual_id: Optional[str] = None
    progresso_percentagem: float = 0.0

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    tipo_ordem_id: Optional[str] = None
    marca_id: Optional[str] = None
    cliente_id: Optional[str] = None
    modelo: Optional[str] = None
    quantidade: Optional[int] = None
    proto_id: Optional[str] = None
    comercial_responsavel_id: Optional[str] = None
    parceiro_confeccao_id: Optional[str] = None
    data_encomenda: Optional[datetime] = None
    data_prevista_entrega: Optional[datetime] = None
    data_real_entrega: Optional[datetime] = None
    data_entrada_confecao: Optional[datetime] = None  # New: Garment factory entry date
    producao_confirmada: Optional[bool] = None
    producao_loteada: Optional[bool] = None
    obriga_prototipo: Optional[bool] = None
    fornecedor_tecido_id: Optional[str] = None
    referencia_tecido: Optional[str] = None
    descricao: Optional[str] = None
    observacoes: Optional[str] = None
    status_projeto: Optional[ProjectStatus] = None
    etapa_atual_id: Optional[str] = None
    progresso_percentagem: Optional[float] = None

class Project(ProjectBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime
    criado_por: str

# Stage Planning
class StagePlanningBase(BaseModel):
    projeto_id: str
    etapa_id: str
    dias_previstos: Optional[int] = None
    data_inicio_prevista: Optional[datetime] = None
    data_fim_prevista: Optional[datetime] = None
    parceiro_previsto_id: Optional[str] = None
    data_inicio_real: Optional[datetime] = None
    data_fim_real: Optional[datetime] = None
    parceiro_real_id: Optional[str] = None
    status_etapa: StageStatus = StageStatus.NOT_STARTED
    atraso_dias: int = 0
    observacoes: Optional[str] = None
    depende_de_etapa_id: Optional[str] = None
    bloqueada: bool = False

class StagePlanningCreate(StagePlanningBase):
    pass

class StagePlanningUpdate(BaseModel):
    dias_previstos: Optional[int] = None
    data_inicio_prevista: Optional[datetime] = None
    data_fim_prevista: Optional[datetime] = None
    parceiro_previsto_id: Optional[str] = None
    data_inicio_real: Optional[datetime] = None
    data_fim_real: Optional[datetime] = None
    parceiro_real_id: Optional[str] = None
    status_etapa: Optional[StageStatus] = None
    atraso_dias: Optional[int] = None
    observacoes: Optional[str] = None
    bloqueada: Optional[bool] = None

class StagePlanning(StagePlanningBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

# Checkpoints
class CheckpointBase(BaseModel):
    etapa_id: str
    nome: str
    tipo_resposta: CheckpointType
    obrigatorio: bool = False
    categoria: CheckpointCategory = CheckpointCategory.INFORMATIVE
    ordem: int = 0
    cor_identificacao: Optional[str] = None
    valor_default: Optional[str] = None
    opcoes: Optional[List[str]] = None  # For multiple/single choice

class CheckpointCreate(CheckpointBase):
    pass

class CheckpointUpdate(BaseModel):
    nome: Optional[str] = None
    tipo_resposta: Optional[CheckpointType] = None
    obrigatorio: Optional[bool] = None
    categoria: Optional[CheckpointCategory] = None
    ordem: Optional[int] = None
    cor_identificacao: Optional[str] = None
    valor_default: Optional[str] = None
    opcoes: Optional[List[str]] = None

class Checkpoint(CheckpointBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

# Checkpoint Responses
class CheckpointResponseBase(BaseModel):
    checkpoint_id: str
    projeto_id: str
    valor: Optional[str] = None
    observacao: Optional[str] = None

class CheckpointResponseCreate(CheckpointResponseBase):
    pass

class CheckpointResponseUpdate(BaseModel):
    valor: Optional[str] = None
    observacao: Optional[str] = None

class CheckpointResponse(CheckpointResponseBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    respondido_por: str
    data_resposta: datetime

# Rules
class RuleCondition(BaseModel):
    campo: str
    operador: RuleOperator
    valor: Optional[str] = None

class RuleActionConfig(BaseModel):
    acao: RuleAction
    parametros: Optional[Dict[str, Any]] = None

class RuleBase(BaseModel):
    nome: str
    etapa_id: Optional[str] = None
    checkpoint_id: Optional[str] = None
    ativo: bool = True
    condicoes: List[RuleCondition] = []
    acoes: List[RuleActionConfig] = []

class RuleCreate(RuleBase):
    pass

class RuleUpdate(BaseModel):
    nome: Optional[str] = None
    etapa_id: Optional[str] = None
    checkpoint_id: Optional[str] = None
    ativo: Optional[bool] = None
    condicoes: Optional[List[RuleCondition]] = None
    acoes: Optional[List[RuleActionConfig]] = None

class Rule(RuleBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime
    atualizado_em: datetime

# Alerts
class AlertBase(BaseModel):
    projeto_id: str
    tipo: str
    mensagem: str
    prioridade: str = "media"  # baixa, media, alta
    visto: bool = False
    resolvido: bool = False

class AlertCreate(AlertBase):
    pass

class Alert(AlertBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_em: datetime

# History
class HistoryEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    entidade: str
    entidade_id: str
    campo: str
    valor_anterior: Optional[str] = None
    valor_novo: Optional[str] = None
    alterado_por: str
    data: datetime


# Custom Views (Listagens Personalizadas)
class CustomViewColumn(BaseModel):
    field: str  # Field path, e.g., "of_numero", "etapa_atual.nome"
    label: str
    editable: bool = False
    width: Optional[int] = None  # Column width in pixels
    type: str = "text"  # text, date, number, status, stage


class CustomViewBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    entidade: str = "project"  # Which entity this view applies to
    columns: List[CustomViewColumn] = []
    filters: Optional[Dict[str, Any]] = None  # Pre-defined filters
    sort_by: Optional[str] = None
    sort_order: str = "asc"
    is_public: bool = False  # If true, all users can see this view
    allowed_roles: Optional[List[str]] = None  # Roles that can view this listing
    edit_roles: Optional[List[str]] = None  # Roles that can edit data in this listing
    ordem: int = 0  # Ordem de apresentação no menu (menor = primeiro)
    status_filter: Optional[List[str]] = None  # Estados permitidos: ["ativo", "atrasado", etc.]


class CustomViewCreate(CustomViewBase):
    pass


class CustomViewUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    columns: Optional[List[CustomViewColumn]] = None
    filters: Optional[Dict[str, Any]] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = None
    is_public: Optional[bool] = None
    allowed_roles: Optional[List[str]] = None
    edit_roles: Optional[List[str]] = None
    ordem: Optional[int] = None
    status_filter: Optional[List[str]] = None


class CustomView(CustomViewBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_por: str
    criado_em: datetime
    atualizado_em: datetime



# Timeline Events
class TimelineEventType(str, Enum):
    INICIO = "inicio"
    PAUSA = "pausa"
    RETOMA = "retoma"
    PROBLEMA = "problema"
    PROBLEMA_RESOLVIDO = "problema_resolvido"
    MUDANCA_ETAPA = "mudanca_etapa"
    CONCLUSAO = "conclusao"
    NOTA = "nota"


class ProblemType(str, Enum):
    FALTA_MATERIAL = "falta_material"
    DEFEITO_QUALIDADE = "defeito_qualidade"
    ATRASO_FORNECEDOR = "atraso_fornecedor"
    MAQUINA_AVARIADA = "maquina_avariada"
    FALTA_CAPACIDADE = "falta_capacidade"
    ERRO_CORTE = "erro_corte"
    PROBLEMA_TECIDO = "problema_tecido"
    OUTRO = "outro"


class TimelineEventBase(BaseModel):
    projeto_id: str
    etapa_key: Optional[str] = None
    tipo_evento: TimelineEventType
    tipo_problema: Optional[ProblemType] = None
    descricao: Optional[str] = None
    impacto_dias: Optional[int] = None  # Estimated impact in days
    resolvido: bool = False


class TimelineEventCreate(TimelineEventBase):
    pass


class TimelineEvent(TimelineEventBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    criado_por: str
    criado_por_nome: Optional[str] = None
    data_evento: datetime
