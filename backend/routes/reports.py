from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from utils import db, get_current_user, generate_id

router = APIRouter()

# ============== MODELS ==============

class ReportConfig(BaseModel):
    auto_generate: bool = True
    generate_time: str = "08:00"  # HH:MM
    include_delayed: bool = True
    include_deliveries: bool = True
    include_checkpoints: bool = True
    include_alerts: bool = True
    include_capacity: bool = True
    include_sem_confeccao: bool = True
    include_annotations: bool = True
    include_reported_delays: bool = True
    email_enabled: bool = False
    email_recipients: List[str] = []

class ReportAnnotation(BaseModel):
    projeto_id: Optional[str] = None
    texto: str
    tipo: str = "nota"  # nota, atencao, urgente
    data_lembrete: Optional[str] = None


# ============== REPORT GENERATION ==============

async def generate_daily_report_data(user_id: str = None) -> Dict[str, Any]:
    """Generate comprehensive daily report data"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = now + timedelta(days=7)
    
    report_data = {
        "generated_at": now.isoformat(),
        "generated_by": user_id,
        "date": now.strftime("%d/%m/%Y"),
        "sections": {}
    }
    
    # 1. PROJETOS ATRASADOS
    delayed_projects = await db.projects.find(
        {"status_projeto": "atrasado"},
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, 
         "data_prevista_entrega": 1, "parceiro_confeccao_id": 1, "etapa_atual_id": 1}
    ).sort("data_prevista_entrega", 1).to_list(50)
    
    # Enrich with partner and stage names
    partners_map = {}
    partners = await db.partners.find({}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    for p in partners:
        partners_map[p["id"]] = p["nome"]
    
    stages_map = {}
    stages = await db.stages.find({}, {"_id": 0, "id": 1, "nome": 1}).to_list(100)
    for s in stages:
        stages_map[s["id"]] = s["nome"]
    
    for p in delayed_projects:
        p["parceiro_nome"] = partners_map.get(p.get("parceiro_confeccao_id"), "Não atribuído")
        p["etapa_nome"] = stages_map.get(p.get("etapa_atual_id"), "-")
        if p.get("data_prevista_entrega"):
            try:
                delivery = datetime.fromisoformat(p["data_prevista_entrega"].replace("Z", "+00:00"))
                p["dias_atraso"] = (now - delivery).days
            except:
                p["dias_atraso"] = 0
    
    report_data["sections"]["delayed_projects"] = {
        "title": "Projetos Atrasados",
        "count": len(delayed_projects),
        "items": delayed_projects,
        "priority": "high" if len(delayed_projects) > 0 else "normal"
    }
    
    # 2. ENTREGAS PREVISTAS HOJE
    deliveries_today = await db.projects.find(
        {
            "data_prevista_entrega": {
                "$gte": today_start.isoformat(),
                "$lt": today_end.isoformat()
            },
            "status_projeto": {"$ne": "concluido"}
        },
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, 
         "status_projeto": 1, "parceiro_confeccao_id": 1}
    ).to_list(50)
    
    for p in deliveries_today:
        p["parceiro_nome"] = partners_map.get(p.get("parceiro_confeccao_id"), "Não atribuído")
    
    report_data["sections"]["deliveries_today"] = {
        "title": "Entregas Previstas Hoje",
        "count": len(deliveries_today),
        "items": deliveries_today,
        "priority": "high" if len(deliveries_today) > 0 else "normal"
    }
    
    # 3. ENTREGAS ESTA SEMANA
    deliveries_week = await db.projects.find(
        {
            "data_prevista_entrega": {
                "$gte": now.isoformat(),
                "$lte": week_end.isoformat()
            },
            "status_projeto": {"$ne": "concluido"}
        },
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, 
         "data_prevista_entrega": 1, "status_projeto": 1}
    ).sort("data_prevista_entrega", 1).to_list(50)
    
    report_data["sections"]["deliveries_week"] = {
        "title": "Entregas Esta Semana",
        "count": len(deliveries_week),
        "items": deliveries_week,
        "priority": "medium"
    }
    
    # 4. CHECKPOINTS PENDENTES
    # Get all mandatory checkpoints and check which are missing responses
    checkpoints = await db.checkpoints.find(
        {"obrigatorio": True, "ativo": True},
        {"_id": 0}
    ).to_list(100)
    
    active_projects = await db.projects.find(
        {"status_projeto": {"$in": ["ativo", "atrasado"]}},
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "etapa_atual_id": 1}
    ).to_list(500)
    
    pending_checkpoints = []
    for project in active_projects:
        project_checkpoints = [c for c in checkpoints if c.get("etapa_id") == project.get("etapa_atual_id")]
        for cp in project_checkpoints:
            response = await db.checkpoint_responses.find_one({
                "checkpoint_id": cp["id"],
                "projeto_id": project["id"]
            })
            if not response:
                pending_checkpoints.append({
                    "projeto_id": project["id"],
                    "of_numero": project["of_numero"],
                    "modelo": project.get("modelo"),
                    "checkpoint_nome": cp["nome"],
                    "checkpoint_id": cp["id"]
                })
    
    report_data["sections"]["pending_checkpoints"] = {
        "title": "Checkpoints Pendentes",
        "count": len(pending_checkpoints),
        "items": pending_checkpoints[:20],
        "priority": "medium" if len(pending_checkpoints) > 0 else "normal"
    }
    
    # 5. ALERTAS NÃO RESOLVIDOS
    alerts = await db.alerts.find(
        {"resolvido": False},
        {"_id": 0}
    ).sort("criado_em", -1).limit(20).to_list(20)
    
    report_data["sections"]["alerts"] = {
        "title": "Alertas Não Resolvidos",
        "count": len(alerts),
        "items": alerts,
        "priority": "high" if any(a.get("prioridade") == "alta" for a in alerts) else "medium"
    }
    
    # 6. CAPACIDADE DAS CONFECÇÕES
    confeccoes = await db.partners.find(
        {"tipo_servico": "confeccao", "ativo": True},
        {"_id": 0, "id": 1, "nome": 1, "capacidade_pecas_mes": 1, "num_trabalhadores": 1}
    ).to_list(100)
    
    capacity_data = []
    for conf in confeccoes:
        active_work = await db.projects.find(
            {"parceiro_confeccao_id": conf["id"], "status_projeto": {"$in": ["ativo", "atrasado"]}},
            {"_id": 0, "quantidade": 1}
        ).to_list(100)
        total_pieces = sum(w.get("quantidade", 0) for w in active_work)
        capacity = conf.get("capacidade_pecas_mes", 0)
        utilization = (total_pieces / capacity * 100) if capacity > 0 else 0
        
        capacity_data.append({
            "nome": conf["nome"],
            "capacidade": capacity,
            "em_curso": total_pieces,
            "utilizacao": round(utilization, 1),
            "status": "sobrecarregado" if utilization > 100 else "alto" if utilization > 80 else "normal"
        })
    
    capacity_data.sort(key=lambda x: -x["utilizacao"])
    
    report_data["sections"]["capacity"] = {
        "title": "Capacidade das Confecções",
        "count": len(capacity_data),
        "items": capacity_data,
        "priority": "high" if any(c["status"] == "sobrecarregado" for c in capacity_data) else "normal"
    }
    
    # 7. PROJETOS SEM CONFECÇÃO
    sem_confeccao = await db.projects.find(
        {
            "parceiro_confeccao_id": {"$in": [None, ""]},
            "status_projeto": {"$nin": ["concluido", "cancelado"]}
        },
        {"_id": 0, "id": 1, "of_numero": 1, "modelo": 1, "quantidade": 1, "data_prevista_entrega": 1}
    ).sort("data_prevista_entrega", 1).to_list(50)
    
    report_data["sections"]["sem_confeccao"] = {
        "title": "Projetos Sem Confecção Atribuída",
        "count": len(sem_confeccao),
        "items": sem_confeccao,
        "priority": "high" if len(sem_confeccao) > 0 else "normal"
    }
    
    # 8. ANOTAÇÕES E LEMBRETES
    annotations = await db.report_annotations.find(
        {
            "$or": [
                {"data_lembrete": {"$lte": today_end.isoformat()}},
                {"data_lembrete": None}
            ],
            "arquivada": {"$ne": True}
        },
        {"_id": 0}
    ).sort("criado_em", -1).limit(20).to_list(20)
    
    # Enrich with project info
    for ann in annotations:
        if ann.get("projeto_id"):
            project = await db.projects.find_one(
                {"id": ann["projeto_id"]},
                {"_id": 0, "of_numero": 1, "modelo": 1}
            )
            if project:
                ann["of_numero"] = project.get("of_numero")
                ann["modelo"] = project.get("modelo")
    
    report_data["sections"]["annotations"] = {
        "title": "Anotações e Lembretes",
        "count": len(annotations),
        "items": annotations,
        "priority": "medium" if any(a.get("tipo") == "urgente" for a in annotations) else "normal"
    }
    
    # 9. ATRASOS REPORTADOS (Timeline events)
    reported_delays = await db.timeline_events.find(
        {
            "tipo_evento": {"$in": ["atraso", "problema", "bloqueio"]},
            "resolvido": {"$ne": True},
            "data_evento": {"$gte": (now - timedelta(days=7)).isoformat()}
        },
        {"_id": 0}
    ).sort("data_evento", -1).limit(20).to_list(20)
    
    # Enrich with project info
    for delay in reported_delays:
        project = await db.projects.find_one(
            {"id": delay.get("projeto_id")},
            {"_id": 0, "of_numero": 1, "modelo": 1}
        )
        if project:
            delay["of_numero"] = project.get("of_numero")
            delay["modelo"] = project.get("modelo")
    
    report_data["sections"]["reported_delays"] = {
        "title": "Atrasos e Problemas Reportados",
        "count": len(reported_delays),
        "items": reported_delays,
        "priority": "high" if len(reported_delays) > 0 else "normal"
    }
    
    # SUMMARY
    high_priority_count = sum(1 for s in report_data["sections"].values() if s.get("priority") == "high" and s.get("count", 0) > 0)
    
    report_data["summary"] = {
        "total_items": sum(s.get("count", 0) for s in report_data["sections"].values()),
        "high_priority_sections": high_priority_count,
        "needs_attention": high_priority_count > 0,
        "overall_status": "critical" if high_priority_count >= 3 else "attention" if high_priority_count > 0 else "normal"
    }
    
    return report_data


# ============== ROUTES ==============

@router.get("/config")
async def get_report_config(current_user: dict = Depends(get_current_user)):
    """Get report configuration"""
    config = await db.report_config.find_one({}, {"_id": 0})
    if not config:
        return ReportConfig().model_dump()
    return config

@router.put("/config")
async def update_report_config(
    config: ReportConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update report configuration"""
    if current_user.get("role") not in ["administrador", "direcao"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    config_dict = config.model_dump()
    config_dict["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    config_dict["atualizado_por"] = current_user["id"]
    
    await db.report_config.update_one({}, {"$set": config_dict}, upsert=True)
    return config_dict

@router.get("/daily")
async def get_daily_report(current_user: dict = Depends(get_current_user)):
    """Generate and return daily report data"""
    report_data = await generate_daily_report_data(current_user["id"])
    return report_data

@router.get("/daily/html", response_class=HTMLResponse)
async def get_daily_report_html(current_user: dict = Depends(get_current_user)):
    """Generate printable HTML version of daily report"""
    report_data = await generate_daily_report_data(current_user["id"])
    
    html = f"""
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório Diário - {report_data['date']}</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; padding: 20px; }}
            .header {{ text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #3b82f6; }}
            .header h1 {{ font-size: 24px; color: #1e40af; margin-bottom: 5px; }}
            .header .date {{ font-size: 14px; color: #64748b; }}
            .summary {{ background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }}
            .summary-item {{ text-align: center; }}
            .summary-item .value {{ font-size: 24px; font-weight: bold; }}
            .summary-item .label {{ font-size: 10px; color: #64748b; }}
            .summary-item.critical .value {{ color: #dc2626; }}
            .summary-item.attention .value {{ color: #f59e0b; }}
            .summary-item.normal .value {{ color: #22c55e; }}
            .section {{ margin-bottom: 20px; page-break-inside: avoid; }}
            .section-header {{ background: #1e40af; color: white; padding: 8px 12px; font-size: 13px; font-weight: 600; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; }}
            .section-header.high {{ background: #dc2626; }}
            .section-header.medium {{ background: #f59e0b; }}
            .section-content {{ border: 1px solid #e2e8f0; border-top: none; padding: 10px; border-radius: 0 0 4px 4px; }}
            table {{ width: 100%; border-collapse: collapse; font-size: 10px; }}
            th {{ background: #f8fafc; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600; }}
            td {{ padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }}
            tr:hover {{ background: #f8fafc; }}
            .badge {{ display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }}
            .badge-red {{ background: #fee2e2; color: #dc2626; }}
            .badge-yellow {{ background: #fef3c7; color: #d97706; }}
            .badge-green {{ background: #dcfce7; color: #16a34a; }}
            .badge-blue {{ background: #dbeafe; color: #2563eb; }}
            .empty {{ text-align: center; color: #94a3b8; padding: 20px; font-style: italic; }}
            .footer {{ text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 10px; }}
            @media print {{
                body {{ padding: 10px; }}
                .section {{ page-break-inside: avoid; }}
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Relatório Diário</h1>
            <div class="date">{report_data['date']} - Gerado às {datetime.now().strftime('%H:%M')}</div>
        </div>
        
        <div class="summary">
            <div class="summary-item {report_data['summary']['overall_status']}">
                <div class="value">{report_data['summary']['total_items']}</div>
                <div class="label">Total de Itens</div>
            </div>
            <div class="summary-item {'critical' if report_data['summary']['high_priority_sections'] > 2 else 'attention' if report_data['summary']['high_priority_sections'] > 0 else 'normal'}">
                <div class="value">{report_data['summary']['high_priority_sections']}</div>
                <div class="label">Secções Críticas</div>
            </div>
            <div class="summary-item">
                <div class="value">{report_data['sections']['delayed_projects']['count']}</div>
                <div class="label">Atrasados</div>
            </div>
            <div class="summary-item">
                <div class="value">{report_data['sections']['deliveries_today']['count']}</div>
                <div class="label">Entregas Hoje</div>
            </div>
        </div>
    """
    
    # Delayed Projects
    section = report_data['sections']['delayed_projects']
    if section['count'] > 0:
        html += f"""
        <div class="section">
            <div class="section-header high">
                <span>{section['title']}</span>
                <span>{section['count']} projetos</span>
            </div>
            <div class="section-content">
                <table>
                    <thead><tr><th>OF</th><th>Modelo</th><th>Qtd</th><th>Confecção</th><th>Etapa</th><th>Dias Atraso</th></tr></thead>
                    <tbody>
        """
        for item in section['items'][:10]:
            html += f"""<tr>
                <td><strong>{item.get('of_numero', '-')}</strong></td>
                <td>{item.get('modelo', '-')}</td>
                <td>{item.get('quantidade', 0):,}</td>
                <td>{item.get('parceiro_nome', '-')}</td>
                <td>{item.get('etapa_nome', '-')}</td>
                <td><span class="badge badge-red">{item.get('dias_atraso', 0)} dias</span></td>
            </tr>"""
        html += "</tbody></table></div></div>"
    
    # Deliveries Today
    section = report_data['sections']['deliveries_today']
    if section['count'] > 0:
        html += f"""
        <div class="section">
            <div class="section-header high">
                <span>{section['title']}</span>
                <span>{section['count']} entregas</span>
            </div>
            <div class="section-content">
                <table>
                    <thead><tr><th>OF</th><th>Modelo</th><th>Quantidade</th><th>Confecção</th><th>Status</th></tr></thead>
                    <tbody>
        """
        for item in section['items']:
            status_class = "badge-yellow" if item.get('status_projeto') == 'atrasado' else "badge-blue"
            html += f"""<tr>
                <td><strong>{item.get('of_numero', '-')}</strong></td>
                <td>{item.get('modelo', '-')}</td>
                <td>{item.get('quantidade', 0):,}</td>
                <td>{item.get('parceiro_nome', '-')}</td>
                <td><span class="badge {status_class}">{item.get('status_projeto', '-')}</span></td>
            </tr>"""
        html += "</tbody></table></div></div>"
    
    # Alerts
    section = report_data['sections']['alerts']
    if section['count'] > 0:
        html += f"""
        <div class="section">
            <div class="section-header {'high' if section['priority'] == 'high' else 'medium'}">
                <span>{section['title']}</span>
                <span>{section['count']} alertas</span>
            </div>
            <div class="section-content">
                <table>
                    <thead><tr><th>Tipo</th><th>Mensagem</th><th>Prioridade</th></tr></thead>
                    <tbody>
        """
        for item in section['items'][:10]:
            prio_class = "badge-red" if item.get('prioridade') == 'alta' else "badge-yellow" if item.get('prioridade') == 'media' else "badge-blue"
            html += f"""<tr>
                <td>{item.get('tipo', '-')}</td>
                <td>{item.get('mensagem', '-')}</td>
                <td><span class="badge {prio_class}">{item.get('prioridade', 'normal')}</span></td>
            </tr>"""
        html += "</tbody></table></div></div>"
    
    # Capacity
    section = report_data['sections']['capacity']
    html += f"""
    <div class="section">
        <div class="section-header {'high' if section['priority'] == 'high' else ''}">
            <span>{section['title']}</span>
            <span>{section['count']} confecções</span>
        </div>
        <div class="section-content">
            <table>
                <thead><tr><th>Confecção</th><th>Capacidade</th><th>Em Curso</th><th>Utilização</th><th>Status</th></tr></thead>
                <tbody>
    """
    for item in section['items']:
        status_class = "badge-red" if item.get('status') == 'sobrecarregado' else "badge-yellow" if item.get('status') == 'alto' else "badge-green"
        html += f"""<tr>
            <td><strong>{item.get('nome', '-')}</strong></td>
            <td>{item.get('capacidade', 0):,} pcs</td>
            <td>{item.get('em_curso', 0):,} pcs</td>
            <td>{item.get('utilizacao', 0)}%</td>
            <td><span class="badge {status_class}">{item.get('status', 'normal')}</span></td>
        </tr>"""
    html += "</tbody></table></div></div>"
    
    # Reported Delays
    section = report_data['sections']['reported_delays']
    if section['count'] > 0:
        html += f"""
        <div class="section">
            <div class="section-header high">
                <span>{section['title']}</span>
                <span>{section['count']} registos</span>
            </div>
            <div class="section-content">
                <table>
                    <thead><tr><th>OF</th><th>Tipo</th><th>Descrição</th><th>Data</th></tr></thead>
                    <tbody>
        """
        for item in section['items'][:10]:
            html += f"""<tr>
                <td><strong>{item.get('of_numero', '-')}</strong></td>
                <td><span class="badge badge-red">{item.get('tipo_evento', '-')}</span></td>
                <td>{item.get('descricao', '-')[:50]}</td>
                <td>{item.get('data_evento', '-')[:10] if item.get('data_evento') else '-'}</td>
            </tr>"""
        html += "</tbody></table></div></div>"
    
    # Annotations
    section = report_data['sections']['annotations']
    if section['count'] > 0:
        html += f"""
        <div class="section">
            <div class="section-header medium">
                <span>{section['title']}</span>
                <span>{section['count']} notas</span>
            </div>
            <div class="section-content">
                <table>
                    <thead><tr><th>OF</th><th>Tipo</th><th>Nota</th></tr></thead>
                    <tbody>
        """
        for item in section['items'][:10]:
            tipo_class = "badge-red" if item.get('tipo') == 'urgente' else "badge-yellow" if item.get('tipo') == 'atencao' else "badge-blue"
            html += f"""<tr>
                <td>{item.get('of_numero', '-')}</td>
                <td><span class="badge {tipo_class}">{item.get('tipo', 'nota')}</span></td>
                <td>{item.get('texto', '-')[:60]}</td>
            </tr>"""
        html += "</tbody></table></div></div>"
    
    html += """
        <div class="footer">
            Textile Ops - Relatório gerado automaticamente
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html)

@router.get("/history")
async def get_report_history(
    limit: int = Query(30, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get history of generated reports"""
    reports = await db.reports_history.find(
        {},
        {"_id": 0}
    ).sort("generated_at", -1).limit(limit).to_list(limit)
    return reports

@router.post("/generate")
async def generate_and_save_report(current_user: dict = Depends(get_current_user)):
    """Manually generate and save a report"""
    report_data = await generate_daily_report_data(current_user["id"])
    
    # Save to history
    report_record = {
        "id": generate_id(),
        "generated_at": report_data["generated_at"],
        "generated_by": current_user["id"],
        "generated_by_name": current_user.get("nome"),
        "date": report_data["date"],
        "summary": report_data["summary"],
        "tipo": "manual"
    }
    await db.reports_history.insert_one(report_record)
    
    return report_data


# ============== ANNOTATIONS ==============

@router.get("/annotations")
async def get_annotations(
    projeto_id: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get annotations"""
    query = {"arquivada": {"$ne": True}}
    if projeto_id:
        query["projeto_id"] = projeto_id
    
    annotations = await db.report_annotations.find(
        query,
        {"_id": 0}
    ).sort("criado_em", -1).to_list(100)
    return annotations

@router.post("/annotations")
async def create_annotation(
    annotation: ReportAnnotation,
    current_user: dict = Depends(get_current_user)
):
    """Create a new annotation"""
    now = datetime.now(timezone.utc).isoformat()
    
    ann_dict = {
        "id": generate_id(),
        **annotation.model_dump(),
        "criado_em": now,
        "criado_por": current_user["id"],
        "criado_por_nome": current_user.get("nome"),
        "arquivada": False
    }
    
    await db.report_annotations.insert_one(ann_dict)
    ann_dict.pop("_id", None)
    return ann_dict

@router.patch("/annotations/{annotation_id}/archive")
async def archive_annotation(
    annotation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive an annotation"""
    result = await db.report_annotations.update_one(
        {"id": annotation_id},
        {"$set": {"arquivada": True, "arquivada_em": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Anotação não encontrada")
    return {"message": "Anotação arquivada"}

@router.delete("/annotations/{annotation_id}")
async def delete_annotation(
    annotation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an annotation"""
    result = await db.report_annotations.delete_one({"id": annotation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anotação não encontrada")
    return {"message": "Anotação eliminada"}
