# SAMIDEL - Sistema de Gestão Operacional Têxtil

## Visão Geral
Sistema completo de gestão operacional para empresas têxteis, com controlo de produção, confecções, planeamento e fluxo de trabalho.

## Arquitectura
- **Frontend**: React.js 19 + TailwindCSS
- **Backend**: FastAPI (Python) + WebSockets
- **Base de Dados**: MongoDB
- **Autenticação**: JWT com sistema de permissões por role
- **Tempo Real**: WebSockets para atualizações automáticas

## Funcionalidades Principais

### Core
- Gestão de Projetos (OF - Ordens de Fabrico)
- Etapas de produção configuráveis (9 etapas)
- Checkpoints por etapa
- Sistema de regras e automação
- Dashboard com KPIs

### Confecções
- Gestão de parceiros/confecções
- Planeamento de confecções
- Performance de confecções
- Timeline de produção

### Listagens Personalizadas (ATUALIZADO)
- **Ordem de Apresentação** - Campo numérico para ordenar listas no menu
- **Filtro por Estados** - Definir quais estados aparecem em cada listagem
- **Menu Direto para Produção** - Listas aparecem diretamente no menu (sem configurador)
- Pesquisa em todas as colunas
- Filtros por coluna com dropdowns
- Ordenação ascendente/descendente
- Edição inline de campos e checkpoints
- Exportação PDF horizontal

## Implementações Recentes

### Sessão 19 (10/03/2026) - MELHORIAS MENU E FILTROS DE LISTAGENS
**3 Funcionalidades Implementadas:**

1. **Ordem de Apresentação no Menu**
   - Novo campo `ordem` nas CustomViews
   - Listas ordenadas por ordem ascendente no menu
   - Indicador visual "#N" no card da lista

2. **Filtro por Estados**
   - Novo campo `status_filter` nas CustomViews
   - Tags clicáveis no configurador (Rascunho, Ativo, Atrasado, Bloqueado, Concluído, Cancelado)
   - Backend filtra automaticamente por estados selecionados

3. **Menu Direto para Produção**
   - Secção "Listas" no menu lateral para todos os utilizadores
   - Configurador de Listagens apenas visível para Admin/Direcção
   - Nova rota `/view/:id` para acesso direto às listas
   - Listas expandíveis no submenu com contador

**Ficheiros Modificados:**
- `/app/backend/models.py` - Campos ordem e status_filter
- `/app/backend/routes/custom_views.py` - Ordenação e filtro de estados
- `/app/frontend/src/components/layout/Sidebar.js` - Menu com listas diretas
- `/app/frontend/src/pages/CustomListings.js` - ViewBuilder com novos campos
- `/app/frontend/src/pages/ListView.js` - Nova página de visualização
- `/app/frontend/src/App.js` - Nova rota /view/:viewId

### Sessões Anteriores
- Sessão 18: Tabela Compacta e PDF Landscape
- Sessão 17: Pesquisa, Filtros, Ordenação, Controlo de Acesso

## User Personas

1. **Administrador** - Acesso total, configurações, gestão de listagens
2. **Direcção** - Acesso total, configurações
3. **Produção** - Acesso às listas, sem configurador
4. **Comercial** - Gestão de projetos, clientes
5. **Operador** - Execução de tarefas, checkpoints

## Credenciais de Teste
- admin@textil.pt / admin123 (Administrador)
- producao@textil.pt / producao123 (Produção)
- comercial@textil.pt / comercial123 (Comercial)

## Backlog

### P0 - Crítico (Concluído)
- ✅ Checkpoints dinâmicos nas Listagens
- ✅ Agrupamento visual OF vs Checkpoints
- ✅ Pesquisa, Filtros, Ordenação nas Listagens
- ✅ Edição inline de checkpoints
- ✅ Controlo de acesso por roles
- ✅ Ordem de apresentação das listas
- ✅ Filtro por estados nas listas
- ✅ Menu direto para produção

### P1 - Alta Prioridade
- Notificações por email (SendGrid)
- Exportação em Excel (xlsx)
- Paginação server-side para grandes volumes

### P2 - Média Prioridade
- App mobile para operadores
- Integração com sistemas ERP
- Relatórios avançados com gráficos

## Próximos Passos
1. Testar fluxo completo com diferentes utilizadores
2. Implementar notificações por email
3. Exportação Excel

---
**Última Actualização:** 10/03/2026 - Sessão 19 (Melhorias Menu e Filtros de Listagens)
