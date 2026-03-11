import React, { useState, useEffect } from 'react';
import { LogOut, Bell, BellRing, X, AlertTriangle, Clock, BarChart3, XCircle, Check, HelpCircle, Settings2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/utils/api';
import { formatDateTime } from '@/utils/helpers';

const Header = ({ title, actions, onShowWizard }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get('/reservas/notifications?limit=20'),
        api.get('/reservas/notifications/unread-count')
      ]);
      setNotifications(notifRes.data);
      setUnreadCount(countRes.data.unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markNotificationRead = async (notifId) => {
    try {
      await api.patch(`/reservas/notifications/${notifId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.post('/reservas/notifications/mark-all-read');
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  };

  const getNotificationIcon = (tipo) => {
    switch (tipo) {
      case 'sobrecarga': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'conflito': return <XCircle className="w-4 h-4 text-orange-500" />;
      case 'prazo': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'capacidade': return <BarChart3 className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="h-16 border-b border-slate-200 bg-white flex items-center px-6 justify-between flex-shrink-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center space-x-4">
        {actions}
        
        {/* Help Menu */}
        <div className="relative">
          <button
            onClick={() => setShowHelpMenu(!showHelpMenu)}
            data-testid="help-menu-button"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Ajuda e Configuração"
          >
            <HelpCircle className="w-5 h-5 text-slate-500" />
          </button>
          
          {showHelpMenu && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowHelpMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50">
                <div className="py-1">
                  {onShowWizard && (
                    <button
                      onClick={() => {
                        onShowWizard();
                        setShowHelpMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-3"
                    >
                      <Settings2 className="w-4 h-4 text-blue-500" />
                      <span>Assistente de Configuração</span>
                    </button>
                  )}
                  <Link
                    to="/rules"
                    onClick={() => setShowHelpMenu(false)}
                    className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-3"
                  >
                    <HelpCircle className="w-4 h-4 text-green-500" />
                    <span>Tutorial - Regras</span>
                  </Link>
                  <Link
                    to="/checkpoints"
                    onClick={() => setShowHelpMenu(false)}
                    className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-3"
                  >
                    <HelpCircle className="w-4 h-4 text-purple-500" />
                    <span>Tutorial - Checkpoints</span>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Notifications Bell - Now in Header (top right) */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            data-testid="notifications-bell"
            className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {unreadCount > 0 ? (
              <BellRing className="w-5 h-5 text-orange-500" />
            ) : (
              <Bell className="w-5 h-5 text-slate-500" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-[500px] overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-slate-600" />
                    <span className="font-medium text-slate-900">Alertas</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                        {unreadCount} novos
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Marcar todas</span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={`px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                          !notif.lida ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          {getNotificationIcon(notif.tipo)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!notif.lida ? 'font-medium' : ''} text-slate-900`}>
                              {notif.titulo}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {notif.mensagem}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {formatDateTime(notif.criado_em)}
                            </p>
                          </div>
                          {!notif.lida && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Sem alertas</p>
                    </div>
                  )}
                </div>
                
                <Link
                  to="/alerts"
                  onClick={() => setShowNotifications(false)}
                  className="block px-4 py-3 bg-slate-50 border-t border-slate-200 text-center text-sm text-blue-600 hover:text-blue-800 hover:bg-slate-100 transition-colors"
                >
                  Ver todos os alertas
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
