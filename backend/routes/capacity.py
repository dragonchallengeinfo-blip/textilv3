from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from utils import db, get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("/dashboard")
async def get_capacity_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """Get capacity dashboard data for all confection partners"""
    # Get all confection partners
    partners = await db.partners.find(
        {"tipo_servico": "confeccao", "ativo": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get current month's active projects per partner
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Count projects and pieces per partner
    partner_workload = []
    
    for partner in partners:
        # Active projects assigned to this partner
        projects = await db.projects.find(
            {
                "parceiro_confeccao_id": partner["id"],
                "status_projeto": {"$in": ["ativo", "atrasado", "bloqueado"]}
            },
            {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, 
             "status_projeto": 1, "data_prevista_entrega": 1}
        ).to_list(500)
        
        total_pieces = sum(p.get("quantidade", 0) for p in projects)
        total_projects = len(projects)
        
        # Calculate capacity utilization
        capacity_pieces = partner.get("capacidade_pecas_mes", 0) or 0
        capacity_projects = partner.get("capacidade_projetos_mes", 0) or 0
        taxa_ocupacao = (partner.get("taxa_ocupacao") or 100) / 100  # Convert to decimal
        
        # Effective capacity (adjusted by ocupation rate)
        effective_capacity_pieces = int(capacity_pieces * taxa_ocupacao) if capacity_pieces else 0
        effective_capacity_projects = int(capacity_projects * taxa_ocupacao) if capacity_projects else 0
        
        # Utilization percentages
        utilization_pieces = (total_pieces / effective_capacity_pieces * 100) if effective_capacity_pieces > 0 else 0
        utilization_projects = (total_projects / effective_capacity_projects * 100) if effective_capacity_projects > 0 else 0
        
        # Available capacity
        available_pieces = max(0, effective_capacity_pieces - total_pieces)
        available_projects = max(0, effective_capacity_projects - total_projects)
        
        # Status based on utilization
        max_utilization = max(utilization_pieces, utilization_projects)
        if max_utilization >= 100:
            status = "sobrecarregado"
            status_color = "#EF4444"  # Red
        elif max_utilization >= 80:
            status = "quase_cheio"
            status_color = "#F59E0B"  # Yellow
        elif max_utilization >= 50:
            status = "moderado"
            status_color = "#3B82F6"  # Blue
        else:
            status = "disponivel"
            status_color = "#22C55E"  # Green
        
        partner_workload.append({
            "partner": {
                "id": partner["id"],
                "nome": partner["nome"],
                "codigo": partner.get("codigo"),
                "num_trabalhadores": partner.get("num_trabalhadores"),
                "eficiencia": partner.get("eficiencia"),
                "taxa_ocupacao": partner.get("taxa_ocupacao")
            },
            "capacity": {
                "pecas_mes": capacity_pieces,
                "projetos_mes": capacity_projects,
                "effective_pecas": effective_capacity_pieces,
                "effective_projetos": effective_capacity_projects
            },
            "workload": {
                "total_pecas": total_pieces,
                "total_projetos": total_projects,
                "projects": projects[:5]  # First 5 projects
            },
            "utilization": {
                "pecas_percent": round(utilization_pieces, 1),
                "projetos_percent": round(utilization_projects, 1),
                "max_percent": round(max_utilization, 1)
            },
            "available": {
                "pecas": available_pieces,
                "projetos": available_projects
            },
            "status": status,
            "status_color": status_color
        })
    
    # Sort by utilization (most loaded first)
    partner_workload.sort(key=lambda x: x["utilization"]["max_percent"], reverse=True)
    
    # Generate alerts
    alerts = []
    for pw in partner_workload:
        if pw["status"] == "sobrecarregado":
            alerts.append({
                "tipo": "sobrecarregado",
                "prioridade": "alta",
                "parceiro": pw["partner"]["nome"],
                "mensagem": f"{pw['partner']['nome']} está sobrecarregado ({pw['utilization']['max_percent']:.0f}% de capacidade)"
            })
        elif pw["status"] == "quase_cheio":
            alerts.append({
                "tipo": "quase_cheio",
                "prioridade": "media",
                "parceiro": pw["partner"]["nome"],
                "mensagem": f"{pw['partner']['nome']} está quase cheio ({pw['utilization']['max_percent']:.0f}% de capacidade)"
            })
    
    # Summary stats
    total_capacity_pieces = sum(pw["capacity"]["effective_pecas"] for pw in partner_workload)
    total_workload_pieces = sum(pw["workload"]["total_pecas"] for pw in partner_workload)
    total_capacity_projects = sum(pw["capacity"]["effective_projetos"] for pw in partner_workload)
    total_workload_projects = sum(pw["workload"]["total_projetos"] for pw in partner_workload)
    
    return {
        "partners": partner_workload,
        "alerts": alerts,
        "summary": {
            "total_partners": len(partner_workload),
            "total_capacity_pieces": total_capacity_pieces,
            "total_workload_pieces": total_workload_pieces,
            "total_available_pieces": max(0, total_capacity_pieces - total_workload_pieces),
            "total_capacity_projects": total_capacity_projects,
            "total_workload_projects": total_workload_projects,
            "total_available_projects": max(0, total_capacity_projects - total_workload_projects),
            "overall_utilization": round((total_workload_pieces / total_capacity_pieces * 100) if total_capacity_pieces > 0 else 0, 1)
        }
    }


@router.get("/recommend")
async def recommend_partner(
    quantidade: int = Query(..., description="Number of pieces"),
    data_entrega: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Recommend the best partner for a new project based on capacity"""
    dashboard = await get_capacity_dashboard(current_user)
    
    recommendations = []
    for pw in dashboard["partners"]:
        available_pieces = pw["available"]["pecas"]
        available_projects = pw["available"]["projetos"]
        
        if available_pieces >= quantidade and available_projects > 0:
            # Calculate a score based on availability and efficiency
            efficiency = pw["partner"].get("eficiencia", 80) or 80
            availability_score = (1 - pw["utilization"]["max_percent"] / 100) * 100
            
            # Combined score (efficiency + availability)
            score = (efficiency * 0.4) + (availability_score * 0.6)
            
            recommendations.append({
                "partner": pw["partner"],
                "available_pieces": available_pieces,
                "available_projects": available_projects,
                "current_utilization": pw["utilization"]["max_percent"],
                "efficiency": efficiency,
                "score": round(score, 1),
                "status": pw["status"]
            })
    
    # Sort by score (best first)
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "quantidade_solicitada": quantidade,
        "recommendations": recommendations,
        "best_match": recommendations[0] if recommendations else None
    }


@router.get("/projects-forecast")
async def get_projects_forecast(
    current_user: dict = Depends(get_current_user)
):
    """Get a forecast/radiograph of all active projects"""
    # Get all active projects with planning data
    projects = await db.projects.find(
        {"status_projeto": {"$in": ["ativo", "atrasado", "bloqueado", "rascunho"]}},
        {"_id": 0}
    ).to_list(500)
    
    # Get partners map
    partners = await db.partners.find({}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    partners_map = {p["id"]: p["nome"] for p in partners}
    
    # Get planning data for each project
    project_forecasts = []
    
    for project in projects:
        # Get planning stages
        planning = await db.stage_planning.find(
            {"projeto_id": project["id"]},
            {"_id": 0}
        ).sort("ordem", 1).to_list(10)
        
        # Get active problems
        problems = await db.timeline_events.find(
            {"projeto_id": project["id"], "tipo_evento": "problema", "resolvido": False},
            {"_id": 0}
        ).to_list(10)
        
        # Check if paused
        last_event = await db.timeline_events.find_one(
            {"projeto_id": project["id"], "tipo_evento": {"$in": ["pausa", "retoma", "inicio"]}},
            {"_id": 0},
            sort=[("data_evento", -1)]
        )
        is_paused = last_event and last_event.get("tipo_evento") == "pausa"
        
        # Calculate progress
        completed_stages = len([p for p in planning if p.get("data_fim_real")])
        total_stages = len(planning) if planning else 6
        progress = (completed_stages / total_stages * 100) if total_stages > 0 else 0
        
        # Calculate delay
        delay_days = 0
        now = datetime.now(timezone.utc)
        if project.get("data_prevista_entrega"):
            delivery_date = datetime.fromisoformat(project["data_prevista_entrega"].replace("Z", "+00:00"))
            if now > delivery_date and project["status_projeto"] != "concluido":
                delay_days = (now - delivery_date).days
        
        # Current stage
        current_stage = None
        for p in planning:
            if p.get("data_inicio_real") and not p.get("data_fim_real"):
                current_stage = p.get("nome")
                break
        
        project_forecasts.append({
            "project": {
                "id": project["id"],
                "of_numero": project.get("of_numero"),
                "modelo": project.get("modelo"),
                "quantidade": project.get("quantidade"),
                "status": project.get("status_projeto"),
                "parceiro": partners_map.get(project.get("parceiro_confeccao_id")),
                "data_prevista_entrega": project.get("data_prevista_entrega")
            },
            "progress": {
                "percent": round(progress, 1),
                "completed_stages": completed_stages,
                "total_stages": total_stages,
                "current_stage": current_stage
            },
            "issues": {
                "is_paused": is_paused,
                "active_problems": len(problems),
                "delay_days": delay_days,
                "problems": problems[:3]
            },
            "health": "critical" if delay_days > 7 or len(problems) > 2 else
                     "warning" if delay_days > 0 or len(problems) > 0 or is_paused else
                     "good"
        })
    
    # Sort by health (critical first) then by delivery date
    health_order = {"critical": 0, "warning": 1, "good": 2}
    project_forecasts.sort(key=lambda x: (health_order[x["health"]], x["project"].get("data_prevista_entrega", "")))
    
    # Summary
    critical_count = len([p for p in project_forecasts if p["health"] == "critical"])
    warning_count = len([p for p in project_forecasts if p["health"] == "warning"])
    good_count = len([p for p in project_forecasts if p["health"] == "good"])
    
    return {
        "projects": project_forecasts,
        "summary": {
            "total": len(project_forecasts),
            "critical": critical_count,
            "warning": warning_count,
            "good": good_count,
            "paused": len([p for p in project_forecasts if p["issues"]["is_paused"]]),
            "with_problems": len([p for p in project_forecasts if p["issues"]["active_problems"] > 0])
        }
    }


# ==================== PLANEAMENTO DE CONFECÇÕES ====================

@router.get("/confeccao-planning/dashboard")
async def get_confeccao_planning_dashboard(
    periodo: str = Query("30d", description="Período: 7d, 30d, 90d"),
    current_user: dict = Depends(get_current_user)
):
    """Dashboard de planeamento de confecções com KPIs e capacidade produtiva"""
    
    # Calcular período
    now = datetime.now(timezone.utc)
    if periodo == "7d":
        start_date = now - timedelta(days=7)
        end_date = now + timedelta(days=7)
    elif periodo == "90d":
        start_date = now - timedelta(days=30)
        end_date = now + timedelta(days=90)
    else:  # 30d
        start_date = now - timedelta(days=7)
        end_date = now + timedelta(days=30)
    
    # Obter confecções ativas
    confeccoes = await db.partners.find(
        {"tipo_servico": "confeccao", "ativo": True},
        {"_id": 0}
    ).to_list(100)
    
    total_trabalhadores = sum(c.get("num_trabalhadores", 0) for c in confeccoes)
    
    # Obter todos os trabalhos ativos
    trabalhos_ativos = await db.projects.find(
        {"status_projeto": {"$in": ["ativo", "atrasado"]}, "parceiro_confeccao_id": {"$exists": True, "$ne": None}},
        {"_id": 0}
    ).to_list(500)
    
    # Calcular capacidade por confecção
    confeccao_data = []
    
    for conf in confeccoes:
        # Trabalhos desta confecção
        trabalhos = [t for t in trabalhos_ativos if t.get("parceiro_confeccao_id") == conf["id"]]
        
        # Capacidade em horas (8h/dia * dias_uteis * trabalhadores * eficiência)
        num_trabalhadores = conf.get("num_trabalhadores") or 10
        eficiencia = (conf.get("eficiencia") or 80) / 100
        capacidade_hora_mes = num_trabalhadores * 8 * 22 * eficiencia  # 22 dias úteis
        
        # Horas em curso (assumindo tempo médio por peça)
        tempo_peca_h = conf.get("tempo_medio_peca") or 1.2  # horas por peça
        horas_em_curso = sum(t.get("quantidade", 0) * tempo_peca_h for t in trabalhos if t.get("status_projeto") == "ativo")
        
        # Horas aprovadas (projetos não iniciados)
        horas_aprovadas = sum(t.get("quantidade", 0) * tempo_peca_h for t in trabalhos if t.get("status_projeto") in ["rascunho", "bloqueado"])
        
        # Disponibilidade
        total_ocupado = horas_em_curso + horas_aprovadas
        disponibilidade_atual = max(0, ((capacidade_hora_mes - horas_em_curso) / capacidade_hora_mes * 100)) if capacidade_hora_mes > 0 else 0
        disponibilidade_depois = max(-100, ((capacidade_hora_mes - total_ocupado) / capacidade_hora_mes * 100)) if capacidade_hora_mes > 0 else 0
        
        # Calcular tempo estimado para trabalhos
        tempo_dias = (horas_em_curso / (num_trabalhadores * 8)) if num_trabalhadores > 0 else 0
        
        confeccao_data.append({
            "id": conf["id"],
            "nome": conf["nome"],
            "codigo": conf.get("codigo"),
            "num_trabalhadores": num_trabalhadores,
            "eficiencia": conf.get("eficiencia", 80),
            "capacidade_hora_mes": round(capacidade_hora_mes, 0),
            "horas_em_curso": round(horas_em_curso, 0),
            "horas_aprovadas": round(horas_aprovadas, 0),
            "disponibilidade_atual": round(disponibilidade_atual, 1),
            "disponibilidade_depois": round(disponibilidade_depois, 1),
            "tempo_dias": round(tempo_dias, 1),
            "trabalhos_ativos": len([t for t in trabalhos if t.get("status_projeto") == "ativo"]),
            "trabalhos": [
                {
                    "id": t["id"],
                    "of_numero": t["of_numero"],
                    "modelo": t.get("modelo"),
                    "quantidade": t.get("quantidade"),
                    "status": t.get("status_projeto"),
                    "data_entrega": t.get("data_prevista_entrega"),
                    "tempo_total_h": round(t.get("quantidade", 0) * tempo_peca_h, 0),
                    "progresso": t.get("progresso_percentagem", 0)
                }
                for t in trabalhos[:10]
            ]
        })
    
    # Ordenar por disponibilidade (menos disponível primeiro)
    confeccao_data.sort(key=lambda x: x["disponibilidade_atual"])
    
    # Obter projetos sem confecção atribuída, ordenados por prazo de entrega
    projects_sem_confeccao = await db.projects.find(
        {
            "parceiro_confeccao_id": {"$in": [None, ""]},
            "status_projeto": {"$nin": ["concluido", "cancelado"]}
        },
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, 
         "data_prevista_entrega": 1, "progresso_percentagem": 1, "etapa_atual_id": 1}
    ).sort("data_prevista_entrega", 1).limit(20).to_list(20)
    
    # Enriquecer com progresso da etapa
    stages_map = {}
    stages = await db.stages.find({}, {"_id": 0, "id": 1, "nome": 1, "ordem": 1}).to_list(100)
    for s in stages:
        stages_map[s["id"]] = {"nome": s["nome"], "ordem": s.get("ordem", 0)}
    
    for p in projects_sem_confeccao:
        stage_info = stages_map.get(p.get("etapa_atual_id"))
        p["etapa_atual"] = stage_info["nome"] if stage_info else "-"
        p["progresso"] = p.get("progresso_percentagem", 0)
    
    return {
        "kpis": {
            "confeccoes_ativas": len(confeccoes),
            "trabalhos_em_curso": len([t for t in trabalhos_ativos if t.get("status_projeto") == "ativo"]),
            "total_trabalhadores": total_trabalhadores,
            "sem_confeccao": len(projects_sem_confeccao)
        },
        "confeccoes": confeccao_data,
        "projects_sem_confeccao": projects_sem_confeccao,
        "periodo": {
            "codigo": periodo,
            "inicio": start_date.isoformat(),
            "fim": end_date.isoformat()
        }
    }


@router.post("/confeccao-planning/simulate")
async def simulate_trabalho_allocation(
    projeto_id: str = Query(None, description="ID do projeto existente"),
    quantidade: int = Query(..., description="Quantidade de peças"),
    tempo_peca: float = Query(1.2, description="Tempo por peça em horas"),
    eficiencia: float = Query(0.9, description="Factor de eficiência 0-1"),
    data_inicio: str = Query(None, description="Data de início pretendida"),
    current_user: dict = Depends(get_current_user)
):
    """Simula alocação de um novo trabalho e mostra impacto em cada confecção"""
    
    # Calcular horas totais necessárias
    horas_totais = quantidade * tempo_peca / eficiencia
    
    # Obter confecções
    confeccoes = await db.partners.find(
        {"tipo_servico": "confeccao", "ativo": True},
        {"_id": 0}
    ).to_list(100)
    
    # Obter trabalhos ativos por confecção
    trabalhos_ativos = await db.projects.find(
        {"status_projeto": {"$in": ["ativo", "atrasado"]}, "parceiro_confeccao_id": {"$exists": True, "$ne": None}},
        {"_id": 0}
    ).to_list(500)
    
    simulacoes = []
    
    for conf in confeccoes:
        # Trabalhos atuais desta confecção
        trabalhos = [t for t in trabalhos_ativos if t.get("parceiro_confeccao_id") == conf["id"]]
        
        num_trabalhadores = conf.get("num_trabalhadores") or 10
        efic_conf = (conf.get("eficiencia") or 80) / 100
        tempo_peca_conf = conf.get("tempo_medio_peca") or 1.2
        
        # Capacidade mensal em horas
        capacidade_hora_mes = num_trabalhadores * 8 * 22 * efic_conf
        
        # Horas atualmente em uso
        horas_em_curso = sum(t.get("quantidade", 0) * tempo_peca_conf for t in trabalhos if t.get("status_projeto") == "ativo")
        horas_aprovadas = sum(t.get("quantidade", 0) * tempo_peca_conf for t in trabalhos if t.get("status_projeto") in ["rascunho", "bloqueado"])
        
        # Disponibilidade atual
        disponibilidade_atual = ((capacidade_hora_mes - horas_em_curso) / capacidade_hora_mes * 100) if capacidade_hora_mes > 0 else 0
        
        # Disponibilidade DEPOIS de adicionar o novo trabalho
        nova_carga = horas_em_curso + horas_totais
        disponibilidade_depois = ((capacidade_hora_mes - nova_carga) / capacidade_hora_mes * 100) if capacidade_hora_mes > 0 else 0
        
        # Tempo estimado para completar o novo trabalho
        horas_diarias = num_trabalhadores * 8 * efic_conf
        tempo_dias = (horas_totais / horas_diarias) if horas_diarias > 0 else 0
        
        # Pode aceitar o trabalho?
        pode_aceitar = disponibilidade_depois > -20  # Aceita até 20% sobrecarga
        
        simulacoes.append({
            "confeccao": {
                "id": conf["id"],
                "nome": conf["nome"],
                "codigo": conf.get("codigo")
            },
            "capacidade": {
                "num_trabalhadores": num_trabalhadores,
                "eficiencia": conf.get("eficiencia", 80),
                "capacidade_hora_mes": round(capacidade_hora_mes, 0),
                "horas_em_curso": round(horas_em_curso, 0),
                "horas_aprovadas": round(horas_aprovadas, 0)
            },
            "simulacao": {
                "horas_novo_trabalho": round(horas_totais, 0),
                "tempo_dias": round(tempo_dias, 1),
                "disponibilidade_atual": round(disponibilidade_atual, 1),
                "disponibilidade_depois": round(disponibilidade_depois, 1),
                "pode_aceitar": pode_aceitar
            },
            "trabalhos_atuais": [
                {"of_numero": t["of_numero"], "quantidade": t.get("quantidade"), "status": t.get("status_projeto")}
                for t in trabalhos[:5]
            ]
        })
    
    # Ordenar por disponibilidade depois (mais disponível primeiro)
    simulacoes.sort(key=lambda x: x["simulacao"]["disponibilidade_depois"], reverse=True)
    
    # Melhor recomendação
    recomendado = None
    for s in simulacoes:
        if s["simulacao"]["pode_aceitar"]:
            recomendado = s
            break
    
    return {
        "trabalho": {
            "projeto_id": projeto_id,
            "quantidade": quantidade,
            "tempo_peca": tempo_peca,
            "eficiencia": eficiencia,
            "horas_totais": round(horas_totais, 0),
            "data_inicio": data_inicio
        },
        "simulacoes": simulacoes,
        "recomendado": recomendado,
        "ordenacao": [
            {"value": "mais_disponivel", "label": "Mais disponível"},
            {"value": "menos_ocupado", "label": "Menos ocupado"},
            {"value": "maior_capacidade", "label": "Maior capacidade"},
            {"value": "menor_tempo", "label": "Menor tempo"}
        ]
    }


@router.get("/confeccao-planning/calendar")
async def get_confeccao_calendar(
    data_inicio: str = Query(None, description="Data início do período"),
    data_fim: str = Query(None, description="Data fim do período"),
    confeccao_id: str = Query(None, description="Filtrar por confecção"),
    current_user: dict = Depends(get_current_user)
):
    """Calendário/Gantt de trabalhos por confecção"""
    
    # Definir período
    now = datetime.now(timezone.utc)
    if data_inicio:
        start = datetime.fromisoformat(data_inicio.replace("Z", "+00:00"))
    else:
        start = now - timedelta(days=7)
    
    if data_fim:
        end = datetime.fromisoformat(data_fim.replace("Z", "+00:00"))
    else:
        end = now + timedelta(days=60)
    
    # Obter confecções
    conf_query = {"tipo_servico": "confeccao", "ativo": True}
    if confeccao_id:
        conf_query["id"] = confeccao_id
    
    confeccoes = await db.partners.find(conf_query, {"_id": 0}).to_list(100)
    
    # Obter trabalhos ativos
    trabalhos = await db.projects.find(
        {
            "status_projeto": {"$in": ["ativo", "atrasado", "bloqueado", "rascunho"]},
            "parceiro_confeccao_id": {"$in": [c["id"] for c in confeccoes]}
        },
        {"_id": 0}
    ).to_list(500)
    
    # Obter marcas para os nomes
    marcas = await db.brands.find({}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    marcas_map = {m["id"]: m["nome"] for m in marcas}
    
    # Organizar por confecção
    calendar_data = []
    
    for conf in confeccoes:
        conf_trabalhos = [t for t in trabalhos if t.get("parceiro_confeccao_id") == conf["id"]]
        tempo_peca = conf.get("tempo_medio_peca") or 1.2
        num_trabalhadores = conf.get("num_trabalhadores") or 10
        eficiencia = (conf.get("eficiencia") or 80) / 100
        
        eventos = []
        for trabalho in conf_trabalhos:
            # Calcular duração estimada
            quantidade = trabalho.get("quantidade", 0)
            horas = quantidade * tempo_peca
            dias = horas / (num_trabalhadores * 8 * eficiencia) if num_trabalhadores > 0 else 0
            
            # Data início (usar data_encomenda ou hoje)
            inicio_str = trabalho.get("data_encomenda")
            if inicio_str:
                inicio = datetime.fromisoformat(inicio_str.replace("Z", "+00:00"))
            else:
                inicio = now
            
            # Data fim estimada
            fim = inicio + timedelta(days=max(1, dias))
            
            # Cor baseada no status
            status = trabalho.get("status_projeto", "ativo")
            cores = {
                "ativo": "#3B82F6",      # Azul
                "atrasado": "#EF4444",   # Vermelho
                "bloqueado": "#F59E0B",  # Amarelo
                "rascunho": "#94A3B8",   # Cinza
                "concluido": "#22C55E"   # Verde
            }
            
            eventos.append({
                "id": trabalho["id"],
                "of_numero": trabalho["of_numero"],
                "modelo": trabalho.get("modelo"),
                "marca": marcas_map.get(trabalho.get("marca_id")),
                "quantidade": quantidade,
                "status": status,
                "cor": cores.get(status, "#3B82F6"),
                "data_inicio": inicio.isoformat(),
                "data_fim": fim.isoformat(),
                "data_entrega": trabalho.get("data_prevista_entrega"),
                "dias_estimados": round(dias, 1),
                "progresso": trabalho.get("progresso_percentagem", 0)
            })
        
        # Ordenar eventos por data de início
        eventos.sort(key=lambda x: x["data_inicio"])
        
        calendar_data.append({
            "confeccao": {
                "id": conf["id"],
                "nome": conf["nome"],
                "codigo": conf.get("codigo"),
                "capacidade_pecas_mes": conf.get("capacidade_pecas_mes", 2000)
            },
            "eventos": eventos,
            "total_trabalhos": len(eventos)
        })
    
    return {
        "periodo": {
            "inicio": start.isoformat(),
            "fim": end.isoformat()
        },
        "confeccoes": calendar_data,
        "total_confeccoes": len(calendar_data),
        "total_trabalhos": sum(len(c["eventos"]) for c in calendar_data)
    }
