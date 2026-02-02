'use client';

/**
 * Composant LogsViewer
 * Modal pour afficher les logs d'un container avec streaming en temps réel
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ContainerInfo, LogEntry } from '@/types';
import { getContainerLogs, streamContainerLogs } from '@/lib/api';

interface LogsViewerProps {
  container: ContainerInfo;
  onClose: () => void;
}

/** Options de rafraîchissement */
const REFRESH_OPTIONS = [
  { label: 'Manuel', value: 0 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: 'Live (SSE)', value: -1 },
];

/** Nombre de lignes à afficher */
const TAIL_OPTIONS = [50, 100, 200, 500, 1000];

/** Limite max de logs en mémoire pour le mode live */
const MAX_LOGS_IN_MEMORY = 2000;

export function LogsViewer({ container, onClose }: LogsViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [tail, setTail] = useState(100);
  const [showStdout, setShowStdout] = useState(true);
  const [showStderr, setShowStderr] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const closeStreamRef = useRef<(() => void) | null>(null);

  /**
   * Charge les logs depuis l'API
   */
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getContainerLogs(container.id, {
        tail,
        stdout: showStdout,
        stderr: showStderr,
      });
      setLogs(response.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [container.id, tail, showStdout, showStderr]);

  /**
   * Démarre le streaming SSE
   */
  const startStreaming = useCallback(() => {
    // Ferme le stream existant
    if (closeStreamRef.current) {
      closeStreamRef.current();
    }

    setIsStreaming(true);
    setError(null);

    closeStreamRef.current = streamContainerLogs(
      container.id,
      {
        tail: 50,
        stdout: showStdout,
        stderr: showStderr,
      },
      {
        onLog: (log) => {
          setLogs((prev) => {
            const newLogs = [...prev, log];
            // Limite le nombre de logs en mémoire
            if (newLogs.length > MAX_LOGS_IN_MEMORY) {
              return newLogs.slice(-MAX_LOGS_IN_MEMORY);
            }
            return newLogs;
          });
        },
        onConnected: () => {
          setError(null);
        },
        onError: (err) => {
          setError(err);
          setIsStreaming(false);
        },
        onDisconnected: () => {
          setIsStreaming(false);
        },
      }
    );
  }, [container.id, showStdout, showStderr]);

  /**
   * Arrête le streaming
   */
  const stopStreaming = useCallback(() => {
    if (closeStreamRef.current) {
      closeStreamRef.current();
      closeStreamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Chargement initial
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Gestion du rafraîchissement automatique
  useEffect(() => {
    // Mode streaming
    if (refreshInterval === -1) {
      startStreaming();
      return () => stopStreaming();
    }

    // Arrête le streaming si on change de mode
    stopStreaming();

    // Mode polling
    if (refreshInterval > 0) {
      const interval = setInterval(loadLogs, refreshInterval);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [refreshInterval, startStreaming, stopStreaming, loadLogs]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Cleanup à la fermeture
  useEffect(() => {
    return () => {
      if (closeStreamRef.current) {
        closeStreamRef.current();
      }
    };
  }, []);

  /**
   * Filtre les logs selon la recherche
   */
  const filteredLogs = logs.filter((log) => {
    if (searchTerm === '') return true;
    return log.message.toLowerCase().includes(searchTerm.toLowerCase());
  });

  /**
   * Formate le timestamp pour l'affichage
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
    } catch {
      return timestamp.substring(11, 23); // Fallback: extrait HH:MM:SS.mmm
    }
  };

  /**
   * Télécharge les logs en fichier texte
   */
  const downloadLogs = () => {
    const content = logs
      .map((log) => `[${log.timestamp}] [${log.stream}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${container.name}-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-800 text-white rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div>
              <h2 className="font-semibold">{container.name}</h2>
              <p className="text-xs text-gray-400">Logs du container</p>
            </div>
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs bg-green-600 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 bg-gray-100 border-b flex flex-wrap items-center gap-3">
          {/* Rafraîchissement */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Rafraîchissement:</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1 bg-white"
            >
              {REFRESH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Nombre de lignes (désactivé en mode live) */}
          {refreshInterval !== -1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Lignes:</label>
              <select
                value={tail}
                onChange={(e) => setTail(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1 bg-white"
              >
                {TAIL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtres stdout/stderr */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={showStdout}
                onChange={(e) => setShowStdout(e.target.checked)}
                className="rounded"
              />
              <span className="text-green-700">stdout</span>
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={showStderr}
                onChange={(e) => setShowStderr(e.target.checked)}
                className="rounded"
              />
              <span className="text-red-700">stderr</span>
            </label>
          </div>

          {/* Recherche */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Rechercher dans les logs..."
              className="w-full text-sm border rounded px-3 py-1"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
            <button
              onClick={loadLogs}
              disabled={loading || isStreaming}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              ↻ Actualiser
            </button>
            <button
              onClick={downloadLogs}
              className="text-sm px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ⬇ Télécharger
            </button>
          </div>
        </div>

        {/* Logs container */}
        <div
          ref={logsContainerRef}
          className="flex-1 overflow-auto bg-gray-900 font-mono text-sm"
        >
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
                <p className="mt-2">Chargement des logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400">
              <div className="text-center">
                <p className="text-xl mb-2">⚠️</p>
                <p>{error}</p>
                <button
                  onClick={loadLogs}
                  className="mt-2 px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Réessayer
                </button>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>{searchTerm ? 'Aucun résultat' : 'Aucun log disponible'}</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredLogs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={`flex gap-2 py-0.5 hover:bg-gray-800 ${
                    log.stream === 'stderr' ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  <span className="text-gray-500 select-none shrink-0">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span
                    className={`shrink-0 w-14 text-xs ${
                      log.stream === 'stderr'
                        ? 'text-red-500'
                        : 'text-green-500'
                    }`}
                  >
                    [{log.stream}]
                  </span>
                  <span className="text-gray-200 break-all whitespace-pre-wrap">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer avec stats */}
        <div className="px-4 py-2 bg-gray-800 text-gray-400 text-xs flex items-center justify-between rounded-b-lg">
          <span>
            {filteredLogs.length} ligne{filteredLogs.length > 1 ? 's' : ''}
            {searchTerm && ` (filtré de ${logs.length})`}
          </span>
          <span>
            Container: {container.id} • État: {container.state}
          </span>
        </div>
      </div>
    </div>
  );
}
