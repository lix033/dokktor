'use client';

/**
 * Page principale du Dashboard Docktor
 * Monitoring Docker, VPS et Deploiement d'applications
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AppConfig } from '@/types';
import {
  ContainerList,
  SystemOverview,
  SystemMetricsPanel,
  AppList,
  AppDetailModal,
} from '@/components';

/** Types de vue */
type ViewType = 'containers' | 'system' | 'apps';

export default function DashboardPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeView, setActiveView] = useState<ViewType>('containers');
  
  // Modals
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  const [autoDeployOnOpen, setAutoDeployOnOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateApp = () => {
    router.push('/apps/new');
  };

  const handleViewApp = (app: AppConfig) => {
    setSelectedApp(app);
    setAutoDeployOnOpen(false);
  };

  const handleDeployApp = (app: AppConfig) => {
    setSelectedApp(app);
    setAutoDeployOnOpen(true);
  };

  const handleAppModalClose = () => {
    setSelectedApp(null);
    setAutoDeployOnOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-docktor-50">
      {/* Header */}
      <header className="bg-primary sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo et titre */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
                <svg
                  className="w-6 h-6 text-accent"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.186.186 0 00-.185.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white tracking-tight">
                  Dokktor
                </h1>
                <p className="text-xs text-docktor-300">
                  VPS & App Management
                </p>
              </div>
            </div>

            {/* Actions header */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-docktor-300">
                <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span>Connected</span>
              </div>
              <div className="text-sm font-medium text-white bg-white/10 px-3 py-1.5 rounded-lg">
                {currentTime}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-docktor-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveView('containers')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === 'containers'
                    ? 'text-primary bg-docktor-50'
                    : 'text-docktor-500 hover:text-primary hover:bg-docktor-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Containers
                </span>
              </button>
              <button
                onClick={() => setActiveView('apps')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === 'apps'
                    ? 'text-primary bg-docktor-50'
                    : 'text-docktor-500 hover:text-primary hover:bg-docktor-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Applications
                </span>
              </button>
              <button
                onClick={() => setActiveView('system')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeView === 'system'
                    ? 'text-primary bg-docktor-50'
                    : 'text-docktor-500 hover:text-primary hover:bg-docktor-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  System
                </span>
              </button>
            </nav>

            <div className="flex items-center gap-2">
              <span className="text-xs text-docktor-400">
                Auto-refresh: 5s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <main className="flex-1 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {activeView === 'containers' && (
            <div className="space-y-6">
              {/* Apercu systeme en haut */}
              <SystemOverview />
              
              {/* Liste des containers */}
              <ContainerList />
            </div>
          )}

          {activeView === 'apps' && (
            <AppList
              onCreateApp={handleCreateApp}
              onViewApp={handleViewApp}
              onDeployApp={handleDeployApp}
            />
          )}

          {activeView === 'system' && (
            <SystemMetricsPanel />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-docktor-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-sm text-docktor-400">
              Dokktor v0.1.7
            </p>
            <p className="text-sm text-docktor-400">
              VPS Monitoring & App Deployment
            </p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedApp && (
        <AppDetailModal
          app={selectedApp}
          onClose={handleAppModalClose}
          onUpdate={() => {}}
          autoDeployOnOpen={autoDeployOnOpen}
        />
      )}
    </div>
  );
}
