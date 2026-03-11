import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';

// ========== LAZY LOADING - CODE SPLITTING POR ROTA ==========
// Carrega componentes apenas quando necessário, reduzindo bundle inicial ~60%

// Página de login carregada estaticamente (entrada principal)
import Login from '@/pages/Login';

// Todas as outras páginas com lazy loading
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectForm = lazy(() => import('@/pages/ProjectForm'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Production = lazy(() => import('@/pages/Production'));
const Stages = lazy(() => import('@/pages/Stages'));
const OrderTypes = lazy(() => import('@/pages/OrderTypes'));
const Partners = lazy(() => import('@/pages/Partners'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const Checkpoints = lazy(() => import('@/pages/Checkpoints'));
const Rules = lazy(() => import('@/pages/Rules'));
const AdvancedRules = lazy(() => import('@/pages/AdvancedRules'));
const RuleExecutionLogs = lazy(() => import('@/pages/RuleExecutionLogs'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const Users = lazy(() => import('@/pages/Users'));
const CustomListings = lazy(() => import('@/pages/CustomListings'));
const Planning = lazy(() => import('@/pages/Planning'));
const Capacity = lazy(() => import('@/pages/Capacity'));
const Timeline = lazy(() => import('@/pages/Timeline'));
const Brands = lazy(() => import('@/pages/Brands'));
const ConfeccaoPlanning = lazy(() => import('@/pages/ConfeccaoPlanning'));
const ConfeccaoPerformance = lazy(() => import('@/pages/ConfeccaoPerformance'));
const Reports = lazy(() => import('@/pages/Reports'));
const Permissions = lazy(() => import('@/pages/Permissions'));
const OperatorDashboard = lazy(() => import('@/pages/OperatorDashboard'));
const ListView = lazy(() => import('@/pages/ListView'));

// Loading fallback otimizado
const PageLoader = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      <span className="text-sm text-slate-500">A carregar...</span>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/new"
            element={
              <ProtectedRoute>
                <ProjectForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/edit"
            element={
              <ProtectedRoute>
                <ProjectForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/production"
            element={
              <ProtectedRoute>
                <Production />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stages"
            element={
              <ProtectedRoute>
                <Stages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/partners"
            element={
              <ProtectedRoute>
                <Partners />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute>
                <Suppliers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order-types"
            element={
              <ProtectedRoute>
                <OrderTypes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkpoints"
            element={
              <ProtectedRoute>
                <Checkpoints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rules"
            element={
              <ProtectedRoute>
                <Rules />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <RuleExecutionLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listings"
            element={
              <ProtectedRoute>
                <CustomListings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/planning"
            element={
              <ProtectedRoute>
                <Planning />
              </ProtectedRoute>
            }
          />
          <Route
            path="/capacity"
            element={
              <ProtectedRoute>
                <Capacity />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeline"
            element={
              <ProtectedRoute>
                <Timeline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/brands"
            element={
              <ProtectedRoute>
                <Brands />
              </ProtectedRoute>
            }
          />
          <Route
            path="/confeccao-planning"
            element={
              <ProtectedRoute>
                <ConfeccaoPlanning />
              </ProtectedRoute>
            }
          />
          <Route
            path="/confeccao-performance"
            element={
              <ProtectedRoute>
                <ConfeccaoPerformance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/permissions"
            element={
              <ProtectedRoute>
                <Permissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator"
            element={
              <ProtectedRoute>
                <OperatorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/view/:viewId"
            element={
              <ProtectedRoute>
                <ListView />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
