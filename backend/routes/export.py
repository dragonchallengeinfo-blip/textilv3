from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List
from utils import db, get_current_user, deserialize_datetime
from datetime import datetime, timezone
import csv
import io

router = APIRouter()

# Column labels in Portuguese
COLUMN_LABELS = {
    "of_numero": "OF",
    "modelo": "Modelo",
    "quantidade": "Quantidade",
    "marca": "Marca",
    "tipo_ordem": "Tipo Ordem",
    "comercial": "Comercial",
    "confeccao": "Confecção",
    "etapa_atual": "Etapa Atual",
    "status": "Estado",
    "progresso": "Progresso %",
    "data_encomenda": "Data Encomenda",
    "data_prevista_entrega": "Data Entrega",
    "data_entrada_confecao": "Data Confecção",
    "observacoes": "Observações",
}


async def get_project_export_data(filters: dict = None):
    """Get projects with all related data for export"""
    query = filters or {}
    projects = await db.projects.find(query, {"_id": 0}).to_list(10000)
    
    # Get related data
    brands = {b["id"]: b["nome"] async for b in db.brands.find({}, {"_id": 0, "id": 1, "nome": 1})}
    partners = {p["id"]: p["nome"] async for p in db.partners.find({}, {"_id": 0, "id": 1, "nome": 1})}
    users = {u["id"]: u["nome"] async for u in db.users.find({}, {"_id": 0, "id": 1, "nome": 1})}
    order_types = {o["id"]: o["nome"] async for o in db.order_types.find({}, {"_id": 0, "id": 1, "nome": 1})}
    stages = {s["id"]: s["nome"] async for s in db.stages.find({}, {"_id": 0, "id": 1, "nome": 1})}
    
    result = []
    for p in projects:
        result.append({
            "of_numero": p.get("of_numero", ""),
            "modelo": p.get("modelo", ""),
            "quantidade": p.get("quantidade", 0),
            "marca": brands.get(p.get("marca_id"), ""),
            "tipo_ordem": order_types.get(p.get("tipo_ordem_id"), ""),
            "comercial": users.get(p.get("comercial_responsavel_id"), ""),
            "confeccao": partners.get(p.get("parceiro_confeccao_id"), ""),
            "etapa_atual": stages.get(p.get("etapa_atual_id"), ""),
            "status": p.get("status_projeto", ""),
            "progresso": p.get("progresso_percentagem", 0),
            "data_encomenda": p.get("data_encomenda", "")[:10] if p.get("data_encomenda") else "",
            "data_prevista_entrega": p.get("data_prevista_entrega", "")[:10] if p.get("data_prevista_entrega") else "",
            "data_entrada_confecao": p.get("data_entrada_confecao", "")[:10] if p.get("data_entrada_confecao") else "",
            "observacoes": p.get("observacoes", ""),
        })
    
    return result


def generate_csv(data: List[dict], columns: List[str] = None):
    """Generate CSV from list of dicts"""
    if not data:
        return ""
    
    output = io.StringIO()
    fieldnames = columns or list(data[0].keys())
    
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    
    # Write header with Portuguese labels
    header = [COLUMN_LABELS.get(col, col) for col in fieldnames]
    writer.writerow(header)
    
    # Write data rows
    for row in data:
        writer.writerow([row.get(col, "") for col in fieldnames])
    
    return output.getvalue()


def generate_pdf(data: List[dict], title: str = "Lista de Projetos", confeccao_name: str = None):
    """Generate PDF from list of dicts"""
    from fpdf import FPDF
    
    if not data:
        return None
    
    # Create PDF
    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Title
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, title, ln=True, align='C')
    
    if confeccao_name:
        pdf.set_font('Helvetica', '', 12)
        pdf.cell(0, 8, f'Confeccao: {confeccao_name}', ln=True, align='C')
    
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, f'Data: {datetime.now().strftime("%d/%m/%Y %H:%M")}', ln=True, align='C')
    pdf.ln(5)
    
    # Define columns for PDF (simplified)
    pdf_columns = ["of_numero", "modelo", "quantidade", "confeccao", "etapa_atual", "progresso", "data_prevista_entrega", "status"]
    col_widths = [25, 40, 20, 45, 40, 20, 30, 25]  # Total ~245mm for A4 landscape
    
    # Header
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_fill_color(240, 240, 240)
    for i, col in enumerate(pdf_columns):
        label = COLUMN_LABELS.get(col, col)
        pdf.cell(col_widths[i], 8, label, border=1, fill=True, align='C')
    pdf.ln()
    
    # Data rows
    pdf.set_font('Helvetica', '', 8)
    for row in data:
        for i, col in enumerate(pdf_columns):
            value = str(row.get(col, ""))
            if col == "quantidade" and value:
                try:
                    value = f"{int(value):,}".replace(",", ".")
                except:
                    pass
            if col == "progresso" and value:
                try:
                    value = f"{int(float(value))}%"
                except:
                    pass
            # Truncate long values
            if len(value) > 20 and col not in ["of_numero", "quantidade", "progresso", "status"]:
                value = value[:18] + ".."
            pdf.cell(col_widths[i], 7, value, border=1, align='C' if col in ["quantidade", "progresso"] else 'L')
        pdf.ln()
    
    # Summary
    pdf.ln(5)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(0, 8, f'Total: {len(data)} projetos', ln=True)
    
    total_pecas = sum(row.get("quantidade", 0) for row in data if isinstance(row.get("quantidade"), (int, float)))
    pdf.cell(0, 8, f'Total de pecas: {total_pecas:,}'.replace(",", "."), ln=True)
    
    return pdf.output()


@router.get("/projects")
async def export_projects(
    confeccao_id: Optional[str] = Query(None, description="Filtrar por confecção"),
    status: Optional[str] = Query(None, description="Filtrar por estado"),
    marca_id: Optional[str] = Query(None, description="Filtrar por marca"),
    tipo_ordem_id: Optional[str] = Query(None, description="Filtrar por tipo de ordem"),
    comercial_id: Optional[str] = Query(None, description="Filtrar por comercial"),
    data_inicio: Optional[str] = Query(None, description="Data entrega início (YYYY-MM-DD)"),
    data_fim: Optional[str] = Query(None, description="Data entrega fim (YYYY-MM-DD)"),
    format: str = Query("csv", description="Formato de exportação: csv ou pdf"),
    current_user: dict = Depends(get_current_user)
):
    """Export projects as CSV or PDF with optional filters"""
    
    # Build query
    query = {}
    
    if confeccao_id:
        query["parceiro_confeccao_id"] = confeccao_id
    if status:
        query["status_projeto"] = status
    if marca_id:
        query["marca_id"] = marca_id
    if tipo_ordem_id:
        query["tipo_ordem_id"] = tipo_ordem_id
    if comercial_id:
        query["comercial_responsavel_id"] = comercial_id
    
    # Date range filter
    if data_inicio or data_fim:
        date_query = {}
        if data_inicio:
            date_query["$gte"] = data_inicio
        if data_fim:
            date_query["$lte"] = data_fim + "T23:59:59"
        if date_query:
            query["data_prevista_entrega"] = date_query
    
    # Get data
    data = await get_project_export_data(query)
    
    if not data:
        raise HTTPException(status_code=404, detail="Nenhum projeto encontrado com os filtros especificados")
    
    # Get confeccao name for filename and PDF title
    confeccao_name = None
    if confeccao_id:
        confeccao = await db.partners.find_one({"id": confeccao_id}, {"_id": 0, "nome": 1})
        if confeccao:
            confeccao_name = confeccao["nome"]
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    safe_name = confeccao_name.replace(" ", "_").replace("/", "-")[:20] if confeccao_name else "todos"
    
    if format == "pdf":
        # Generate PDF
        pdf_content = generate_pdf(
            data, 
            title="Lista de Projetos", 
            confeccao_name=confeccao_name
        )
        
        if not pdf_content:
            raise HTTPException(status_code=500, detail="Erro ao gerar PDF")
        
        filename = f"projetos_{safe_name}_{timestamp}.pdf"
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    else:
        # Generate CSV (default)
        csv_content = generate_csv(data)
        filename = f"projetos_{safe_name}_{timestamp}.csv"
        
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8-sig')),  # BOM for Excel compatibility
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )


@router.get("/confeccao/{confeccao_id}/summary")
async def get_confeccao_export_summary(
    confeccao_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get summary statistics for a confeccao before export"""
    
    # Check if confeccao exists
    confeccao = await db.partners.find_one({"id": confeccao_id}, {"_id": 0})
    if not confeccao:
        raise HTTPException(status_code=404, detail="Confecção não encontrada")
    
    # Get projects count and stats
    projects = await db.projects.find(
        {"parceiro_confeccao_id": confeccao_id}, 
        {"_id": 0, "status_projeto": 1, "quantidade": 1, "progresso_percentagem": 1}
    ).to_list(10000)
    
    total = len(projects)
    total_pecas = sum(p.get("quantidade", 0) for p in projects)
    
    # Status breakdown
    status_counts = {}
    for p in projects:
        status = p.get("status_projeto", "desconhecido")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Average progress
    avg_progress = sum(p.get("progresso_percentagem", 0) for p in projects) / total if total > 0 else 0
    
    return {
        "confeccao": confeccao,
        "total_projetos": total,
        "total_pecas": total_pecas,
        "progresso_medio": round(avg_progress, 1),
        "por_status": status_counts
    }
