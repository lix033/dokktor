'use client';

/**
 * Composant AppList
 * Affiche la liste des applications deployees
 */

import { useState, useEffect, useCallback } from 'react';
import type { AppConfig, AppStatus } from '@/types';
import { getApps, deleteApp, stopAppService, startAppService, restartAppService, ApiError } from '@/lib/api';

interface AppListProps {
  onCreateApp: () => void;
  onViewApp: (app: AppConfig) => void;
  onDeployApp: (app: AppConfig) => void;
}

/** Configuration des statuts */
const STATUS_CONFIG: Record<AppStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', label: 'En attente' },
  building: { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500', label: 'Build en cours' },
  deploying: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Deploiement' },
  running: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'En ligne' },
  stopped: { bg: 'bg-docktor-100', text: 'text-docktor-600', dot: 'bg-docktor-400', label: 'Arrete' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Echec' },
  error: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Erreur' },
};

/** Configuration des types d'applications */
const APP_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  php: { icon: 'PHP', color: 'bg-indigo-100 text-indigo-700' },
  laravel: { icon: 'Laravel', color: 'bg-red-100 text-red-700' },
  nodejs: { icon: 'Node', color: 'bg-green-100 text-green-700' },
  'nodejs-typescript': { icon: 'TS', color: 'bg-blue-100 text-blue-700' },
  nextjs: { icon: 'Next', color: 'bg-slate-100 text-slate-700' },
  static: { icon: 'HTML', color: 'bg-orange-100 text-orange-700' },
  python: { icon: 'PY', color: 'bg-yellow-100 text-yellow-700' },
  custom: { icon: 'Custom', color: 'bg-purple-100 text-purple-700' },
};

export function AppList({ onCreateApp, onViewApp, onDeployApp }: AppListProps) {
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await getApps();
      setApps(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Impossible de charger les applications');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApps();
    const interval = setInterval(loadApps, 10000);
    return () => clearInterval(interval);
  }, [loadApps]);

  const handleAction = async (
    appId: string,
    action: 'stop' | 'start' | 'restart' | 'delete',
    actionFn: (id: string) => Promise<void>
  ) => {
    if (action === 'delete' && !confirm('Etes-vous sur de vouloir supprimer cette application ?')) {
      return;
    }

    setActionLoading(`${appId}-${action}`);
    try {
      await actionFn(appId);
      await loadApps();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erreur lors de l\'action');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && apps.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 border-2 border-docktor-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-docktor-900">Applications</h2>
          <p className="text-sm text-docktor-500 mt-1">
            {apps.length} application{apps.length !== 1 ? 's' : ''} deployee{apps.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreateApp}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle Application
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Liste vide */}
      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-docktor-100">
          <div className="w-16 h-16 bg-docktor-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-docktor-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="mt-4 text-docktor-600 font-medium">Aucune application</p>
          <p className="text-sm text-docktor-400 mt-1">Creez votre premiere application pour commencer</p>
          <button
            onClick={onCreateApp}
            className="mt-6 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-light transition-colors"
          >
            Creer une application
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {apps.map((app) => {
            const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
            const typeConfig = APP_TYPE_CONFIG[app.type] || APP_TYPE_CONFIG.custom;
            const isRunning = app.status === 'running';

            return (
              <div
                key={app.id}
                className="card overflow-hidden hover:shadow-soft transition-shadow"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-docktor-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${typeConfig.color}`}>
                        {typeConfig.icon}
                      </span>
                      <div>
                        <h3 className="font-semibold text-docktor-900">{app.name}</h3>
                        <p className="text-xs text-docktor-500 mt-0.5">
                          Port: {app.externalPort}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bg}`}>
                      <span className={`w-2 h-2 rounded-full ${statusConfig.dot} ${isRunning ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs font-medium ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-2">
                  {app.domain && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-docktor-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="text-docktor-600">{app.domain}</span>
                    </div>
                  )}
                  
                  {app.gitUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-docktor-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <span className="text-docktor-600 truncate text-xs">{app.gitUrl}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-docktor-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Cree le {new Date(app.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 bg-docktor-50/50 border-t border-docktor-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewApp(app)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-docktor-700 bg-white border border-docktor-200 rounded-lg hover:bg-docktor-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Details
                    </button>

                    <button
                      onClick={() => onDeployApp(app)}
                      disabled={app.status === 'building' || app.status === 'deploying'}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-dark disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Deploy
                    </button>

                    {/* Menu actions supplementaires */}
                    <div className="relative">
                      <button
                        className="p-2 text-docktor-500 hover:text-docktor-700 hover:bg-white rounded-lg transition-colors"
                        onClick={(e) => {
                          const menu = e.currentTarget.nextElementSibling;
                          menu?.classList.toggle('hidden');
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      <div className="hidden absolute right-0 bottom-full mb-2 w-40 bg-white border border-docktor-200 rounded-lg shadow-lg py-1 z-10">
                        {isRunning ? (
                          <>
                            <button
                              onClick={() => handleAction(app.id, 'stop', stopAppService)}
                              disabled={actionLoading === `${app.id}-stop`}
                              className="w-full px-4 py-2 text-left text-sm text-docktor-700 hover:bg-docktor-50 disabled:opacity-50"
                            >
                              Arreter
                            </button>
                            <button
                              onClick={() => handleAction(app.id, 'restart', restartAppService)}
                              disabled={actionLoading === `${app.id}-restart`}
                              className="w-full px-4 py-2 text-left text-sm text-docktor-700 hover:bg-docktor-50 disabled:opacity-50"
                            >
                              Redemarrer
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleAction(app.id, 'start', startAppService)}
                            disabled={actionLoading === `${app.id}-start`}
                            className="w-full px-4 py-2 text-left text-sm text-docktor-700 hover:bg-docktor-50 disabled:opacity-50"
                          >
                            Demarrer
                          </button>
                        )}
                        <hr className="my-1 border-docktor-100" />
                        <button
                          onClick={() => handleAction(app.id, 'delete', deleteApp)}
                          disabled={actionLoading === `${app.id}-delete`}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
