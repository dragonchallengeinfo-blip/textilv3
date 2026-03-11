import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { toast } from 'sonner';
import { 
  Shield, Users, Lock, Unlock, ChevronDown, ChevronRight,
  Check, X, Save, RefreshCw, Settings, Eye, Edit, Trash2,
  Plus, FileText, Layers, CheckSquare, List
} from 'lucide-react';

const Permissions = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roles');
  const [options, setOptions] = useState({ menus: [], actions: [], stages: [], listings: [], roles: [] });
  const [rolePermissions, setRolePermissions] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [optionsRes, rolesRes, usersRes] = await Promise.all([
        api.get('/permissions/options'),
        api.get('/permissions/roles'),
        api.get('/users/')
      ]);
      setOptions(optionsRes.data);
      setRolePermissions(rolesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/permissions/users/${userId}`);
      setUserPermissions(response.data);
      setSelectedUser(userId);
    } catch (error) {
      toast.error('Erro ao carregar permissões do utilizador');
    }
  };

  const saveRolePermissions = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      await api.put(`/permissions/roles/${editingRole.role}`, editingRole);
      toast.success('Permissões guardadas');
      setRolePermissions(prev => ({ ...prev, [editingRole.role]: editingRole }));
    } catch (error) {
      toast.error('Erro ao guardar permissões');
    } finally {
      setSaving(false);
    }
  };

  const saveUserPermissions = async () => {
    if (!selectedUser || !userPermissions) return;
    setSaving(true);
    try {
      await api.put(`/permissions/users/${selectedUser}`, {
        user_id: selectedUser,
        custom_menus: userPermissions.custom_menus,
        custom_actions: userPermissions.custom_actions,
        checkpoint_stages: userPermissions.checkpoint_stages || [],
        allowed_listings: userPermissions.allowed_listings || []
      });
      toast.success('Permissões do utilizador guardadas');
    } catch (error) {
      toast.error('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleRoleMenu = (menuId) => {
    if (!editingRole) return;
    const menus = editingRole.menus || [];
    if (menus.includes(menuId)) {
      setEditingRole({ ...editingRole, menus: menus.filter(m => m !== menuId) });
    } else {
      setEditingRole({ ...editingRole, menus: [...menus, menuId] });
    }
  };

  const toggleRoleAction = (actionId) => {
    if (!editingRole) return;
    const actions = editingRole.actions || [];
    if (actions.includes(actionId)) {
      setEditingRole({ ...editingRole, actions: actions.filter(a => a !== actionId) });
    } else {
      setEditingRole({ ...editingRole, actions: [...actions, actionId] });
    }
  };

  const toggleRoleStage = (stageId) => {
    if (!editingRole) return;
    const stages = editingRole.checkpoint_stages || [];
    if (stages.includes(stageId)) {
      setEditingRole({ ...editingRole, checkpoint_stages: stages.filter(s => s !== stageId) });
    } else {
      setEditingRole({ ...editingRole, checkpoint_stages: [...stages, stageId] });
    }
  };

  const toggleUserStage = (stageId) => {
    if (!userPermissions) return;
    const stages = userPermissions.checkpoint_stages || [];
    if (stages.includes(stageId)) {
      setUserPermissions({ ...userPermissions, checkpoint_stages: stages.filter(s => s !== stageId) });
    } else {
      setUserPermissions({ ...userPermissions, checkpoint_stages: [...stages, stageId] });
    }
  };

  const toggleUserListing = (listingId) => {
    if (!userPermissions) return;
    const listings = userPermissions.allowed_listings || [];
    if (listings.includes(listingId)) {
      setUserPermissions({ ...userPermissions, allowed_listings: listings.filter(l => l !== listingId) });
    } else {
      setUserPermissions({ ...userPermissions, allowed_listings: [...listings, listingId] });
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      administrador: 'Administrador',
      direcao: 'Direção',
      comercial: 'Comercial',
      producao: 'Produção',
      operador: 'Operador'
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <MainLayout title="Permissões">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Gestão de Permissões">
      <div data-testid="permissions-page" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Gestão de Permissões</h2>
              <p className="text-sm text-slate-500">Configure acessos e permissões por role e utilizador</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Por Role
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Por Utilizador
          </button>
        </div>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Role List */}
            <div className="col-span-3">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-medium text-slate-900">Roles</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {options.roles.map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        setSelectedRole(role);
                        setEditingRole({ ...rolePermissions[role] });
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between ${
                        selectedRole === role ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                      }`}
                    >
                      <span className="font-medium text-slate-700">{getRoleLabel(role)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Role Permissions */}
            <div className="col-span-9">
              {editingRole ? (
                <div className="bg-white border border-slate-200 rounded-xl">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">
                      Permissões: {getRoleLabel(editingRole.role)}
                    </h3>
                    <button
                      onClick={saveRolePermissions}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2 text-sm disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'A guardar...' : 'Guardar'}</span>
                    </button>
                  </div>

                  <div className="p-4 space-y-6">
                    {/* Menus */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
                        <List className="w-4 h-4 mr-2" />
                        Menus com Acesso
                      </h4>
                      <div className="grid grid-cols-4 gap-2">
                        {options.menus.map(menu => (
                          <label
                            key={menu.id}
                            className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              editingRole.menus?.includes(menu.id)
                                ? 'bg-purple-50 border-purple-200'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={editingRole.menus?.includes(menu.id)}
                              onChange={() => toggleRoleMenu(menu.id)}
                              className="w-4 h-4 rounded border-slate-300 text-purple-600"
                            />
                            <span className="text-sm text-slate-700">{menu.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
                        <Edit className="w-4 h-4 mr-2" />
                        Ações Permitidas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {options.actions.map(action => (
                          <label
                            key={action.id}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              editingRole.actions?.includes(action.id)
                                ? 'bg-green-50 border-green-200'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={editingRole.actions?.includes(action.id)}
                              onChange={() => toggleRoleAction(action.id)}
                              className="w-4 h-4 rounded border-slate-300 text-green-600"
                            />
                            <span className="text-sm text-slate-700">{action.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Checkpoint Stages */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Etapas para Checkpoints
                      </h4>
                      <p className="text-xs text-slate-500 mb-3">
                        Selecione em que etapas este role pode preencher checkpoints
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {options.stages.map(stage => (
                          <label
                            key={stage.id}
                            className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              editingRole.checkpoint_stages?.includes(stage.id)
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={editingRole.checkpoint_stages?.includes(stage.id)}
                              onChange={() => toggleRoleStage(stage.id)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-sm text-slate-700">{stage.nome}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Global Permissions */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        Permissões Globais
                      </h4>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingRole.can_manage_all_projects}
                            onChange={(e) => setEditingRole({ ...editingRole, can_manage_all_projects: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600"
                          />
                          <span className="text-sm text-slate-700">Pode gerir todos os projetos</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingRole.can_view_all_reports}
                            onChange={(e) => setEditingRole({ ...editingRole, can_view_all_reports: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600"
                          />
                          <span className="text-sm text-slate-700">Pode ver todos os relatórios</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingRole.can_configure_system}
                            onChange={(e) => setEditingRole({ ...editingRole, can_configure_system: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600"
                          />
                          <span className="text-sm text-slate-700">Pode configurar o sistema</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
                  <Shield className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Selecione um role para editar as permissões</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-12 gap-6">
            {/* User List */}
            <div className="col-span-4">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-medium text-slate-900">Utilizadores</h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => loadUserPermissions(user.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selectedUser === user.id ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-700">{user.nome}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          {getRoleLabel(user.role)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* User Permissions */}
            <div className="col-span-8">
              {userPermissions ? (
                <div className="bg-white border border-slate-200 rounded-xl">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{userPermissions.user_name}</h3>
                      <p className="text-xs text-slate-500">Role: {getRoleLabel(userPermissions.role)}</p>
                    </div>
                    <button
                      onClick={saveUserPermissions}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2 text-sm disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'A guardar...' : 'Guardar'}</span>
                    </button>
                  </div>

                  <div className="p-4 space-y-6">
                    {/* Current Menus (from role) */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3">
                        Menus (herdados do role)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {userPermissions.menus?.map(menuId => {
                          const menu = options.menus.find(m => m.id === menuId);
                          return menu ? (
                            <span key={menuId} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                              {menu.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>

                    {/* Checkpoint Stages (additional for this user) */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Etapas para Checkpoints (específico deste utilizador)
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {options.stages.map(stage => (
                          <label
                            key={stage.id}
                            className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              userPermissions.checkpoint_stages?.includes(stage.id)
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={userPermissions.checkpoint_stages?.includes(stage.id)}
                              onChange={() => toggleUserStage(stage.id)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-sm text-slate-700">{stage.nome}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Allowed Listings */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Listagens Permitidas
                      </h4>
                      {options.listings.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {options.listings.map(listing => (
                            <label
                              key={listing.id}
                              className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                userPermissions.allowed_listings?.includes(listing.id)
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={userPermissions.allowed_listings?.includes(listing.id)}
                                onChange={() => toggleUserListing(listing.id)}
                                className="w-4 h-4 rounded border-slate-300 text-green-600"
                              />
                              <span className="text-sm text-slate-700">{listing.nome}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Nenhuma listagem criada</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">Selecione um utilizador para editar as permissões</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Como funcionam as permissões:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li><strong>Roles:</strong> Definem as permissões base para grupos de utilizadores</li>
                <li><strong>Utilizadores:</strong> Podem ter permissões adicionais específicas</li>
                <li><strong>Etapas para Checkpoints:</strong> Definem em que etapas o utilizador pode preencher checkpoints</li>
                <li><strong>Avanço Automático:</strong> Quando todos os checkpoints obrigatórios são preenchidos, o projeto avança de etapa</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Permissions;
