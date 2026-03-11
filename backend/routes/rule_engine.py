from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any
from pydantic import BaseModel
from utils import db, get_current_user, generate_id, deserialize_datetime
from datetime import datetime, timezone, timedelta

router = APIRouter()

class RuleSimulationInput(BaseModel):
    contexto: Dict[str, Any]  # Dados do projeto/checkpoint para testar
    rule_ids: List[str] = []  # IDs específicos ou vazio para testar todas

class RuleExecutionResult(BaseModel):
    rule_id: str
    rule_name: str
    matched: bool
    conditions_evaluated: List[Dict[str, Any]]
    actions_to_execute: List[Dict[str, Any]]
    execution_time_ms: float

def evaluate_condition(condition: dict, context: dict) -> bool:
    """Avalia uma condição contra o contexto fornecido"""
    campo = condition.get('campo')
    operador = condition.get('operador')
    valor_esperado = condition.get('valor')
    
    valor_atual = context.get(campo)
    
    if operador == 'igual':
        return str(valor_atual).lower() == str(valor_esperado).lower()
    elif operador == 'diferente':
        return str(valor_atual).lower() != str(valor_esperado).lower()
    elif operador == 'maior':
        try:
            return float(valor_atual) > float(valor_esperado)
        except:
            return False
    elif operador == 'menor':
        try:
            return float(valor_atual) < float(valor_esperado)
        except:
            return False
    elif operador == 'preenchido':
        return valor_atual is not None and str(valor_atual).strip() != ''
    elif operador == 'vazio':
        return valor_atual is None or str(valor_atual).strip() == ''
    elif operador == 'data_anterior':
        try:
            from datetime import datetime
            data_atual = datetime.fromisoformat(str(valor_atual))
            data_esperada = datetime.fromisoformat(str(valor_esperado))
            return data_atual < data_esperada
        except:
            return False
    elif operador == 'data_posterior':
        try:
            from datetime import datetime
            data_atual = datetime.fromisoformat(str(valor_atual))
            data_esperada = datetime.fromisoformat(str(valor_esperado))
            return data_atual > data_esperada
        except:
            return False
    
    return False

@router.post("/simulate")
async def simulate_rules(simulation: RuleSimulationInput, current_user: dict = Depends(get_current_user)):
    """Simula a execução de regras sem aplicar as ações"""
    import time
    
    # Buscar regras
    query = {"ativo": True}
    if simulation.rule_ids:
        query["id"] = {"$in": simulation.rule_ids}
    
    rules = await db.rules.find(query, {"_id": 0}).sort("prioridade", -1).to_list(100)
    
    results = []
    
    for rule in rules:
        start_time = time.time()
        
        conditions = rule.get('condicoes', [])
        conditions_results = []
        all_conditions_met = True
        
        # Avaliar cada condição
        for condition in conditions:
            result = evaluate_condition(condition, simulation.contexto)
            conditions_results.append({
                'campo': condition.get('campo'),
                'operador': condition.get('operador'),
                'valor_esperado': condition.get('valor'),
                'valor_atual': simulation.contexto.get(condition.get('campo')),
                'resultado': result
            })
            if not result:
                all_conditions_met = False
        
        execution_time = (time.time() - start_time) * 1000  # em ms
        
        result = {
            'rule_id': rule['id'],
            'rule_name': rule['nome'],
            'priority': rule.get('prioridade', 1),
            'matched': all_conditions_met,
            'conditions_evaluated': conditions_results,
            'actions_to_execute': rule.get('acoes', []) if all_conditions_met else [],
            'execution_time_ms': round(execution_time, 2)
        }
        
        results.append(result)
    
    return {
        'simulation_timestamp': datetime.now(timezone.utc).isoformat(),
        'context': simulation.contexto,
        'total_rules_evaluated': len(results),
        'rules_matched': len([r for r in results if r['matched']]),
        'results': results
    }

@router.post("/execute")
async def execute_rules(projeto_id: str, checkpoint_id: str = None, current_user: dict = Depends(get_current_user)):
    """Executa regras para um projeto específico e aplica as ações"""
    # Buscar projeto
    project = await db.projects.find_one({"id": projeto_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    # Criar contexto
    context = {**project}
    
    # Se checkpoint específico, adicionar dados do checkpoint
    if checkpoint_id:
        checkpoint_response = await db.checkpoint_responses.find_one(
            {"checkpoint_id": checkpoint_id, "projeto_id": projeto_id},
            {"_id": 0}
        )
        if checkpoint_response:
            context[f"checkpoint_{checkpoint_id}"] = checkpoint_response.get('valor')
            context["checkpoint_valor"] = checkpoint_response.get('valor')
    
    # Add all checkpoint responses to context
    all_responses = await db.checkpoint_responses.find({"projeto_id": projeto_id}, {"_id": 0}).to_list(100)
    for response in all_responses:
        context[f"checkpoint_{response['checkpoint_id']}"] = response.get('valor')
    
    # Buscar regras ativas
    query = {"ativo": True}
    if checkpoint_id:
        query["$or"] = [{"checkpoint_id": checkpoint_id}, {"checkpoint_id": None}]
    
    rules = await db.rules.find(query, {"_id": 0}).to_list(100)
    
    executed_rules = []
    actions_applied = []
    
    for rule in rules:
        conditions = rule.get('condicoes', [])
        all_conditions_met = True
        
        for condition in conditions:
            if not evaluate_condition(condition, context):
                all_conditions_met = False
                break
        
        if all_conditions_met:
            # Executar ações REAIS
            for action in rule.get('acoes', []):
                action_type = action.get('acao')
                params = action.get('parametros', {})
                action_result = {"action": action_type, "status": "executed", "details": {}}
                
                try:
                    if action_type == "mudar_etapa":
                        # Change project stage
                        new_stage_id = params.get("etapa_id")
                        if new_stage_id:
                            await db.projects.update_one(
                                {"id": projeto_id},
                                {"$set": {"etapa_atual_id": new_stage_id, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
                            )
                            action_result["details"] = {"new_stage": new_stage_id}
                    
                    elif action_type == "mudar_status":
                        # Change project status
                        new_status = params.get("status")
                        if new_status:
                            await db.projects.update_one(
                                {"id": projeto_id},
                                {"$set": {"status_projeto": new_status, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
                            )
                            action_result["details"] = {"new_status": new_status}
                    
                    elif action_type == "bloquear_etapa":
                        # Block a stage
                        stage_id = params.get("etapa_id")
                        if stage_id:
                            await db.stage_planning.update_one(
                                {"projeto_id": projeto_id, "etapa_id": stage_id},
                                {"$set": {"bloqueada": True}}
                            )
                            action_result["details"] = {"blocked_stage": stage_id}
                    
                    elif action_type == "desbloquear_etapa":
                        # Unblock a stage
                        stage_id = params.get("etapa_id")
                        if stage_id:
                            await db.stage_planning.update_one(
                                {"projeto_id": projeto_id, "etapa_id": stage_id},
                                {"$set": {"bloqueada": False}}
                            )
                            action_result["details"] = {"unblocked_stage": stage_id}
                    
                    elif action_type == "criar_alerta":
                        # Create an alert
                        alert_msg = params.get("mensagem", "Alerta automático")
                        alert_priority = params.get("prioridade", "media")
                        alert_doc = {
                            "id": generate_id(),
                            "projeto_id": projeto_id,
                            "tipo": "regra_automatica",
                            "mensagem": alert_msg,
                            "prioridade": alert_priority,
                            "visto": False,
                            "resolvido": False,
                            "criado_em": datetime.now(timezone.utc).isoformat(),
                            "rule_id": rule["id"]
                        }
                        await db.alerts.insert_one(alert_doc)
                        action_result["details"] = {"alert_id": alert_doc["id"]}
                    
                    elif action_type == "concluir_projeto":
                        # Complete the project
                        await db.projects.update_one(
                            {"id": projeto_id},
                            {"$set": {
                                "status_projeto": "concluido",
                                "progresso_percentagem": 100,
                                "data_real_entrega": datetime.now(timezone.utc).isoformat(),
                                "atualizado_em": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        action_result["details"] = {"completed": True}
                    
                    elif action_type == "preencher_campo":
                        # Fill a field
                        field_name = params.get("campo")
                        field_value = params.get("valor")
                        if field_name and field_value:
                            await db.projects.update_one(
                                {"id": projeto_id},
                                {"$set": {field_name: field_value, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
                            )
                            action_result["details"] = {field_name: field_value}
                    
                    elif action_type == "voltar_etapa":
                        # Go back to a previous stage
                        stage_id = params.get("etapa_id")
                        if stage_id:
                            await db.projects.update_one(
                                {"id": projeto_id},
                                {"$set": {"etapa_atual_id": stage_id, "atualizado_em": datetime.now(timezone.utc).isoformat()}}
                            )
                            action_result["details"] = {"back_to_stage": stage_id}
                    
                    actions_applied.append(action_result)
                    
                except Exception as e:
                    action_result["status"] = "error"
                    action_result["details"] = {"error": str(e)}
                    actions_applied.append(action_result)
            
            # Registrar log de execução
            log_entry = {
                "id": generate_id(),
                "rule_id": rule['id'],
                "rule_name": rule['nome'],
                "projeto_id": projeto_id,
                "checkpoint_id": checkpoint_id,
                "conditions_met": True,
                "actions_executed": actions_applied[-len(rule.get('acoes', [])):] if actions_applied else [],
                "executed_by": current_user['id'],
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "context_snapshot": {k: str(v)[:100] for k, v in context.items() if k != '_id'}  # Limited snapshot
            }
            
            await db.rule_execution_logs.insert_one(log_entry)
            executed_rules.append(rule['nome'])
    
    return {
        'projeto_id': projeto_id,
        'rules_executed': executed_rules,
        'actions_applied': actions_applied,
        'total_actions': len(actions_applied)
    }

@router.get("/logs")
async def get_execution_logs(
    projeto_id: str = None,
    rule_id: str = None,
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user)
):
    """Retorna logs de execução de regras"""
    query = {}
    if projeto_id:
        query["projeto_id"] = projeto_id
    if rule_id:
        query["rule_id"] = rule_id
    
    logs = await db.rule_execution_logs.find(query, {"_id": 0}).sort("executed_at", -1).limit(limit).to_list(limit)
    return deserialize_datetime(logs)

@router.get("/logs/stats")
async def get_execution_stats(current_user: dict = Depends(get_current_user)):
    """Retorna estatísticas de execução de regras"""
    # Total de execuções
    total_executions = await db.rule_execution_logs.count_documents({})
    
    # Regras mais executadas
    pipeline = [
        {"$group": {
            "_id": "$rule_id",
            "rule_name": {"$first": "$rule_name"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    top_rules = []
    async for doc in db.rule_execution_logs.aggregate(pipeline):
        top_rules.append({
            "rule_id": doc["_id"],
            "rule_name": doc["rule_name"],
            "execution_count": doc["count"]
        })
    
    return {
        "total_executions": total_executions,
        "top_rules": top_rules
    }

@router.delete("/logs")
async def clear_logs(older_than_days: int = 30, current_user: dict = Depends(get_current_user)):
    """Limpa logs antigos"""
    if current_user.get("role") != "administrador":
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    result = await db.rule_execution_logs.delete_many({
        "executed_at": {"$lt": cutoff_date.isoformat()}
    })
    
    return {"deleted_count": result.deleted_count}
