import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from datetime import datetime, timezone, timedelta
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

def generate_id():
    return str(uuid.uuid4())

async def seed_data():
    print("Iniciando seed de dados...")
    
    # Clear existing data
    await db.users.delete_many({})
    await db.order_types.delete_many({})
    await db.stages.delete_many({})
    await db.partners.delete_many({})
    await db.suppliers.delete_many({})
    await db.projects.delete_many({})
    await db.stage_planning.delete_many({})
    await db.checkpoints.delete_many({})
    await db.rules.delete_many({})
    await db.alerts.delete_many({})
    await db.history.delete_many({})
    await db.brands.delete_many({})
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create Users
    users = [
        {
            "id": generate_id(),
            "email": "admin@textil.pt",
            "nome": "Administrador",
            "hashed_password": pwd_context.hash("admin123"),
            "role": "administrador",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "email": "producao@textil.pt",
            "nome": "João Silva",
            "hashed_password": pwd_context.hash("producao123"),
            "role": "producao",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "email": "comercial@textil.pt",
            "nome": "Maria Santos",
            "hashed_password": pwd_context.hash("comercial123"),
            "role": "comercial",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        }
    ]
    await db.users.insert_many(users)
    print(f"✓ Criados {len(users)} utilizadores")
    
    # Create Stages
    stages = [
        {"id": generate_id(), "nome": "Planear Materiais", "ordem": 1, "cor_identificacao": "#3B82F6", "ativa": True, "permite_parceiro": False, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Validação do Processo", "ordem": 2, "cor_identificacao": "#8B5CF6", "ativa": True, "permite_parceiro": False, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Corte", "ordem": 3, "cor_identificacao": "#EC4899", "ativa": True, "permite_parceiro": True, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Estampado / Bordado", "ordem": 4, "cor_identificacao": "#F59E0B", "ativa": True, "permite_parceiro": True, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Confeção", "ordem": 5, "cor_identificacao": "#10B981", "ativa": True, "permite_parceiro": True, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Lavandaria", "ordem": 6, "cor_identificacao": "#06B6D4", "ativa": True, "permite_parceiro": True, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Acabamentos", "ordem": 7, "cor_identificacao": "#6366F1", "ativa": True, "permite_parceiro": True, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Controlo Final", "ordem": 8, "cor_identificacao": "#14B8A6", "ativa": True, "permite_parceiro": False, "criado_em": now, "atualizado_em": now},
        {"id": generate_id(), "nome": "Concluído", "ordem": 9, "cor_identificacao": "#22C55E", "ativa": True, "permite_parceiro": False, "criado_em": now, "atualizado_em": now}
    ]
    await db.stages.insert_many(stages)
    print(f"✓ Criadas {len(stages)} etapas")
    
    # Create Order Types
    order_types = [
        {
            "id": generate_id(),
            "nome": "Amostra",
            "descricao": "Ordem de fabrico para amostra",
            "ativo": True,
            "ordem_padrao_etapas": [s["id"] for s in stages[:6]],
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Coleção",
            "descricao": "Ordem de fabrico para coleção",
            "ativo": True,
            "ordem_padrao_etapas": [s["id"] for s in stages],
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Produção",
            "descricao": "Ordem de fabrico de produção",
            "ativo": True,
            "ordem_padrao_etapas": [s["id"] for s in stages],
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Protótipo",
            "descricao": "Ordem de fabrico de protótipo",
            "ativo": True,
            "ordem_padrao_etapas": [s["id"] for s in stages[:5]],
            "criado_em": now,
            "atualizado_em": now
        }
    ]
    await db.order_types.insert_many(order_types)
    print(f"✓ Criados {len(order_types)} tipos de ordem")
    
    # Create Brands
    brands = [
        {
            "id": generate_id(),
            "nome": "Nike",
            "codigo": "NK",
            "logo_url": "",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Adidas",
            "codigo": "AD",
            "logo_url": "",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Zara",
            "codigo": "ZR",
            "logo_url": "",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "H&M",
            "codigo": "HM",
            "logo_url": "",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Mango",
            "codigo": "MG",
            "logo_url": "",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        }
    ]
    await db.brands.insert_many(brands)
    print(f"✓ Criadas {len(brands)} marcas")
    
    # Create Partners
    partners = [
        {
            "id": generate_id(),
            "nome": "Confeções Silva",
            "codigo": "CONF001",
            "tipo_servico": "confeccao",
            "email": "geral@confsilva.pt",
            "telefone": "220123456",
            "morada": "Porto",
            "capacidade_mensal": 5000,
            "capacidade_pecas_mes": 5000,
            "capacidade_projetos_mes": 10,
            "num_trabalhadores": 20,
            "eficiencia": 85,
            "taxa_ocupacao": 100,
            "tempo_medio_peca": 1.2,
            "taxa_qualidade": 95.5,
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Confeções Norte",
            "codigo": "CONF002",
            "tipo_servico": "confeccao",
            "email": "geral@confnorte.pt",
            "telefone": "220111333",
            "morada": "Braga",
            "capacidade_mensal": 3000,
            "capacidade_pecas_mes": 3000,
            "capacidade_projetos_mes": 8,
            "num_trabalhadores": 15,
            "eficiencia": 80,
            "taxa_ocupacao": 100,
            "tempo_medio_peca": 1.1,
            "taxa_qualidade": 92.0,
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Confeções Premium",
            "codigo": "CONF003",
            "tipo_servico": "confeccao",
            "email": "geral@confpremium.pt",
            "telefone": "220222444",
            "morada": "Guimarães",
            "capacidade_mensal": 2000,
            "capacidade_pecas_mes": 2000,
            "capacidade_projetos_mes": 5,
            "num_trabalhadores": 10,
            "eficiencia": 90,
            "taxa_ocupacao": 100,
            "tempo_medio_peca": 1.5,
            "taxa_qualidade": 98.0,
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Lavandaria Norte",
            "codigo": "LAV001",
            "tipo_servico": "lavandaria",
            "email": "geral@lavnorte.pt",
            "telefone": "220987654",
            "morada": "Braga",
            "capacidade_mensal": 10000,
            "taxa_qualidade": 98.0,
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Acabamentos Premium",
            "codigo": "ACAB001",
            "tipo_servico": "acabamento",
            "email": "geral@acabpremium.pt",
            "telefone": "220555666",
            "morada": "Guimarães",
            "capacidade_mensal": 3000,
            "taxa_qualidade": 96.8,
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Estamparia Digital",
            "codigo": "EST001",
            "tipo_servico": "estampagem",
            "email": "geral@estdigital.pt",
            "telefone": "220777888",
            "morada": "Lisboa",
            "capacidade_mensal": 2000,
            "taxa_qualidade": 94.2,
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        }
    ]
    await db.partners.insert_many(partners)
    print(f"✓ Criados {len(partners)} parceiros")
    
    # Create Suppliers
    suppliers = [
        {
            "id": generate_id(),
            "nome": "Tecidos Portugal",
            "codigo": "TEC001",
            "email": "vendas@tecportugal.pt",
            "telefone": "220111222",
            "morada": "Porto",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Malhas & Cia",
            "codigo": "MAL001",
            "email": "geral@malhasecia.pt",
            "telefone": "220333444",
            "morada": "Guimarães",
            "ativo": True,
            "criado_em": now,
            "atualizado_em": now
        }
    ]
    await db.suppliers.insert_many(suppliers)
    print(f"✓ Criados {len(suppliers)} fornecedores")
    
    # Create Sample Projects
    projects = []
    for i in range(1, 11):
        delivery_date = datetime.now(timezone.utc) + timedelta(days=30 + i * 5)
        order_date = datetime.now(timezone.utc) - timedelta(days=5)
        
        status_options = ["ativo", "ativo", "ativo", "atrasado", "bloqueado"]
        status = status_options[i % len(status_options)]
        
        # Distribute projects among confection partners (first 3 are confecções)
        confeccao_partners = [p for p in partners if p.get("tipo_servico") == "confeccao"]
        
        project = {
            "id": generate_id(),
            "of_numero": f"OF2024{str(i).zfill(4)}",
            "tipo_ordem_id": order_types[i % len(order_types)]["id"],
            "marca_id": brands[i % len(brands)]["id"],
            "modelo": f"Modelo-{chr(65 + i % 26)}{str(i).zfill(3)}",
            "quantidade": 500 + (i * 100),
            "comercial_responsavel_id": users[2]["id"],
            "parceiro_confeccao_id": confeccao_partners[i % len(confeccao_partners)]["id"],
            "data_encomenda": order_date.isoformat(),
            "data_prevista_entrega": delivery_date.isoformat(),
            "producao_confirmada": i % 2 == 0,
            "producao_loteada": i % 3 == 0,
            "obriga_prototipo": i % 4 == 0,
            "fornecedor_tecido_id": suppliers[i % len(suppliers)]["id"],
            "referencia_tecido": f"TEC-REF-{i}",
            "descricao": f"Descrição do projeto {i}",
            "status_projeto": status,
            "etapa_atual_id": stages[min(i % 5, len(stages) - 1)]["id"],
            "progresso_percentagem": min(i * 10, 80),
            "criado_em": now,
            "atualizado_em": now,
            "criado_por": users[0]["id"]
        }
        projects.append(project)
    
    await db.projects.insert_many(projects)
    print(f"✓ Criados {len(projects)} projetos")
    
    # Create some checkpoints for the first stage
    checkpoints = [
        {
            "id": generate_id(),
            "etapa_id": stages[0]["id"],
            "nome": "Tecido confirmado?",
            "tipo_resposta": "checkbox",
            "obrigatorio": True,
            "categoria": "validacao",
            "ordem": 1,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "etapa_id": stages[0]["id"],
            "nome": "Data prevista de chegada do tecido",
            "tipo_resposta": "data",
            "obrigatorio": True,
            "categoria": "informativo",
            "ordem": 2,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "etapa_id": stages[4]["id"],
            "nome": "Produção aprovada?",
            "tipo_resposta": "checkbox",
            "obrigatorio": True,
            "categoria": "transicao",
            "ordem": 1,
            "criado_em": now,
            "atualizado_em": now
        }
    ]
    await db.checkpoints.insert_many(checkpoints)
    print(f"✓ Criados {len(checkpoints)} checkpoints")
    
    print("\\n✅ Seed de dados concluído com sucesso!")
    print("\\nUtilizadores criados:")
    print("- admin@textil.pt / admin123 (Administrador)")
    print("- producao@textil.pt / producao123 (Produção)")
    print("- comercial@textil.pt / comercial123 (Comercial)")

if __name__ == "__main__":
    asyncio.run(seed_data())
