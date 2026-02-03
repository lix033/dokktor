'use client';

/**
 * Composant ContainerCard
 * Affiche les informations d'un container avec un design moderne
 */

import { useState } from 'react';
import type { ContainerInfo, ContainerState, HealthStatus } from '@/types';
import { stopContainer, restartContainer, startContainer, ApiError } from '@/lib/api';

interface ContainerCardProps {
  container: ContainerInfo;
  onActionComplete: () => void;
  onShowLogs: (container: ContainerInfo) => void;
}

/**
 * Configuration des etats de container
 */
const STATE_CONFIG: Record<ContainerState, { bg: string; text: string; dot: string }> = {
  running: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  exited: { bg: 'bg-docktor-100', text: 'text-docktor-600', dot: 'bg-docktor-400' },
  paused: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  restarting: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  dead: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  created: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
};

/**
 * Configuration des etats de sante
 */
const HEALTH_CONFIG: Record<HealthStatus, { icon: string; color: string; label: string }> = {
  healthy: { icon: 'check', color: 'text-emerald-600', label: 'Healthy' },
  unhealthy: { icon: 'x', color: 'text-red-600', label: 'Unhealthy' },
  starting: { icon: 'refresh', color: 'text-amber-600', label: 'Starting' },
  none: { icon: 'minus', color: 'text-docktor-400', label: 'No check' },
};

/**
 * Icone de verification
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Icone X
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Icone Minus
 */
function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Icone Refresh
 */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Composant d'icone de sante
 */
function HealthIcon({ health }: { health: HealthStatus }) {
  const config = HEALTH_CONFIG[health];
  const iconClass = `w-4 h-4 ${config.color}`;
  
  switch (config.icon) {
    case 'check': return <CheckIcon className={iconClass} />;
    case 'x': return <XIcon className={iconClass} />;
    case 'refresh': return <RefreshIcon className={`${iconClass} animate-spin`} />;
    default: return <MinusIcon className={iconClass} />;
  }
}

export function ContainerCard({ container, onActionComplete, onShowLogs }: ContainerCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isRunning = container.state === 'running';
  const stateConfig = STATE_CONFIG[container.state] || STATE_CONFIG.exited;
  const healthConfig = HEALTH_CONFIG[container.health];

  /**
   * Execute une action sur le container
   */
  async function handleAction(
    action: 'stop' | 'restart' | 'start',
    actionFn: (id: string) => Promise<unknown>
  ) {
    setLoading(action);
    setError(null);

    try {
      await actionFn(container.id);
      onActionComplete();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Une erreur inattendue est survenue');
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-docktor-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-docktor-900 truncate" title={container.name}>
              {container.name}
            </h3>
            <p className="text-sm text-docktor-500 truncate mt-0.5" title={container.image}>
              {container.image}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${stateConfig.bg}`}>
            <span className={`w-2 h-2 rounded-full ${stateConfig.dot} ${isRunning ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-medium capitalize ${stateConfig.text}`}>
              {container.state}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* ID et Health */}
        <div className="flex items-center justify-between">
          <code className="text-xs font-mono bg-docktor-50 text-docktor-600 px-2 py-1 rounded">
            {container.id}
          </code>
          <div className="flex items-center gap-1.5">
            <HealthIcon health={container.health} />
            <span className={`text-xs font-medium ${healthConfig.color}`}>
              {healthConfig.label}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-docktor-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-docktor-600">{container.status}</span>
        </div>

        {/* Ports */}
        {container.ports.length > 0 && (
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-docktor-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <div className="flex flex-wrap gap-1.5">
              {container.ports.map((port, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center text-xs bg-accent/10 text-accent-dark px-2 py-0.5 rounded font-mono"
                >
                  {port.publicPort ? `${port.publicPort}:` : ''}
                  {port.privatePort}
                  <span className="text-accent/60 ml-1">/{port.type}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-docktor-50/50 border-t border-docktor-100">
        <div className="flex items-center gap-2">
          {/* Bouton Logs */}
          <button
            onClick={() => onShowLogs(container)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-docktor-700 bg-white border border-docktor-200 rounded-lg hover:bg-docktor-50 hover:border-docktor-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Logs
          </button>

          {/* Actions container */}
          <div className="flex-1 flex items-center justify-end gap-2">
            {isRunning ? (
              <>
                <button
                  onClick={() => handleAction('stop', stopContainer)}
                  disabled={loading !== null}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading === 'stop' ? (
                    <RefreshIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                  )}
                  Stop
                </button>
                <button
                  onClick={() => handleAction('restart', restartContainer)}
                  disabled={loading !== null}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading === 'restart' ? (
                    <RefreshIcon className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshIcon className="w-4 h-4" />
                  )}
                  Restart
                </button>
              </>
            ) : (
              <button
                onClick={() => handleAction('start', startContainer)}
                disabled={loading !== null}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading === 'start' ? (
                  <RefreshIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
                Start
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
