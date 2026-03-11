import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  FileType,
  Layers,
  Users,
  Building2,
  CheckSquare,
  Zap,
  Bell,
  Settings,
  History,
  List,
  CalendarDays,
  BarChart3,
  Clock,
  Tag,
  Workflow,
  LogOut,
  ChevronDown,
  ChevronRight,
  Factory,
  FileText,
  Shield,
  ClipboardList,
  Download,
  Table2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/utils/api';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasMenu, permissions } = useAuth();
  const [configOpen, setConfigOpen] = useState(false);
  const [customLists, setCustomLists] = useState([]);
  const [listsOpen, setListsOpen] = useState(true);

  // Verificar se o utilizador pode ver o configurador de listas
  const canConfigureLists = user?.role === 'administrador' || user?.role === 'direcao';

  useEffect(() => {
    // Check if current path is in config section
    const configPaths = ['/order-types', '/stages', '/checkpoints', '/rules', '/brands', '/partners', '/suppliers'];
    // Adicionar /listings ao config apenas para admins
    if (canConfigureLists) {
      configPaths.push('/listings');
    }
    if (configPaths.some(p => location.pathname.startsWith(p))) {
      setConfigOpen(true);
    }
    
    fetchCustomLists();
  }, [location.pathname, canConfigureLists]);

  const fetchCustomLists = async () => {
    try {
      const response = await api.get('/custom-views/');
      // As listas já vêm ordenadas por ordem de apresentação do backend
      setCustomLists(response.data || []);
    } catch (error) {
      // Silently fail - listings might not exist yet
      setCustomLists([]);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Menu item to permission mapping
  const menuPermissionMap = {
    '/dashboard': 'dashboard',
    '/operator': 'operator',
    '/projects': 'projects',
    '/confeccao-planning': 'confeccao-planning',
    '/confeccao-performance': 'confeccao-performance',
    '/planning': 'planning',
    '/timeline': 'timeline',
    '/capacity': 'capacity',
    '/reports': 'reports',
    '/listings': 'listings',
    '/order-types': 'order-types',
    '/stages': 'stages',
    '/checkpoints': 'checkpoints',
    '/rules': 'rules',
    '/brands': 'brands',
    '/partners': 'partners',
    '/suppliers': 'suppliers',
    '/users': 'users',
    '/permissions': 'permissions',
    '/history': 'history',
  };

  // Check if user can see menu item
  const canSeeMenu = (path) => {
    // Admin sees everything
    if (user?.role === 'administrador') return true;
    
    const permId = menuPermissionMap[path];
    if (!permId) return true; // Unknown paths are shown
    
    return hasMenu(permId);
  };

  // Main menu items - Ordem: Dashboard, Projetos, Confeções (antigo Painel Operador), etc.
  const mainMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permId: 'dashboard' },
    { path: '/projects', icon: FolderKanban, label: 'Projetos', permId: 'projects' },
    { path: '/operator', icon: Factory, label: 'Confeções', permId: 'operator' },
    { path: '/confeccao-planning', icon: Workflow, label: 'Plan. Confeções', permId: 'confeccao-planning' },
    { path: '/confeccao-performance', icon: BarChart3, label: 'Performance Conf.', permId: 'confeccao-performance' },
    { path: '/planning', icon: CalendarDays, label: 'Planeamento', permId: 'planning' },
    { path: '/timeline', icon: Clock, label: 'Timeline', permId: 'timeline' },
    { path: '/capacity', icon: BarChart3, label: 'Capacidade', permId: 'capacity' },
    { path: '/reports', icon: FileText, label: 'Relatórios', permId: 'reports' },
  ].filter(item => canSeeMenu(item.path));

  // Config submenu items (9.1 - 9.8) - Listagens só aparece para admins
  const configMenuItems = [
    ...(canConfigureLists ? [{ path: '/listings', icon: List, label: 'Listagens', permId: 'listings' }] : []),
    { path: '/order-types', icon: FileType, label: 'Tipos de Ordem', permId: 'order-types' },
    { path: '/stages', icon: Layers, label: 'Etapas', permId: 'stages' },
    { path: '/checkpoints', icon: CheckSquare, label: 'Checkpoints', permId: 'checkpoints' },
    { path: '/rules', icon: Zap, label: 'Regras', permId: 'rules' },
    { path: '/brands', icon: Tag, label: 'Marcas', permId: 'brands' },
    { path: '/partners', icon: Building2, label: 'Parceiros', permId: 'partners' },
    { path: '/suppliers', icon: Building2, label: 'Fornecedores', permId: 'suppliers' },
  ].filter(item => canSeeMenu(item.path));

  // Bottom menu items (10-12)
  const bottomMenuItems = [
    { path: '/users', icon: Users, label: 'Utilizadores', permId: 'users' },
    { path: '/permissions', icon: Shield, label: 'Permissões', permId: 'permissions' },
    { path: '/history', icon: History, label: 'Histórico', permId: 'history' },
  ].filter(item => canSeeMenu(item.path));

  // Check if config section should be shown
  const showConfigSection = configMenuItems.length > 0;

  const isActive = (path) => location.pathname.startsWith(path);
  
  const isConfigActive = () => {
    return configMenuItems.some(item => location.pathname.startsWith(item.path));
  };

  const MenuItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        data-testid={`sidebar-${item.label.toLowerCase().replace(/\s/g, '-')}`}
        className={`
          flex items-center space-x-3 px-3 py-2.5 rounded-md mb-1
          transition-all duration-200
          ${active 
            ? 'bg-slate-800 text-white shadow-sm' 
            : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
          }
        `}
      >
        <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
        <span className="text-sm font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <img 
            src="/logo-samidel.png" 
            alt="SAMIDEL" 
            className="h-10 w-auto"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {/* Main Menu (1-8) */}
        {mainMenuItems.map((item) => (
          <MenuItem key={item.path} item={item} />
        ))}
        
        {/* Listas Section - Mostra listas diretamente no menu para todos */}
        {customLists.length > 0 && (
          <div className="mt-2 mb-2">
            <button
              onClick={() => setListsOpen(!listsOpen)}
              className={`
                w-full flex items-center justify-between px-3 py-2.5 rounded-md mb-1
                transition-all duration-200
                ${location.pathname.startsWith('/view/')
                  ? 'bg-slate-800 text-white' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <Table2 className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-medium">Listas</span>
                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                  {customLists.length}
                </span>
              </div>
              {listsOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {listsOpen && (
              <div className="ml-4 pl-2 border-l border-slate-700">
                {customLists.map((list) => (
                  <Link
                    key={list.id}
                    to={`/view/${list.id}`}
                    data-testid={`list-menu-${list.id}`}
                    className={`
                      flex items-center space-x-3 px-3 py-2 rounded-md mb-0.5
                      transition-all duration-200
                      ${location.pathname === `/view/${list.id}`
                        ? 'bg-slate-800 text-white' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                      }
                    `}
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm truncate">{list.nome}</span>
                    {list.ordem > 0 && (
                      <span className="text-[10px] text-slate-500">{list.ordem}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Configurações Section (9) - Only show if user has any config permissions */}
        {showConfigSection && (
        <div className="mt-2">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className={`
              w-full flex items-center justify-between px-3 py-2.5 rounded-md mb-1
              transition-all duration-200
              ${isConfigActive()
                ? 'bg-slate-800 text-white' 
                : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }
            `}
          >
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-medium">Configurações</span>
            </div>
            {configOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          
          {configOpen && (
            <div className="ml-4 pl-2 border-l border-slate-700">
              {configMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-testid={`sidebar-config-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                    className={`
                      flex items-center space-x-3 px-3 py-2 rounded-md mb-0.5
                      transition-all duration-200
                      ${active 
                        ? 'bg-slate-800 text-white' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Divider - only show if there are bottom items */}
        {bottomMenuItems.length > 0 && (
          <div className="my-3 border-t border-slate-800" />
        )}

        {/* Bottom Menu (10-11) */}
        {bottomMenuItems.map((item) => (
          <MenuItem key={item.path} item={item} />
        ))}
      </nav>

      {/* User info + Logout button at bottom left */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center space-x-3 px-3 py-2">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {user?.nome?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.nome}</p>
            <p className="text-slate-400 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
