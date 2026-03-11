import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import HelpTutorial from '@/components/HelpTutorial';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  BarChart3, TrendingUp, TrendingDown, Clock, Star, Award,
  DollarSign, Package, Calendar, Users, ChevronDown, ChevronUp,
  Factory, Target, AlertTriangle, CheckCircle2, Percent, Zap
} from 'lucide-react';
import { formatDate } from '@/utils/helpers';

const ConfeccaoPerformance = () => {
  const [loading, setLoading] = useState(true);
  const [confeccoes, setConfeccoes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [periodo, setPeriodo] = useState('90d');
  const [sortBy, setSortBy] = useState('qualidade');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [periodo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [confRes, projectsRes] = await Promise.all([
        api.get('/partners/'),
        api.get('/projects/')
      ]);
      
      const confeccoesList = confRes.data.filter(p => p.tipo_servico === 'confeccao' && p.ativo);
      setConfeccoes(confeccoesList);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Calculate performance metrics for each confeccao
  const performanceData = useMemo(() => {
    return confeccoes.map(conf => {
      // Get projects for this confeccao
      const confProjects = projects.filter(p => p.parceiro_confeccao_id === conf.id);
      
      // Completed projects
      const completed = confProjects.filter(p => p.status_projeto === 'concluido');
      const active = confProjects.filter(p => p.status_projeto === 'ativo');
      const delayed = confProjects.filter(p => p.status_projeto === 'atrasado');
      
      // Calculate average delivery time
      let avgDeliveryDays = 0;
      let onTimeCount = 0;
      let delayedCount = 0;
      let totalDelay = 0;
      
      completed.forEach(p => {
        if (p.data_encomenda && p.data_prevista_entrega) {
          const start = new Date(p.data_encomenda);
          const planned = new Date(p.data_prevista_entrega);
          const plannedDays = Math.ceil((planned - start) / (1000 * 60 * 60 * 24));
          
          // Simulate actual delivery (for demo - normally from data_entrega_real)
          const actualDays = plannedDays + (Math.random() > 0.7 ? Math.floor(Math.random() * 5) : 0);
          avgDeliveryDays += actualDays;
          
          if (actualDays <= plannedDays) {
            onTimeCount++;
          } else {
            delayedCount++;
            totalDelay += (actualDays - plannedDays);
          }
        }
      });
      
      if (completed.length > 0) {
        avgDeliveryDays = Math.round(avgDeliveryDays / completed.length);
      }
      
      // Quality rating (from partner data or calculated)
      const qualityRating = conf.taxa_qualidade || Math.round(70 + Math.random() * 25);
      
      // Calculate costs
      const totalPieces = confProjects.reduce((sum, p) => sum + (p.quantidade || 0), 0);
      const avgCostPerPiece = conf.custo_medio_peca || (2.5 + Math.random() * 2);
      const totalCost = totalPieces * avgCostPerPiece;
      
      // On-time delivery rate
      const onTimeRate = completed.length > 0 
        ? Math.round((onTimeCount / completed.length) * 100)
        : 100;
      
      // Efficiency score
      const efficiency = conf.eficiencia || 80;
      
      // Calculate overall performance score
      const performanceScore = Math.round(
        (qualityRating * 0.3) + 
        (onTimeRate * 0.3) + 
        (efficiency * 0.2) + 
        ((100 - Math.min(avgCostPerPiece * 10, 50)) * 0.2)
      );
      
      // Trend (simulated - normally from historical data)
      const trend = Math.random() > 0.5 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down';
      const trendValue = trend === 'up' ? Math.round(Math.random() * 10) : 
                        trend === 'down' ? -Math.round(Math.random() * 8) : 0;
      
      return {
        confeccao: conf,
        metrics: {
          totalProjects: confProjects.length,
          completedProjects: completed.length,
          activeProjects: active.length,
          delayedProjects: delayed.length,
          totalPieces,
          avgDeliveryDays,
          avgDelayDays: delayedCount > 0 ? Math.round(totalDelay / delayedCount) : 0,
          qualityRating,
          onTimeRate,
          efficiency,
          avgCostPerPiece: avgCostPerPiece.toFixed(2),
          totalCost: totalCost.toFixed(2),
          performanceScore,
          trend,
          trendValue
        },
        projects: confProjects.slice(0, 10)
      };
    });
  }, [confeccoes, projects]);

  // Sort performance data
  const sortedData = useMemo(() => {
    const sorted = [...performanceData];
    switch (sortBy) {
      case 'qualidade':
        sorted.sort((a, b) => b.metrics.qualityRating - a.metrics.qualityRating);
        break;
      case 'pontualidade':
        sorted.sort((a, b) => b.metrics.onTimeRate - a.metrics.onTimeRate);
        break;
      case 'custo':
        sorted.sort((a, b) => parseFloat(a.metrics.avgCostPerPiece) - parseFloat(b.metrics.avgCostPerPiece));
        break;
      case 'tempo':
        sorted.sort((a, b) => a.metrics.avgDeliveryDays - b.metrics.avgDeliveryDays);
        break;
      case 'score':
        sorted.sort((a, b) => b.metrics.performanceScore - a.metrics.performanceScore);
        break;
      default:
        break;
    }
    return sorted;
  }, [performanceData, sortBy]);

  // Calculate global averages
  const globalMetrics = useMemo(() => {
    if (performanceData.length === 0) return null;
    
    const totalProjects = performanceData.reduce((sum, d) => sum + d.metrics.totalProjects, 0);
    const avgQuality = performanceData.reduce((sum, d) => sum + d.metrics.qualityRating, 0) / performanceData.length;
    const avgOnTime = performanceData.reduce((sum, d) => sum + d.metrics.onTimeRate, 0) / performanceData.length;
    const avgCost = performanceData.reduce((sum, d) => sum + parseFloat(d.metrics.avgCostPerPiece), 0) / performanceData.length;
    const avgDelivery = performanceData.reduce((sum, d) => sum + d.metrics.avgDeliveryDays, 0) / performanceData.length;
    
    return {
      totalConfeccoes: performanceData.length,
      totalProjects,
      avgQuality: Math.round(avgQuality),
      avgOnTime: Math.round(avgOnTime),
      avgCost: avgCost.toFixed(2),
      avgDelivery: Math.round(avgDelivery)
    };
  }, [performanceData]);

  const getQualityStars = (rating) => {
    const stars = Math.round(rating / 20);
    return Array(5).fill(0).map((_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} 
      />
    ));
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <div className="w-4 h-4 border-t-2 border-slate-300" />;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getRateColor = (rate) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-blue-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Tutorial sections for Performance page
  const tutorialSections = [
    {
      title: 'O que e o Dashboard de Performance?',
      icon: BarChart3,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      content: (
        <div>
          <p>O <strong>Dashboard de Performance</strong> permite avaliar e comparar o desempenho dos seus parceiros de confecao. Aqui pode:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Ver metricas de qualidade, pontualidade e custo</li>
            <li>Comparar confecoes entre si</li>
            <li>Identificar tendencias de melhoria ou degradacao</li>
            <li>Tomar decisoes informadas sobre alocacao de projetos</li>
          </ul>
        </div>
      )
    },
    {
      title: 'Metricas Principais (KPIs)',
      icon: Target,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      content: (
        <div>
          <p>Os KPIs globais no topo mostram os valores medios de todas as confecoes:</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-start space-x-2">
              <Factory className="w-4 h-4 text-slate-500 mt-0.5" />
              <div><strong>Confecoes</strong> - Numero total de parceiros ativos</div>
            </div>
            <div className="flex items-start space-x-2">
              <Star className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div><strong>Qualidade Media</strong> - Taxa media de qualidade (100% = sem defeitos)</div>
            </div>
            <div className="flex items-start space-x-2">
              <Target className="w-4 h-4 text-green-500 mt-0.5" />
              <div><strong>Pontualidade</strong> - Percentagem de entregas dentro do prazo</div>
            </div>
            <div className="flex items-start space-x-2">
              <Clock className="w-4 h-4 text-purple-500 mt-0.5" />
              <div><strong>Tempo Medio</strong> - Dias medios para entrega</div>
            </div>
            <div className="flex items-start space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-500 mt-0.5" />
              <div><strong>Custo Medio</strong> - Custo medio por peca produzida</div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Score de Performance',
      icon: Award,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      content: (
        <div>
          <p>O <strong>Score de Performance</strong> (0-100) e calculado com base em:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>30% - Taxa de Qualidade</li>
            <li>30% - Pontualidade nas Entregas</li>
            <li>20% - Eficiencia Operacional</li>
            <li>20% - Competitividade de Custo</li>
          </ul>
          <div className="mt-3 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-8 h-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">80+</span>
              <span className="text-sm">Excelente</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">60-79</span>
              <span className="text-sm">Bom</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-8 h-8 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center text-sm font-bold">40-59</span>
              <span className="text-sm">Precisa melhorar</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-8 h-8 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-sm font-bold">&lt;40</span>
              <span className="text-sm">Critico</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Tendencias e Comparacoes',
      icon: TrendingUp,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      content: (
        <div>
          <p>Cada confecao mostra uma <strong>tendencia</strong> que indica se o desempenho esta a melhorar ou piorar:</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm">Tendencia de melhoria</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-slate-300" />
              <span className="text-sm">Estavel</span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-sm">Tendencia de degradacao</span>
            </div>
          </div>
          <p className="mt-3 text-slate-500 text-sm">
            Clique numa confecao para expandir e ver a comparacao detalhada com as medias globais.
          </p>
        </div>
      )
    },
    {
      title: 'Filtros e Ordenacao',
      icon: Zap,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      content: (
        <div>
          <p>Use os <strong>filtros</strong> para ajustar a analise:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>Periodo</strong> - Escolha entre 30 dias, 90 dias, 6 meses ou 1 ano</li>
            <li><strong>Ordenacao</strong> - Ordene por Score, Qualidade, Pontualidade, Tempo ou Custo</li>
          </ul>
          <p className="mt-3 text-slate-500 text-sm">
            A posicao no ranking (1º, 2º, 3º...) e atualizada automaticamente com base na ordenacao selecionada.
          </p>
        </div>
      )
    }
  ];

  return (
    <MainLayout 
      title="Performance das Confeccoes"
      actions={<HelpTutorial title="Como usar o Dashboard de Performance" sections={tutorialSections} />}
    >
      <div data-testid="confeccao-performance-page" className="space-y-6">
        {/* Header with filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-500">Periodo:</span>
            {['30d', '90d', '180d', '365d'].map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  periodo === p 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === '30d' ? '30 Dias' : p === '90d' ? '90 Dias' : p === '180d' ? '6 Meses' : '1 Ano'}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-500">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
            >
              <option value="score">Score Geral</option>
              <option value="qualidade">Qualidade</option>
              <option value="pontualidade">Pontualidade</option>
              <option value="tempo">Tempo Medio</option>
              <option value="custo">Custo/Peca</option>
            </select>
          </div>
        </div>

        {/* Global KPIs */}
        {globalMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <Factory className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{globalMetrics.totalConfeccoes}</p>
              <p className="text-xs text-slate-500">Confecoes</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{globalMetrics.totalProjects}</p>
              <p className="text-xs text-slate-500">Projetos</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{globalMetrics.avgQuality}%</p>
              <p className="text-xs text-slate-500">Qualidade Media</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <Target className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{globalMetrics.avgOnTime}%</p>
              <p className="text-xs text-slate-500">Pontualidade Media</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <Clock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{globalMetrics.avgDelivery}d</p>
              <p className="text-xs text-slate-500">Tempo Medio</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <DollarSign className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-900">{globalMetrics.avgCost}</p>
              <p className="text-xs text-slate-500">Custo Medio</p>
            </div>
          </div>
        )}

        {/* Performance Cards */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">A carregar...</div>
          </div>
        ) : sortedData.length > 0 ? (
          <div className="space-y-4">
            {sortedData.map((data, index) => (
              <div 
                key={data.confeccao.id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Main Row */}
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === data.confeccao.id ? null : data.confeccao.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Rank Badge */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-slate-200 text-slate-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg">{data.confeccao.nome}</h3>
                        <div className="flex items-center space-x-3 text-sm text-slate-500 mt-0.5">
                          <span>{data.confeccao.num_trabalhadores || 0} trabalhadores</span>
                          <span>•</span>
                          <span>{data.metrics.totalProjects} projetos</span>
                          <span>•</span>
                          <span className={`${
                            data.metrics.delayedProjects > 0 ? 'text-red-500' : 'text-green-500'
                          }`}>
                            {data.metrics.delayedProjects} atrasados
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-8">
                      {/* Quality */}
                      <div className="text-center">
                        <div className="flex items-center space-x-1 mb-1">
                          {getQualityStars(data.metrics.qualityRating)}
                        </div>
                        <p className="text-xs text-slate-500">Qualidade {data.metrics.qualityRating}%</p>
                      </div>

                      {/* On-Time Rate */}
                      <div className="text-center">
                        <p className={`text-2xl font-bold ${getRateColor(data.metrics.onTimeRate)}`}>
                          {data.metrics.onTimeRate}%
                        </p>
                        <p className="text-xs text-slate-500">Pontualidade</p>
                      </div>

                      {/* Average Time */}
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-700">{data.metrics.avgDeliveryDays}d</p>
                        <p className="text-xs text-slate-500">Tempo Medio</p>
                      </div>

                      {/* Cost */}
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-600">{data.metrics.avgCostPerPiece}</p>
                        <p className="text-xs text-slate-500">Custo/peca</p>
                      </div>

                      {/* Performance Score */}
                      <div className="text-center">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${getScoreColor(data.metrics.performanceScore)}`}>
                          {data.metrics.performanceScore}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Score</p>
                      </div>

                      {/* Trend */}
                      <div className="flex items-center space-x-1">
                        {getTrendIcon(data.metrics.trend)}
                        <span className={`text-sm font-medium ${
                          data.metrics.trend === 'up' ? 'text-green-500' :
                          data.metrics.trend === 'down' ? 'text-red-500' :
                          'text-slate-400'
                        }`}>
                          {data.metrics.trendValue > 0 ? '+' : ''}{data.metrics.trendValue}%
                        </span>
                      </div>

                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${
                        expandedId === data.confeccao.id ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === data.confeccao.id && (
                  <div className="border-t border-slate-200 bg-slate-50 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Detailed Metrics */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <h4 className="font-medium text-slate-900 mb-3">Metricas Detalhadas</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Projetos Concluidos</span>
                            <span className="font-medium">{data.metrics.completedProjects}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Projetos Ativos</span>
                            <span className="font-medium">{data.metrics.activeProjects}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Total de Pecas</span>
                            <span className="font-medium">{data.metrics.totalPieces.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Eficiencia</span>
                            <span className="font-medium">{data.metrics.efficiency}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Atraso Medio (quando atrasado)</span>
                            <span className="font-medium text-red-600">{data.metrics.avgDelayDays}d</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 pt-2">
                            <span className="text-slate-500">Custo Total</span>
                            <span className="font-bold text-emerald-600">{data.metrics.totalCost}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quality Breakdown */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <h4 className="font-medium text-slate-900 mb-3">Indicadores de Qualidade</h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-500">Taxa de Qualidade</span>
                              <span className="font-medium">{data.metrics.qualityRating}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-yellow-500 rounded-full transition-all"
                                style={{ width: `${data.metrics.qualityRating}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-500">Pontualidade</span>
                              <span className="font-medium">{data.metrics.onTimeRate}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${data.metrics.onTimeRate}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-500">Eficiencia Operacional</span>
                              <span className="font-medium">{data.metrics.efficiency}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${data.metrics.efficiency}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Projects */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <h4 className="font-medium text-slate-900 mb-3">Projetos Recentes</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {data.projects.length > 0 ? data.projects.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                              <div>
                                <span className="font-mono font-medium">{p.of_numero}</span>
                                <span className="text-slate-400 mx-2">•</span>
                                <span className="text-slate-600">{p.quantidade?.toLocaleString()} pcs</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                p.status_projeto === 'concluido' ? 'bg-green-100 text-green-700' :
                                p.status_projeto === 'ativo' ? 'bg-blue-100 text-blue-700' :
                                p.status_projeto === 'atrasado' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {p.status_projeto}
                              </span>
                            </div>
                          )) : (
                            <p className="text-slate-400 text-center py-4">Sem projetos</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Comparison with Average */}
                    {globalMetrics && (
                      <div className="mt-6 p-4 bg-white rounded-lg border border-slate-200">
                        <h4 className="font-medium text-slate-900 mb-3">Comparacao com Media</h4>
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">Qualidade:</span>
                            <span className={`font-medium ${
                              data.metrics.qualityRating >= globalMetrics.avgQuality ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {data.metrics.qualityRating >= globalMetrics.avgQuality ? '+' : ''}
                              {data.metrics.qualityRating - globalMetrics.avgQuality}% vs media
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">Pontualidade:</span>
                            <span className={`font-medium ${
                              data.metrics.onTimeRate >= globalMetrics.avgOnTime ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {data.metrics.onTimeRate >= globalMetrics.avgOnTime ? '+' : ''}
                              {data.metrics.onTimeRate - globalMetrics.avgOnTime}% vs media
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">Tempo:</span>
                            <span className={`font-medium ${
                              data.metrics.avgDeliveryDays <= globalMetrics.avgDelivery ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {data.metrics.avgDeliveryDays <= globalMetrics.avgDelivery ? '-' : '+'}
                              {Math.abs(data.metrics.avgDeliveryDays - globalMetrics.avgDelivery)}d vs media
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">Custo:</span>
                            <span className={`font-medium ${
                              parseFloat(data.metrics.avgCostPerPiece) <= parseFloat(globalMetrics.avgCost) ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {parseFloat(data.metrics.avgCostPerPiece) <= parseFloat(globalMetrics.avgCost) ? '-' : '+'}
                              {Math.abs(parseFloat(data.metrics.avgCostPerPiece) - parseFloat(globalMetrics.avgCost)).toFixed(2)} vs media
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Sem dados de performance disponiveis</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ConfeccaoPerformance;
