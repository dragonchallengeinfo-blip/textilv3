export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getStatusColor = (status) => {
  const statusColors = {
    'rascunho': 'bg-slate-100 text-slate-700 border-slate-200',
    'ativo': 'bg-green-50 text-green-700 border-green-200',
    'atrasado': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'bloqueado': 'bg-red-50 text-red-700 border-red-200',
    'concluido': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'cancelado': 'bg-slate-100 text-slate-500 border-slate-200',
    'nao_iniciado': 'bg-slate-100 text-slate-700 border-slate-200',
    'em_progresso': 'bg-blue-50 text-blue-700 border-blue-200',
    'dentro_prazo': 'bg-green-50 text-green-700 border-green-200',
    'risco': 'bg-yellow-50 text-yellow-700 border-yellow-200'
  };
  return statusColors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
};

export const getStatusLabel = (status) => {
  const statusLabels = {
    'rascunho': 'Rascunho',
    'ativo': 'Ativo',
    'atrasado': 'Atrasado',
    'bloqueado': 'Bloqueado',
    'concluido': 'Concluído',
    'cancelado': 'Cancelado',
    'nao_iniciado': 'Não Iniciado',
    'em_progresso': 'Em Progresso',
    'dentro_prazo': 'Dentro do Prazo',
    'risco': 'Em Risco'
  };
  return statusLabels[status] || status;
};

export const getRoleLabel = (role) => {
  const roleLabels = {
    'administrador': 'Administrador',
    'direcao': 'Direção',
    'comercial': 'Comercial',
    'producao': 'Produção',
    'qualidade': 'Qualidade',
    'parceiro_externo': 'Parceiro Externo',
    'consulta': 'Consulta'
  };
  return roleLabels[role] || role;
};

export const getPartnerTypeLabel = (type) => {
  const typeLabels = {
    'confeccao': 'Confeção',
    'lavandaria': 'Lavandaria',
    'acabamento': 'Acabamento',
    'estampagem': 'Estampagem',
    'bordado': 'Bordado',
    'outro': 'Outro'
  };
  return typeLabels[type] || type;
};
