'use client';

/**
 * Composant AppDetailModal
 * Modal pour afficher les details d'une application et ses logs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppConfig, Deployment } from '@/types';
import { getAppDeployments, getAppLogs, deployApp, ApiError } from '@/lib/api';

interface AppDetailModalProps {
  app: AppConfig;
  onClose: () => void;
  onUpdate: () => void;
  autoDeployOnOpen?: boolean;
}

const DEPLOYMENT_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: 'text-slate-600', label: 'En attente' },
  cloning: { color: 'text-sky-600', label: 'Clonage' },
  building: { color: 'text-violet-600', label: 'Build' },
  starting: { color: 'text-amber-600', label: 'Demarrage' },
  success: { color: 'text-emerald-600', label: 'Succes' },
  failed: { color: 'text-red-600', label: 'Echec' },
};

const LOG_LEVEL: Record<string, { bg: string; text: string }> = {
  info: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
  warn: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400' },
  success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
};

export function AppDetailModal({ app, onClose, onUpdate, autoDeployOnOpen }: AppDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'logs' | 'env'>('overview');
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [appLogs, setAppLogs] = useState<string>('');
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const hasAutoDeployed = useRef(false);

  const loadDeployments = useCallback(async () => {
    setLoadingDeployments(true);
    try {
      const data = await getAppDeployments(app.id);
      setDeployments(data);
      const active = data.find(d => ['pending', 'cloning', 'building', 'starting'].includes(d.status));
      if (active) setCurrentDeployment(active);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoadingDeployments(false);
    }
  }, [app.id]);

  const loadAppLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const logs = await getAppLogs(app.id, 200);
      setAppLogs(logs);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [app.id]);

  useEffect(() => { loadDeployments(); }, [loadDeployments]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [currentDeployment?.logs]);

  useEffect(() => {
    if (currentDeployment && ['pending', 'cloning', 'building', 'starting'].includes(currentDeployment.status)) {
      const interval = setInterval(loadDeployments, 2000);
      return () => clearInterval(interval);
    }
  }, [currentDeployment, loadDeployments]);

  useEffect(() => {
    if (autoDeployOnOpen && !hasAutoDeployed.current) {
      hasAutoDeployed.current = true;
      handleDeploy();
    }
  }, [autoDeployOnOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDeploy = async () => {
    setDeploying(true);
    setActiveTab('deployments');
    try {
      const deployment = await deployApp(app.id, true);
      setCurrentDeployment(deployment);
      await loadDeployments();
      onUpdate();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setDeploying(false);
    }
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="fixed inset-0 bg-docktor-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-docktor-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-docktor-900">{app.name}</h2>
                <p className="text-sm text-docktor-500">Port: {app.externalPort}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                app.status === 'running' ? 'bg-emerald-100 text-emerald-700' :
                app.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-docktor-100 text-docktor-600'
              }`}>{app.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDeploy} disabled={deploying || app.status === 'building'}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent-dark disabled:opacity-50">
                {deploying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>}
                {deploying ? 'Deploiement...' : 'Deployer'}
              </button>
              <button onClick={onClose} className="p-2 text-docktor-400 hover:text-docktor-600 hover:bg-docktor-50 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex gap-1 mt-4">
            {(['overview', 'deployments', 'logs', 'env'] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'logs') loadAppLogs(); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === tab ? 'bg-primary text-white' : 'text-docktor-600 hover:bg-docktor-50'}`}>
                {tab === 'overview' ? 'Apercu' : tab === 'deployments' ? 'Deploiements' : tab === 'logs' ? 'Logs' : 'Env'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[['Type', app.type], ['Port Externe', app.externalPort], ['Port Interne', app.internalPort], 
                  ['Cree le', new Date(app.createdAt).toLocaleDateString('fr-FR')]].map(([label, value]) => (
                  <div key={label} className="p-4 bg-docktor-50 rounded-xl">
                    <p className="text-sm text-docktor-500">{label}</p>
                    <p className="text-lg font-semibold text-docktor-900 mt-1">{value}</p>
                  </div>
                ))}
              </div>
              {app.gitUrl && (
                <div className="p-4 bg-docktor-50 rounded-xl">
                  <p className="text-sm text-docktor-500 mb-2">Repository Git</p>
                  <code className="text-sm text-docktor-900">{app.gitUrl}</code>
                  <span className="ml-2 px-2 py-0.5 bg-docktor-200 rounded text-xs">{app.gitBranch || 'main'}</span>
                </div>
              )}
              {app.domain && (
                <div className="p-4 bg-docktor-50 rounded-xl">
                  <p className="text-sm text-docktor-500 mb-2">Domaine</p>
                  <a href={`https://${app.domain}`} target="_blank" className="text-accent hover:underline">{app.domain}</a>
                </div>
              )}
              <div className="p-4 bg-docktor-50 rounded-xl">
                <p className="text-sm text-docktor-500 mb-2">Chemin</p>
                <code className="text-sm text-docktor-900">{app.path}</code>
              </div>
            </div>
          )}

          {activeTab === 'deployments' && (
            <div className="space-y-4">
              {currentDeployment && ['pending', 'cloning', 'building', 'starting'].includes(currentDeployment.status) && (
                <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
                    <div>
                      <p className="font-medium text-sky-900">Deploiement en cours</p>
                      <p className="text-sm text-sky-600">{DEPLOYMENT_STATUS[currentDeployment.status]?.label}</p>
                    </div>
                  </div>
                  <div className="bg-docktor-950 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm">
                    {currentDeployment.logs.map((log, i) => (
                      <div key={i} className="flex gap-2 py-0.5">
                        <span className="text-docktor-500 shrink-0">{formatTime(log.timestamp)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${LOG_LEVEL[log.level]?.bg} ${LOG_LEVEL[log.level]?.text}`}>{log.level}</span>
                        <span className="text-docktor-200">{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}
              {loadingDeployments ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-docktor-200 border-t-primary rounded-full animate-spin" /></div>
              ) : deployments.length === 0 ? (
                <div className="text-center py-8 text-docktor-500">Aucun deploiement</div>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-medium text-docktor-700">Historique</h3>
                  {deployments.map(d => (
                    <div key={d.id} className="p-4 bg-docktor-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${d.status === 'success' ? 'bg-emerald-100' : d.status === 'failed' ? 'bg-red-100' : 'bg-sky-100'}`}>
                            {d.status === 'success' ? <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> :
                             d.status === 'failed' ? <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> :
                             <div className="w-4 h-4 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />}
                          </div>
                          <div>
                            <p className={`font-medium ${DEPLOYMENT_STATUS[d.status]?.color}`}>{DEPLOYMENT_STATUS[d.status]?.label}</p>
                            <p className="text-sm text-docktor-500">{new Date(d.startedAt).toLocaleString('fr-FR')}</p>
                          </div>
                        </div>
                        {d.finishedAt && <span className="text-sm text-docktor-500">Duree: {Math.round((new Date(d.finishedAt).getTime() - new Date(d.startedAt).getTime()) / 1000)}s</span>}
                      </div>
                      {d.error && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{d.error}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-docktor-700">Logs de l'application</h3>
                <button onClick={loadAppLogs} disabled={loadingLogs} className="text-sm text-primary hover:text-primary-light font-medium">Actualiser</button>
              </div>
              {loadingLogs ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-docktor-200 border-t-primary rounded-full animate-spin" /></div>
              ) : (
                <div className="bg-docktor-950 rounded-xl p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-docktor-200 whitespace-pre-wrap">{appLogs || 'Aucun log'}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-4">
              <h3 className="font-medium text-docktor-700">Variables d'environnement</h3>
              {app.envVariables.length === 0 ? (
                <p className="text-docktor-500">Aucune variable</p>
              ) : (
                <div className="space-y-2">
                  {app.envVariables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-docktor-50 rounded-lg font-mono text-sm">
                      <span className="font-medium text-docktor-900">{v.key}</span>
                      <span className="text-docktor-400">=</span>
                      <span className="text-docktor-600">{v.isSecret ? '********' : v.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
