import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GripVertical, Bookmark, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Calendar, Package, Clock, Save, Trash2, AlertCircle, Edit3 } from 'lucide-react';
import { formatDate } from '@/utils/helpers';

const GanttChart = ({ 
  confeccoes = [], 
  reservas = [],
  onMoveItem,
  onResizeItem,
  onItemClick,
  onUpdateDates,
  onDeleteItem
}) => {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [zoom, setZoom] = useState(1); // 0.5 = month view, 1 = week view, 2 = day view
  const [scrollOffset, setScrollOffset] = useState(0);
  
  // Edit modal state
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({
    data_inicio: '',
    data_fim: ''
  });
  
  // Calculate date range from all events
  const dateRange = useMemo(() => {
    const allDates = [];
    
    confeccoes.forEach(conf => {
      conf.eventos?.forEach(e => {
        if (e.data_inicio) allDates.push(new Date(e.data_inicio));
        if (e.data_fim) allDates.push(new Date(e.data_fim));
        if (e.data_entrega) allDates.push(new Date(e.data_entrega));
      });
    });
    
    reservas.forEach(r => {
      if (r.data_inicio) allDates.push(new Date(r.data_inicio));
      if (r.data_fim) allDates.push(new Date(r.data_fim));
    });
    
    if (allDates.length === 0) {
      // Default: today + 60 days
      const today = new Date();
      return {
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60),
        totalDays: 67
      };
    }
    
    // Extend range for better visualization
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    
    // Extend start by 7 days and end by 14 days
    const start = new Date(minDate);
    start.setDate(start.getDate() - 7);
    
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 14);
    
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    return { start, end, totalDays };
  }, [confeccoes, reservas]);
  
  // Day width based on zoom level
  const dayWidth = useMemo(() => {
    const baseWidth = 40;
    return baseWidth * zoom;
  }, [zoom]);
  
  // Generate header dates (grouped by weeks/months)
  const headerDates = useMemo(() => {
    const dates = [];
    const weeks = [];
    const months = [];
    
    let currentDate = new Date(dateRange.start);
    let currentWeekStart = null;
    let currentMonth = null;
    let currentMonthDays = 0;
    
    for (let i = 0; i < dateRange.totalDays; i++) {
      const date = new Date(currentDate);
      dates.push(date);
      
      // Track weeks (starting Monday)
      const weekDay = date.getDay();
      if (weekDay === 1 || currentWeekStart === null) {
        if (currentWeekStart !== null) {
          weeks[weeks.length - 1].days = i - weeks[weeks.length - 1].startIndex;
        }
        currentWeekStart = new Date(date);
        weeks.push({
          start: currentWeekStart,
          startIndex: i,
          days: 1,
          weekNum: getWeekNumber(date)
        });
      }
      
      // Track months
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthKey !== currentMonth) {
        if (currentMonth !== null) {
          months[months.length - 1].days = currentMonthDays;
        }
        currentMonth = monthKey;
        currentMonthDays = 0;
        months.push({
          year: date.getFullYear(),
          month: date.getMonth(),
          name: date.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' }),
          startIndex: i,
          days: 0
        });
      }
      currentMonthDays++;
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Close last week and month
    if (weeks.length > 0) {
      weeks[weeks.length - 1].days = dateRange.totalDays - weeks[weeks.length - 1].startIndex;
    }
    if (months.length > 0) {
      months[months.length - 1].days = currentMonthDays;
    }
    
    return { dates, weeks, months };
  }, [dateRange]);
  
  // Calculate position and width for an item
  const getItemPosition = useCallback((startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startDays = Math.max(0, Math.floor((start - dateRange.start) / (1000 * 60 * 60 * 24)));
    const endDays = Math.ceil((end - dateRange.start) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, endDays - startDays);
    
    return {
      left: startDays * dayWidth,
      width: Math.max(duration * dayWidth, 60)
    };
  }, [dateRange, dayWidth]);
  
  // Drag handlers
  const handleDragStart = (e, item, type, confeccaoId) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragging({ item, type, sourceConfeccaoId: confeccaoId });
  };
  
  const handleDragOver = (e, confeccaoId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(confeccaoId);
  };
  
  const handleDragLeave = () => {
    setDropTarget(null);
  };
  
  const handleDrop = async (e, targetConfeccaoId) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!dragging || !onMoveItem) return;
    
    const { item, type, sourceConfeccaoId } = dragging;
    
    if (sourceConfeccaoId !== targetConfeccaoId) {
      onMoveItem(item, type, targetConfeccaoId);
    }
    
    setDragging(null);
  };
  
  // Resize handlers
  const handleResizeStart = (e, item, type, direction) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const startWidth = e.target.parentElement.offsetWidth;
    const startLeft = parseFloat(e.target.parentElement.style.left) || 0;
    
    setResizing({
      item,
      type,
      direction,
      startX,
      startWidth,
      startLeft,
      startDate: new Date(item.data_inicio),
      endDate: new Date(item.data_fim)
    });
  };
  
  const handleResizeMove = useCallback((e) => {
    if (!resizing) return;
    
    const deltaX = e.clientX - resizing.startX;
    const deltaDays = Math.round(deltaX / dayWidth);
    
    if (deltaDays === 0) return;
    
    const newStartDate = new Date(resizing.startDate);
    const newEndDate = new Date(resizing.endDate);
    
    if (resizing.direction === 'right') {
      newEndDate.setDate(newEndDate.getDate() + deltaDays);
    } else if (resizing.direction === 'left') {
      newStartDate.setDate(newStartDate.getDate() + deltaDays);
    }
    
    // Update visual feedback
    setResizing(prev => ({
      ...prev,
      currentStartDate: newStartDate,
      currentEndDate: newEndDate
    }));
  }, [resizing, dayWidth]);
  
  const handleResizeEnd = useCallback(() => {
    if (!resizing || !onResizeItem) {
      setResizing(null);
      return;
    }
    
    const { item, type, currentStartDate, currentEndDate } = resizing;
    
    if (currentStartDate && currentEndDate) {
      onResizeItem(item, type, currentStartDate, currentEndDate);
    }
    
    setResizing(null);
  }, [resizing, onResizeItem]);
  
  // Mouse event listeners for resize
  useEffect(() => {
    if (resizing) {
      const handleMouseMove = (e) => handleResizeMove(e);
      const handleMouseUp = () => handleResizeEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);
  
  // Scroll handlers
  const scrollToToday = () => {
    const today = new Date();
    const daysFromStart = Math.floor((today - dateRange.start) / (1000 * 60 * 60 * 24));
    const scrollPosition = Math.max(0, (daysFromStart - 3) * dayWidth);
    
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollPosition;
    }
  };
  
  // Initial scroll to today
  useEffect(() => {
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [dateRange]);
  
  // Open edit modal
  const openEditModal = (item, type, confeccaoId) => {
    setEditModal({ item, type, confeccaoId });
    setEditForm({
      data_inicio: item.data_inicio?.split('T')[0] || '',
      data_fim: item.data_fim?.split('T')[0] || ''
    });
  };
  
  // Save edit changes
  const handleSaveEdit = () => {
    if (!editModal || !onUpdateDates) return;
    
    const { item, type } = editModal;
    onUpdateDates(item, type, editForm.data_inicio, editForm.data_fim);
    setEditModal(null);
  };
  
  // Delete item
  const handleDelete = () => {
    if (!editModal || !onDeleteItem) return;
    
    const { item, type } = editModal;
    onDeleteItem(item, type);
    setEditModal(null);
  };
  
  // Get week number
  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  
  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };
  
  // Check if date is weekend
  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };
  
  const totalWidth = dateRange.totalDays * dayWidth;
  
  return (
    <div className="gantt-chart bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-slate-700">Zoom:</span>
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="p-1 hover:bg-slate-200 rounded"
            title="Reduzir zoom"
          >
            <ZoomOut className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
            className="p-1 hover:bg-slate-200 rounded"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        
        <button
          onClick={scrollToToday}
          className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md"
        >
          Hoje
        </button>
        
        <div className="flex items-center space-x-4 text-xs text-slate-500">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>Ativo</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>Atrasado</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded border-2 border-dashed border-yellow-400 bg-yellow-50"></div>
            <span>Reserva</span>
          </div>
        </div>
      </div>
      
      {/* Main Chart Area */}
      <div className="flex">
        {/* Left sidebar - Fixed */}
        <div className="flex-shrink-0 w-48 bg-slate-50 border-r border-slate-200">
          {/* Header spacer */}
          <div className="h-16 border-b border-slate-200 px-3 py-2">
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Confecção</span>
          </div>
          
          {/* Confeccao rows */}
          {confeccoes.map(conf => {
            const confReservas = reservas.filter(r => r.confeccao_id === conf.confeccao?.id);
            const rowHeight = Math.max(60, (conf.eventos?.length + confReservas.length) * 28 + 16);
            
            return (
              <div
                key={conf.confeccao?.id}
                className={`border-b border-slate-100 px-3 py-2 transition-colors ${
                  dropTarget === conf.confeccao?.id ? 'bg-blue-50' : ''
                }`}
                style={{ minHeight: rowHeight }}
              >
                <div className="font-medium text-sm text-slate-900 truncate">
                  {conf.confeccao?.nome}
                </div>
                <div className="text-xs text-slate-500">
                  {conf.total_trabalhos} trabalhos
                </div>
                {conf.confeccao?.capacidade_pecas_mes && (
                  <div className="text-xs text-slate-400">
                    {conf.confeccao.capacidade_pecas_mes.toLocaleString()} peças/mês
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Right content - Scrollable */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div style={{ minWidth: totalWidth + 200 }}>
            {/* Timeline Header */}
            <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
              {/* Months row */}
              <div className="flex h-8 border-b border-slate-100">
                {headerDates.months.map((month, i) => (
                  <div
                    key={`month-${i}`}
                    className="flex-shrink-0 px-2 flex items-center justify-center bg-slate-100 border-r border-slate-200"
                    style={{ width: month.days * dayWidth }}
                  >
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      {month.name}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Days row */}
              <div className="flex h-8">
                {headerDates.dates.map((date, i) => (
                  <div
                    key={`day-${i}`}
                    className={`flex-shrink-0 flex flex-col items-center justify-center border-r text-center ${
                      isToday(date)
                        ? 'bg-blue-500 text-white'
                        : isWeekend(date)
                          ? 'bg-slate-50 text-slate-400'
                          : 'bg-white text-slate-600'
                    }`}
                    style={{ width: dayWidth }}
                  >
                    <span className={`text-[10px] font-medium ${isToday(date) ? 'text-white' : ''}`}>
                      {date.getDate()}
                    </span>
                    <span className={`text-[8px] ${isToday(date) ? 'text-blue-100' : 'text-slate-400'}`}>
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Chart Rows */}
            {confeccoes.map(conf => {
              const confReservas = reservas.filter(r => r.confeccao_id === conf.confeccao?.id);
              const allItems = [...(conf.eventos || []), ...confReservas.map(r => ({ ...r, isReserva: true }))];
              const rowHeight = Math.max(60, allItems.length * 28 + 16);
              
              return (
                <div
                  key={conf.confeccao?.id}
                  className={`relative border-b border-slate-100 transition-colors ${
                    dropTarget === conf.confeccao?.id ? 'bg-blue-50/50' : ''
                  }`}
                  style={{ height: rowHeight }}
                  onDragOver={(e) => handleDragOver(e, conf.confeccao?.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, conf.confeccao?.id)}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {headerDates.dates.map((date, i) => (
                      <div
                        key={`grid-${i}`}
                        className={`flex-shrink-0 h-full border-r ${
                          isToday(date)
                            ? 'bg-blue-50/50 border-blue-200'
                            : isWeekend(date)
                              ? 'bg-slate-50/50 border-slate-200'
                              : 'border-slate-100'
                        }`}
                        style={{ width: dayWidth }}
                      />
                    ))}
                  </div>
                  
                  {/* Today line */}
                  {(() => {
                    const today = new Date();
                    const todayPosition = Math.floor((today - dateRange.start) / (1000 * 60 * 60 * 24)) * dayWidth + dayWidth / 2;
                    if (todayPosition > 0 && todayPosition < totalWidth) {
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
                          style={{ left: todayPosition }}
                        />
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Events (Trabalhos) */}
                  {conf.eventos?.map((evento, idx) => {
                    const position = getItemPosition(evento.data_inicio, evento.data_fim);
                    const isBeingResized = resizing?.item?.id === evento.id;
                    
                    // Use resizing dimensions if active
                    let displayPosition = position;
                    if (isBeingResized && resizing.currentStartDate && resizing.currentEndDate) {
                      displayPosition = getItemPosition(resizing.currentStartDate, resizing.currentEndDate);
                    }
                    
                    return (
                      <div
                        key={evento.id}
                        data-testid={`gantt-work-bar-${evento.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, evento, 'trabalho', conf.confeccao?.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(evento, 'trabalho', conf.confeccao?.id);
                        }}
                        onDoubleClick={() => onItemClick?.(evento, 'trabalho')}
                        className={`absolute rounded shadow-sm cursor-pointer hover:shadow-md transition-all text-white text-xs group ${
                          isBeingResized ? 'ring-2 ring-blue-300' : ''
                        }`}
                        style={{
                          backgroundColor: evento.cor || '#3B82F6',
                          left: `${displayPosition.left}px`,
                          width: `${displayPosition.width}px`,
                          top: `${idx * 28 + 8}px`,
                          height: '24px',
                          zIndex: isBeingResized ? 30 : 10
                        }}
                        title={`Clique para editar | ${evento.of_numero} - ${evento.quantidade?.toLocaleString()} peças`}
                      >
                        {/* Left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-l"
                          onMouseDown={(e) => handleResizeStart(e, evento, 'trabalho', 'left')}
                        />
                        
                        {/* Content */}
                        <div className="flex items-center h-full px-2 overflow-hidden">
                          <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-70 flex-shrink-0 mr-1" />
                          <span className="font-medium truncate">{evento.modelo || evento.of_numero}</span>
                          {displayPosition.width > 100 && (
                            <span className="opacity-70 ml-1">({evento.quantidade?.toLocaleString()})</span>
                          )}
                        </div>
                        
                        {/* Progress bar */}
                        {evento.progresso > 0 && (
                          <div 
                            className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-bl"
                            style={{ width: `${evento.progresso}%` }}
                          />
                        )}
                        
                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-r"
                          onMouseDown={(e) => handleResizeStart(e, evento, 'trabalho', 'right')}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Reservas */}
                  {confReservas.map((reserva, idx) => {
                    if (!reserva.data_inicio || !reserva.data_fim) return null;
                    
                    const position = getItemPosition(reserva.data_inicio, reserva.data_fim);
                    const isBeingResized = resizing?.item?.id === reserva.id;
                    
                    let displayPosition = position;
                    if (isBeingResized && resizing.currentStartDate && resizing.currentEndDate) {
                      displayPosition = getItemPosition(resizing.currentStartDate, resizing.currentEndDate);
                    }
                    
                    const yOffset = (conf.eventos?.length || 0) * 28 + idx * 28 + 8;
                    
                    return (
                      <div
                        key={reserva.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, reserva, 'reserva', conf.confeccao?.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(reserva, 'reserva', conf.confeccao?.id);
                        }}
                        onDoubleClick={() => onItemClick?.(reserva, 'reserva')}
                        className={`absolute rounded border-2 border-dashed cursor-pointer text-xs group ${
                          reserva.status === 'confirmada'
                            ? 'bg-green-50 border-green-400 text-green-800 hover:bg-green-100'
                            : 'bg-yellow-50 border-yellow-400 text-yellow-800 hover:bg-yellow-100'
                        } ${isBeingResized ? 'ring-2 ring-blue-300' : ''}`}
                        style={{
                          left: `${displayPosition.left}px`,
                          width: `${displayPosition.width}px`,
                          top: `${yOffset}px`,
                          height: '24px',
                          zIndex: isBeingResized ? 30 : 5
                        }}
                        title={`Clique para editar | Reserva: ${reserva.descricao}`}
                      >
                        {/* Left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/10 rounded-l"
                          onMouseDown={(e) => handleResizeStart(e, reserva, 'reserva', 'left')}
                        />
                        
                        {/* Content */}
                        <div className="flex items-center h-full px-2 overflow-hidden">
                          <Edit3 className="w-3 h-3 flex-shrink-0 mr-1 opacity-0 group-hover:opacity-100" />
                          <span className="truncate">{reserva.descricao}</span>
                        </div>
                        
                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/10 rounded-r"
                          onMouseDown={(e) => handleResizeStart(e, reserva, 'reserva', 'right')}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Empty state */}
      {confeccoes.length === 0 && (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <div className="text-center">
            <p className="font-medium">Sem dados para mostrar</p>
            <p className="text-sm">Não existem trabalhos ou reservas no período selecionado</p>
          </div>
        </div>
      )}
      
      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  editModal.type === 'reserva' ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  {editModal.type === 'reserva' ? (
                    <Bookmark className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <Package className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {editModal.type === 'reserva' ? 'Editar Reserva' : 'Editar Trabalho'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {editModal.item.descricao || editModal.item.modelo || editModal.item.of_numero}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setEditModal(null)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-3">
                {editModal.item.quantidade && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Quantidade</p>
                    <p className="font-semibold text-slate-900">
                      {editModal.item.quantidade?.toLocaleString()} peças
                    </p>
                  </div>
                )}
                {editModal.item.quantidade_pecas && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Quantidade</p>
                    <p className="font-semibold text-slate-900">
                      {editModal.item.quantidade_pecas?.toLocaleString()} peças
                    </p>
                  </div>
                )}
                {(editModal.item.dias_estimados || editModal.item.horas_totais) && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Duração Estimada</p>
                    <p className="font-semibold text-slate-900">
                      {editModal.item.dias_estimados ? `${editModal.item.dias_estimados} dias` : 
                       editModal.item.horas_totais ? `${Math.round(editModal.item.horas_totais)}h` : '-'}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Date inputs */}
              <div className="space-y-3">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 mb-1.5">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={editForm.data_inicio}
                    onChange={(e) => setEditForm({ ...editForm, data_inicio: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 mb-1.5">
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    Data de Fim
                  </label>
                  <input
                    type="date"
                    value={editForm.data_fim}
                    onChange={(e) => setEditForm({ ...editForm, data_fim: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Warning if dates are invalid */}
              {editForm.data_inicio && editForm.data_fim && new Date(editForm.data_inicio) > new Date(editForm.data_fim) && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>A data de início não pode ser posterior à data de fim</span>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              {onDeleteItem && editModal.type === 'reserva' && (
                <button
                  onClick={handleDelete}
                  className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>
              )}
              {(!onDeleteItem || editModal.type !== 'reserva') && <div />}
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editForm.data_inicio || !editForm.data_fim || new Date(editForm.data_inicio) > new Date(editForm.data_fim)}
                  className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttChart;
