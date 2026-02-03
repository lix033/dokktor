'use client';

/**
 * Composant ContainerList
 * Affiche la grille des containers avec statistiques et filtres
 */

import { useState, useEffect, useCallback } from 'react';
import type { ContainerInfo } from '@/types';
import { getContainers, ApiError } from '@/lib/api';
import { ContainerCard } from './ContainerCard';
import { LogsViewer } from './LogsViewer';

/** Intervalle de rafraichissement automatique (5 secondes) */
const REFRESH_INTERVAL = 5000;

/** Filtres disponibles */
type FilterType = 'all' | 'running' | 'stopped';

export function ContainerList() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Chargement initial et rafraichissement automatique
  useEffect(() => {
    loadContainers();
    const interval = setInterval(loadContainers, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadContainers]);

  // Statistiques
  const stats = {
    total: containers.length,
    running: containers.filter((c) => c.state === 'running').length,
    stopped: containers.filter((c) => c.state === 'exited').length,
    other: containers.filter((c) => !['running', 'exited'].includes(c.state)).length,
  };

  // Filtrage des containers
  const filteredContainers = containers.filter((container) => {
    // Filtre par etat
    if (filter === 'running' && container.state !== 'running') return false;
    if (filter === 'stopped' && container.state !== 'exited') return false;

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        container.name.toLowerCase().includes(query) ||
        container.image.toLowerCase().includes(query) ||
        container.id.toLowerCase().includes(query)
      );
    }

    return true;
  });

  /**
   * Ouvre le modal des logs
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

  // Etat de chargement initial
  if (loading && containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 border-2 border-docktor-200 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-docktor-500 font-medium">Chargement des containers...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card px-4 py-3">
            <p className="text-sm font-medium text-docktor-500">Total</p>
            <p className="text-2xl font-semibold text-docktor-900 mt-1">{stats.total}</p>
          </div>
          <div className="card px-4 py-3">
            <p className="text-sm font-medium text-docktor-500">Running</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              <p className="text-2xl font-semibold text-emerald-600">{stats.running}</p>
            </div>
          </div>
          <div className="card px-4 py-3">
            <p className="text-sm font-medium text-docktor-500">Stopped</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 bg-docktor-400 rounded-full" />
              <p className="text-2xl font-semibold text-docktor-600">{stats.stopped}</p>
            </div>
          </div>
          <div className="card px-4 py-3">
            <p className="text-sm font-medium text-docktor-500">Other</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
              <p className="text-2xl font-semibold text-amber-600">{stats.other}</p>
            </div>
          </div>
        </div>

        {/* Barre d'actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Recherche */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-docktor-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, image ou ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-docktor-200 rounded-lg text-sm placeholder-docktor-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-docktor-200 rounded-lg p-1">
              {(['all', 'running', 'stopped'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    filter === f
                      ? 'bg-primary text-white'
                      : 'text-docktor-600 hover:bg-docktor-50'
                  }`}
                >
                  {f === 'all' ? 'Tous' : f === 'running' ? 'Running' : 'Stopped'}
                </button>
              ))}
            </div>

            {/* Bouton refresh */}
            <button
              onClick={loadContainers}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light disabled:opacity-50 transition-colors"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Actualiser
            </button>
          </div>
        </div>

        {/* Derniere mise a jour */}
        {lastUpdate && (
          <p className="text-xs text-docktor-400">
            Derniere mise a jour : {lastUpdate.toLocaleTimeString('fr-FR')}
          </p>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <svg
              className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-red-800">Erreur de connexion</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Liste des containers */}
        {filteredContainers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-docktor-100">
            <svg
              className="w-16 h-16 text-docktor-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p className="mt-4 text-docktor-600 font-medium">
              {searchQuery || filter !== 'all'
                ? 'Aucun container ne correspond aux criteres'
                : 'Aucun container trouve'}
            </p>
            <p className="text-sm text-docktor-400 mt-1">
              {searchQuery || filter !== 'all'
                ? 'Essayez de modifier vos filtres'
                : 'Verifiez que Docker est en cours d\'execution'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredContainers.map((container) => (
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
        <LogsViewer container={selectedContainer} onClose={handleCloseLogs} />
      )}
    </>
  );
}
