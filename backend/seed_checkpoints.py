"""
Script para criar checkpoints exemplares com todas as variações possíveis
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "textile_ops")

def generate_id():
    return str(uuid.uuid4())[:8]

async def create_example_checkpoints():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get stages
    stages = await db.stages.find({}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    stages_map = {s["nome"]: s["id"] for s in stages}
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Lista de checkpoints exemplares por etapa
    checkpoints_examples = []
    
    # ==================== ETAPA: PLANEAR MATERIAIS ====================
    etapa_planear = stages_map.get("Planear Materiais", stages[0]["id"] if stages else None)
    
    checkpoints_examples.extend([
        {
            "id": generate_id(),
            "nome": "Validação da Ficha Técnica",
            "descricao": "Verificar se a ficha técnica está completa e aprovada",
            "etapa_id": etapa_planear,
            "tipo_campo": "checkbox",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 1,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Confirme que todos os campos da ficha técnica estão preenchidos: medidas, materiais, cores, acabamentos.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Lista de Materiais (BOM)",
            "descricao": "Verificar disponibilidade de todos os materiais",
            "etapa_id": etapa_planear,
            "tipo_campo": "select",
            "opcoes": ["Todos disponíveis", "Parcialmente disponível", "Em encomenda", "Indisponível"],
            "obrigatorio": True,
            "ordem": 2,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Selecione o estado de disponibilidade dos materiais.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Prazo de Entrega Materiais",
            "descricao": "Data prevista de chegada dos materiais",
            "etapa_id": etapa_planear,
            "tipo_campo": "date",
            "opcoes": None,
            "obrigatorio": False,
            "ordem": 3,
            "ativo": True,
            "trigger_regras": False,
            "instrucoes": "Indique a data prevista de chegada dos materiais em falta.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Observações de Materiais",
            "descricao": "Notas adicionais sobre os materiais",
            "etapa_id": etapa_planear,
            "tipo_campo": "textarea",
            "opcoes": None,
            "obrigatorio": False,
            "ordem": 4,
            "ativo": True,
            "trigger_regras": False,
            "instrucoes": "Adicione observações relevantes sobre os materiais (ex: fornecedor alternativo, cor substituta).",
            "criado_em": now,
            "atualizado_em": now
        }
    ])
    
    # ==================== ETAPA: CORTE ====================
    etapa_corte = stages_map.get("Corte", stages[1]["id"] if len(stages) > 1 else None)
    
    checkpoints_examples.extend([
        {
            "id": generate_id(),
            "nome": "Quantidade Cortada",
            "descricao": "Número de peças efetivamente cortadas",
            "etapa_id": etapa_corte,
            "tipo_campo": "number",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 1,
            "ativo": True,
            "trigger_regras": True,
            "validacao": {"min": 0, "max": 100000},
            "instrucoes": "Insira o número total de peças cortadas.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Qualidade do Corte",
            "descricao": "Avaliação da qualidade do corte",
            "etapa_id": etapa_corte,
            "tipo_campo": "rating",
            "opcoes": ["1", "2", "3", "4", "5"],
            "obrigatorio": True,
            "ordem": 2,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Avalie a qualidade do corte de 1 (má) a 5 (excelente).",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Desperdício (%)",
            "descricao": "Percentagem de desperdício de tecido",
            "etapa_id": etapa_corte,
            "tipo_campo": "number",
            "opcoes": None,
            "obrigatorio": False,
            "ordem": 3,
            "ativo": True,
            "trigger_regras": True,
            "validacao": {"min": 0, "max": 100, "suffix": "%"},
            "instrucoes": "Indique a percentagem de desperdício de tecido.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Foto do Corte",
            "descricao": "Fotografia das peças cortadas",
            "etapa_id": etapa_corte,
            "tipo_campo": "file",
            "opcoes": ["image/*"],
            "obrigatorio": False,
            "ordem": 4,
            "ativo": True,
            "trigger_regras": False,
            "instrucoes": "Tire uma foto das peças cortadas para registo.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Problemas Identificados",
            "descricao": "Selecione os problemas encontrados",
            "etapa_id": etapa_corte,
            "tipo_campo": "multiselect",
            "opcoes": ["Nenhum", "Defeito no tecido", "Erro de medidas", "Falta de material", "Máquina avariada", "Outro"],
            "obrigatorio": True,
            "ordem": 5,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Selecione todos os problemas identificados durante o corte.",
            "criado_em": now,
            "atualizado_em": now
        }
    ])
    
    # ==================== ETAPA: CONFECÇÃO ====================
    etapa_confeccao = stages_map.get("Confecção", stages_map.get("Confeção", stages[2]["id"] if len(stages) > 2 else None))
    
    checkpoints_examples.extend([
        {
            "id": generate_id(),
            "nome": "Início da Produção",
            "descricao": "Data e hora de início da confecção",
            "etapa_id": etapa_confeccao,
            "tipo_campo": "datetime",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 1,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Registe a data e hora de início da produção.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Operador Responsável",
            "descricao": "Nome do operador principal",
            "etapa_id": etapa_confeccao,
            "tipo_campo": "text",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 2,
            "ativo": True,
            "trigger_regras": False,
            "instrucoes": "Indique o nome do operador responsável.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Peças Produzidas",
            "descricao": "Quantidade de peças produzidas",
            "etapa_id": etapa_confeccao,
            "tipo_campo": "number",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 3,
            "ativo": True,
            "trigger_regras": True,
            "validacao": {"min": 0},
            "instrucoes": "Insira o número de peças produzidas até ao momento.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Peças com Defeito",
            "descricao": "Quantidade de peças rejeitadas",
            "etapa_id": etapa_confeccao,
            "tipo_campo": "number",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 4,
            "ativo": True,
            "trigger_regras": True,
            "validacao": {"min": 0},
            "instrucoes": "Insira o número de peças com defeito.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Tipo de Defeitos",
            "descricao": "Classificação dos defeitos encontrados",
            "etapa_id": etapa_confeccao,
            "tipo_campo": "multiselect",
            "opcoes": ["Costura torta", "Fio partido", "Mancha", "Medidas erradas", "Botão mal colocado", "Defeito de tecido", "Outro"],
            "obrigatorio": False,
            "ordem": 5,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Selecione os tipos de defeitos encontrados.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Atraso Reportado",
            "descricao": "Existe atraso na produção?",
            "etapa_id": etapa_confeccao,
            "tipo_campo": "select",
            "opcoes": ["Sem atraso", "Atraso < 1 dia", "Atraso 1-3 dias", "Atraso > 3 dias"],
            "obrigatorio": True,
            "ordem": 6,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Indique se existe atraso e qual a dimensão.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Motivo do Atraso",
            "descricao": "Justificação para o atraso (se aplicável)",
            "etapa_id": etapa_confeccao,
            "tipo_campo": "textarea",
            "opcoes": None,
            "obrigatorio": False,
            "ordem": 7,
            "ativo": True,
            "trigger_regras": False,
            "condicao_visibilidade": {"campo": "Atraso Reportado", "operador": "!=", "valor": "Sem atraso"},
            "instrucoes": "Descreva o motivo do atraso.",
            "criado_em": now,
            "atualizado_em": now
        }
    ])
    
    # ==================== ETAPA: CONTROLO DE QUALIDADE ====================
    etapa_qualidade = stages_map.get("Controlo Final", stages_map.get("Acabamento", stages[3]["id"] if len(stages) > 3 else None))
    
    checkpoints_examples.extend([
        {
            "id": generate_id(),
            "nome": "Inspeção Visual",
            "descricao": "Verificação visual das peças",
            "etapa_id": etapa_qualidade,
            "tipo_campo": "select",
            "opcoes": ["Aprovado", "Aprovado com observações", "Reprovado - Retrabalho", "Reprovado - Defeituoso"],
            "obrigatorio": True,
            "ordem": 1,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Faça inspeção visual e classifique o lote.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Verificação de Medidas",
            "descricao": "Confirmação das medidas conforme ficha técnica",
            "etapa_id": etapa_qualidade,
            "tipo_campo": "checkbox",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 2,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Confirme que as medidas estão dentro das tolerâncias.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Taxa de Aprovação (%)",
            "descricao": "Percentagem de peças aprovadas",
            "etapa_id": etapa_qualidade,
            "tipo_campo": "number",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 3,
            "ativo": True,
            "trigger_regras": True,
            "validacao": {"min": 0, "max": 100, "suffix": "%"},
            "instrucoes": "Calcule e insira a taxa de aprovação.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Fotos de Controlo",
            "descricao": "Fotografias do controlo de qualidade",
            "etapa_id": etapa_qualidade,
            "tipo_campo": "file",
            "opcoes": ["image/*"],
            "obrigatorio": False,
            "ordem": 4,
            "ativo": True,
            "trigger_regras": False,
            "multi_upload": True,
            "instrucoes": "Carregue fotos das peças inspecionadas.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Relatório de Qualidade",
            "descricao": "Observações detalhadas da inspeção",
            "etapa_id": etapa_qualidade,
            "tipo_campo": "textarea",
            "opcoes": None,
            "obrigatorio": False,
            "ordem": 5,
            "ativo": True,
            "trigger_regras": False,
            "instrucoes": "Descreva detalhadamente os resultados da inspeção.",
            "criado_em": now,
            "atualizado_em": now
        }
    ])
    
    # ==================== ETAPA: EXPEDIÇÃO ====================
    etapa_expedicao = stages_map.get("Expedição", stages[4]["id"] if len(stages) > 4 else None)
    
    checkpoints_examples.extend([
        {
            "id": generate_id(),
            "nome": "Embalagem Concluída",
            "descricao": "Confirmação da embalagem das peças",
            "etapa_id": etapa_expedicao,
            "tipo_campo": "checkbox",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 1,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Confirme que todas as peças estão embaladas corretamente.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Quantidade Final Expedida",
            "descricao": "Número de peças a expedir",
            "etapa_id": etapa_expedicao,
            "tipo_campo": "number",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 2,
            "ativo": True,
            "trigger_regras": True,
            "validacao": {"min": 0},
            "instrucoes": "Insira a quantidade final a expedir.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Transportadora",
            "descricao": "Empresa de transporte",
            "etapa_id": etapa_expedicao,
            "tipo_campo": "select",
            "opcoes": ["CTT", "DHL", "FedEx", "UPS", "Transporte Próprio", "Cliente Recolhe", "Outro"],
            "obrigatorio": True,
            "ordem": 3,
            "ativo": True,
            "trigger_regras": False,
            "instrucoes": "Selecione a transportadora.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Número de Tracking",
            "descricao": "Código de rastreamento do envio",
            "etapa_id": etapa_expedicao,
            "tipo_campo": "text",
            "opcoes": None,
            "obrigatorio": False,
            "ordem": 4,
            "ativo": True,
            "trigger_regras": False,
            "instrucoes": "Insira o número de tracking do envio.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Data/Hora Expedição",
            "descricao": "Momento da expedição",
            "etapa_id": etapa_expedicao,
            "tipo_campo": "datetime",
            "opcoes": None,
            "obrigatorio": True,
            "ordem": 5,
            "ativo": True,
            "trigger_regras": True,
            "instrucoes": "Registe a data e hora da expedição.",
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Documentação",
            "descricao": "Documentos anexados (guia, fatura)",
            "etapa_id": etapa_expedicao,
            "tipo_campo": "file",
            "opcoes": ["application/pdf", "image/*"],
            "obrigatorio": False,
            "ordem": 6,
            "ativo": True,
            "trigger_regras": False,
            "multi_upload": True,
            "instrucoes": "Carregue a documentação de expedição.",
            "criado_em": now,
            "atualizado_em": now
        }
    ])
    
    # Insert checkpoints
    if checkpoints_examples:
        # Remove existing example checkpoints first
        await db.checkpoints.delete_many({"nome": {"$regex": "^(Validação|Lista de|Prazo de|Observações|Quantidade|Qualidade|Desperdício|Foto|Problemas|Início|Operador|Peças|Tipo de|Atraso|Motivo|Inspeção|Verificação|Taxa|Fotos|Relatório|Embalagem|Transportadora|Número|Data/Hora|Documentação)"}})
        
        result = await db.checkpoints.insert_many(checkpoints_examples)
        print(f"✓ Criados {len(result.inserted_ids)} checkpoints exemplares")
    
    # Create example rules based on checkpoints
    rules_examples = [
        {
            "id": generate_id(),
            "nome": "Alerta Material Indisponível",
            "descricao": "Cria alerta quando materiais não estão disponíveis",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Lista de Materiais (BOM)",
                "operador": "igual",
                "valor": "Indisponível"
            },
            "acao": {
                "tipo": "criar_alerta",
                "prioridade": "alta",
                "mensagem": "Materiais indisponíveis - projeto pode atrasar"
            },
            "ordem": 1,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Bloquear se Qualidade Baixa",
            "descricao": "Bloqueia projeto se qualidade do corte for inferior a 3",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Qualidade do Corte",
                "operador": "menor_que",
                "valor": "3"
            },
            "acao": {
                "tipo": "mudar_status",
                "status": "bloqueado",
                "motivo": "Qualidade de corte abaixo do aceitável"
            },
            "ordem": 2,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Notificar Desperdício Alto",
            "descricao": "Notifica quando desperdício excede 15%",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Desperdício (%)",
                "operador": "maior_que",
                "valor": "15"
            },
            "acao": {
                "tipo": "criar_alerta",
                "prioridade": "media",
                "mensagem": "Desperdício de tecido acima do normal"
            },
            "ordem": 3,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Marcar Atrasado se Atraso > 1 dia",
            "descricao": "Muda status para atrasado quando reportado atraso significativo",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Atraso Reportado",
                "operador": "em",
                "valor": ["Atraso 1-3 dias", "Atraso > 3 dias"]
            },
            "acao": {
                "tipo": "mudar_status",
                "status": "atrasado"
            },
            "ordem": 4,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Alerta Taxa Aprovação Baixa",
            "descricao": "Alerta quando taxa de aprovação < 90%",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Taxa de Aprovação (%)",
                "operador": "menor_que",
                "valor": "90"
            },
            "acao": {
                "tipo": "criar_alerta",
                "prioridade": "alta",
                "mensagem": "Taxa de aprovação abaixo de 90% - verificar qualidade"
            },
            "ordem": 5,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Avançar Etapa se Aprovado",
            "descricao": "Avança para próxima etapa quando inspeção aprovada",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Inspeção Visual",
                "operador": "igual",
                "valor": "Aprovado"
            },
            "acao": {
                "tipo": "avancar_etapa"
            },
            "ordem": 6,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Marcar Concluído na Expedição",
            "descricao": "Marca projeto como concluído quando expedido",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Embalagem Concluída",
                "operador": "igual",
                "valor": True
            },
            "acao": {
                "tipo": "mudar_status",
                "status": "concluido"
            },
            "condicao_adicional": {
                "etapa": "Expedição"
            },
            "ordem": 7,
            "criado_em": now,
            "atualizado_em": now
        },
        {
            "id": generate_id(),
            "nome": "Notificar Defeitos Múltiplos",
            "descricao": "Alerta quando há mais de 2 tipos de defeitos",
            "ativo": True,
            "tipo": "checkpoint",
            "condicao": {
                "campo": "Tipo de Defeitos",
                "operador": "contagem_maior",
                "valor": "2"
            },
            "acao": {
                "tipo": "criar_alerta",
                "prioridade": "alta",
                "mensagem": "Múltiplos tipos de defeitos identificados - revisão urgente"
            },
            "ordem": 8,
            "criado_em": now,
            "atualizado_em": now
        }
    ]
    
    # Insert rules
    if rules_examples:
        await db.rules.delete_many({"nome": {"$regex": "^(Alerta Material|Bloquear se|Notificar Desperdício|Marcar Atrasado|Alerta Taxa|Avançar Etapa|Marcar Concluído|Notificar Defeitos)"}})
        result = await db.rules.insert_many(rules_examples)
        print(f"✓ Criadas {len(result.inserted_ids)} regras exemplares")
    
    client.close()
    print("✓ Setup de checkpoints e regras concluído!")

if __name__ == "__main__":
    asyncio.run(create_example_checkpoints())
