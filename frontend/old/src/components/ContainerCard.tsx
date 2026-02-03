'use client';

/**
 * Composant ContainerCard
 * Affiche les informations d'un container avec les boutons d'action
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
 * Retourne la couleur associée à l'état du container
 */
function getStateColor(state: ContainerState): string {
  const colors: Record<ContainerState, string> = {
    running: 'bg-green-500',
    exited: 'bg-gray-500',
    paused: 'bg-yellow-500',
    restarting: 'bg-blue-500',
    dead: 'bg-red-500',
    created: 'bg-purple-500',
  };
  return colors[state] || 'bg-gray-500';
}

/**
 * Retourne la couleur et l'icône associées à l'état de santé
 */
function getHealthInfo(health: HealthStatus): { color: string; icon: string; label: string } {
  const info: Record<HealthStatus, { color: string; icon: string; label: string }> = {
    healthy: { color: 'text-green-600', icon: '✓', label: 'Healthy' },
    unhealthy: { color: 'text-red-600', icon: '✗', label: 'Unhealthy' },
    starting: { color: 'text-yellow-600', icon: '⟳', label: 'Starting' },
    none: { color: 'text-gray-400', icon: '−', label: 'No healthcheck' },
  };
  return info[health] || info.none;
}

export function ContainerCard({ container, onActionComplete, onShowLogs }: ContainerCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isRunning = container.state === 'running';
  const healthInfo = getHealthInfo(container.health);

  /**
   * Exécute une action sur le container
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
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header avec nom et état */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 truncate" title={container.name}>
            {container.name}
          </h3>
          <div className="flex items-center gap-2">
            {/* Badge état */}
            <span
              className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStateColor(
                container.state
              )}`}
            >
              {container.state}
            </span>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="p-4 space-y-3">
        {/* Image */}
        <div className="flex items-start gap-2">
          <span className="text-gray-500 text-sm font-medium w-16">Image:</span>
          <span className="text-gray-900 text-sm truncate flex-1" title={container.image}>
            {container.image}
          </span>
        </div>

        {/* ID */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm font-medium w-16">ID:</span>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
            {container.id}
          </code>
        </div>

        {/* Status */}
        <div className="flex items-start gap-2">
          <span className="text-gray-500 text-sm font-medium w-16">Status:</span>
          <span className="text-gray-700 text-sm">{container.status}</span>
        </div>

        {/* Health */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm font-medium w-16">Health:</span>
          <span className={`text-sm font-medium ${healthInfo.color}`}>
            {healthInfo.icon} {healthInfo.label}
          </span>
        </div>

        {/* Ports */}
        {container.ports.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-gray-500 text-sm font-medium w-16">Ports:</span>
            <div className="flex flex-wrap gap-1">
              {container.ports.map((port, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
                >
                  {port.publicPort ? `${port.publicPort}:` : ''}
                  {port.privatePort}/{port.type}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-2 rounded border border-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        {/* Bouton Logs - toujours visible */}
        <button
          onClick={() => onShowLogs(container)}
          className="px-3 py-2 bg-gray-700 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          title="Voir les logs"
        >
          Logs
        </button>

        {isRunning ? (
          <>
            <button
              onClick={() => handleAction('stop', stopContainer)}
              disabled={loading !== null}
              className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'stop' ? 'Arrêt...' : 'Arrêter'}
            </button>
            <button
              onClick={() => handleAction('restart', restartContainer)}
              disabled={loading !== null}
              className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'restart' ? 'Redémarrage...' : 'Redémarrer'}
            </button>
          </>
        ) : (
          <button
            onClick={() => handleAction('start', startContainer)}
            disabled={loading !== null}
            className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading === 'start' ? 'Démarrage...' : 'Démarrer'}
          </button>
        )}
      </div>
    </div>
  );
}
