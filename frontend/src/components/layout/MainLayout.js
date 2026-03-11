import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const MainLayout = ({ title, actions, children, onShowWizard }) => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} actions={actions} onShowWizard={onShowWizard} />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
