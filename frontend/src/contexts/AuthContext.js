import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/users/me`);
      setUser(response.data);
      // Fetch permissions
      await fetchPermissions();
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await axios.get(`${API}/permissions/my-permissions`);
      setPermissions(response.data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      // Set default minimal permissions on error
      setPermissions({
        menus: ['dashboard'],
        actions: ['view'],
        can_manage_all_projects: false,
        can_view_all_reports: false,
        can_configure_system: false
      });
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
    // Fetch permissions after login
    try {
      const permResponse = await axios.get(`${API}/permissions/my-permissions`);
      setPermissions(permResponse.data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setPermissions(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const completeSetup = async () => {
    try {
      await axios.post(`${API}/users/complete-setup`);
      setUser(prev => ({ ...prev, setup_completed: true }));
    } catch (error) {
      console.error('Failed to complete setup:', error);
    }
  };

  // Permission helpers
  const hasMenu = (menuId) => {
    if (!permissions) return false;
    if (user?.role === 'administrador') return true;
    return permissions.menus?.includes(menuId);
  };

  const hasAction = (actionId) => {
    if (!permissions) return false;
    if (user?.role === 'administrador') return true;
    return permissions.actions?.includes(actionId);
  };

  const canManageAllProjects = () => {
    if (!permissions) return false;
    if (user?.role === 'administrador') return true;
    return permissions.can_manage_all_projects;
  };

  const canConfigureSystem = () => {
    if (!permissions) return false;
    if (user?.role === 'administrador') return true;
    return permissions.can_configure_system;
  };

  const value = {
    user,
    token,
    loading,
    permissions,
    login,
    logout,
    completeSetup,
    isAuthenticated: !!token && !!user,
    // Permission helpers
    hasMenu,
    hasAction,
    canManageAllProjects,
    canConfigureSystem,
    refreshPermissions: fetchPermissions
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
