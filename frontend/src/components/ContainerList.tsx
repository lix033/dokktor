'use client';

/**
 * Composant ContainerList
 * Affiche la grille des containers avec auto-refresh
 */

import { useState, useEffect, useCallback } from 'react';
import type { ContainerInfo } from '@/types';
import { getContainers, ApiError } from '@/lib/api';
import { ContainerCard } from './ContainerCard';
import { LogsViewer } from './LogsViewer';

/** Intervalle de rafraîchissement automatique (5 secondes) */
const REFRESH_INTERVAL = 5000;

export function ContainerList() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);

  /**
   * Charge la liste des containers
   */
  const loadContainers = useCallback(async () => {
    try {
      const data = await getContainers();
      setContainers(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Impossible de charger les containers');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Chargement initial et rafraîchissement automatique
  useEffect(() => {
    loadContainers();

    const interval = setInterval(loadContainers, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [loadContainers]);

  // Statistiques
  const runningCount = containers.filter((c) => c.state === 'running').length;
  const stoppedCount = containers.filter((c) => c.state === 'exited').length;

  /**
   * Ouvre le modal des logs pour un container
   */
  const handleShowLogs = (container: ContainerInfo) => {
    setSelectedContainer(container);
  };

  /**
   * Ferme le modal des logs
   */
  const handleCloseLogs = () => {
    setSelectedContainer(null);
  };

  if (loading && containers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-docker-blue mx-auto" />
          <p className="mt-4 text-gray-600">Chargement des containers...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* En-tête avec statistiques */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm text-gray-600">
                {runningCount} running
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-gray-500 rounded-full" />
              <span className="text-sm text-gray-600">
                {stoppedCount} stopped
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={loadContainers}
              className="px-4 py-2 bg-docker-blue text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors"
            >
              ↻ Actualiser
            </button>
          </div>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            <p className="font-medium">Erreur</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Liste des containers */}
        {containers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Aucun container trouvé</p>
            <p className="text-sm text-gray-400 mt-1">
              Vérifiez que Docker est en cours d'exécution
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {containers.map((container) => (
              <ContainerCard
                key={container.id}
                container={container}
                onActionComplete={loadContainers}
                onShowLogs={handleShowLogs}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal des logs */}
      {selectedContainer && (
        <LogsViewer
          container={selectedContainer}
          onClose={handleCloseLogs}
        />
      )}
    </>
  );
}
