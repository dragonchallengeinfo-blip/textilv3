# SAMIDEL - Sistema de Gestão Operacional Têxtil

## Original Problem Statement
Melhorar a funcionalidade de Timeline para conseguir entender todos os eventos e feitos por quem ao longo de todo o processo de produção têxtil.

## Architecture
- **Frontend**: React.js 19 + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB

## User Personas
1. **Administrador** - Acesso total ao sistema
2. **Produção** - Gestão de ordens de fabrico
3. **Comercial** - Interação com clientes e encomendas

## Core Features
- Gestão de Projetos/Ordens de Fabrico (OF)
- 9 Etapas de produção configuráveis
- Sistema de checkpoints e regras
- Dashboard com KPIs
- Gestão de confecções/parceiros
- Planeamento e Timeline
- Listagens personalizadas
- Sistema de permissões por role

## What's Been Implemented (11/03/2026)

### Session 1 - Setup & Bug Fix
- Instalação do projeto textil2-main
- Execução do seed_data.py para dados iniciais
- Correção do erro de collections `notifications` e `negociacoes` em DBAccessor

### Session 2 - Timeline Enhancement
- **Novo endpoint** `GET /api/timeline/{project_id}/complete` que combina:
  - Eventos manuais da timeline (pausas, problemas, notas)
  - Histórico de alterações (mudanças de campos)
  - Respostas de checkpoints
  - Evento de criação do projeto
- **Filtros** por tipo de evento (all, timeline, history, checkpoint)
- **Estatísticas** da timeline:
  - Total de eventos
  - Total de alterações
  - Checkpoints respondidos
  - Participantes únicos
  - Problemas ativos
- **UI melhorada**:
  - Cards de estatísticas coloridos
  - Agrupamento por data com expansão/colapso
  - Labels amigáveis ("Hoje", "Ontem")
  - Informação do autor com avatar, nome e email
  - Indicador de importância (alta, média, normal)
  - Detalhes de alterações (valor anterior → novo)
  - Botões de ação rápida (Pausar, Retomar, Problema, Nota)
  - Secção de Problemas Ativos com botão de resolver

## Prioritized Backlog
### P0 (Critical)
- ✅ Timeline completa com todos os eventos

### P1 (High)
- Dashboard com métricas de produção
- Exportação de relatórios

### P2 (Medium)
- Notificações em tempo real (WebSocket melhorias)
- Integração calendário

## Test Credentials
- admin@textil.pt / admin123 (Administrador)
- producao@textil.pt / producao123 (Produção)
- comercial@textil.pt / comercial123 (Comercial)
