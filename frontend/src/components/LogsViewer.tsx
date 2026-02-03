'use client';

/**
 * Composant LogsViewer
 * Modal pour afficher les logs d'un container avec streaming en temps reel
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ContainerInfo, LogEntry } from '@/types';
import { getContainerLogs, streamContainerLogs } from '@/lib/api';

interface LogsViewerProps {
  container: ContainerInfo;
  onClose: () => void;
}

/** Options de rafraichissement */
const REFRESH_OPTIONS = [
  { label: 'Manuel', value: 0 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: 'Live', value: -1 },
];

/** Nombre de lignes a afficher */
const TAIL_OPTIONS = [50, 100, 200, 500, 1000];

/** Limite max de logs en memoire pour le mode live */
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
   * Demarre le streaming SSE
   */
  const startStreaming = useCallback(() => {
    if (closeStreamRef.current) {
      closeStreamRef.current();
    }

    setIsStreaming(true);
    setError(null);

    closeStreamRef.current = streamContainerLogs(
      container.id,
      { tail: 50, stdout: showStdout, stderr: showStderr },
      {
        onLog: (log) => {
          setLogs((prev) => {
            const newLogs = [...prev, log];
            if (newLogs.length > MAX_LOGS_IN_MEMORY) {
              return newLogs.slice(-MAX_LOGS_IN_MEMORY);
            }
            return newLogs;
          });
        },
        onConnected: () => setError(null),
        onError: (err) => {
          setError(err);
          setIsStreaming(false);
        },
        onDisconnected: () => setIsStreaming(false),
      }
    );
  }, [container.id, showStdout, showStderr]);

  /**
   * Arrete le streaming
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

  // Gestion du rafraichissement automatique
  useEffect(() => {
    if (refreshInterval === -1) {
      startStreaming();
      return () => stopStreaming();
    }
    stopStreaming();
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (closeStreamRef.current) closeStreamRef.current();
    };
  }, []);

  // Fermeture avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  /**
   * Filtre les logs selon la recherche
   */
  const filteredLogs = logs.filter((log) => {
    if (searchTerm === '') return true;
    return log.message.toLowerCase().includes(searchTerm.toLowerCase());
  });

  /**
   * Formate le timestamp
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp.substring(11, 19);
    }
  };

  /**
   * Telecharge les logs
   */
  const downloadLogs = () => {
    const content = logs
      .map((log) => `[${log.timestamp}] [${log.stream}] ${log.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${container.name}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Efface les logs affiches
   */
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="fixed inset-0 bg-docktor-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-primary flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{container.name}</h2>
              <p className="text-sm text-docktor-300">Container Logs</p>
            </div>
            {isStreaming && (
              <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-full">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-docktor-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-docktor-50 border-b border-docktor-100 flex flex-wrap items-center gap-4">
          {/* Mode de rafraichissement */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-docktor-600">Mode :</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border border-docktor-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {REFRESH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Nombre de lignes */}
          {refreshInterval !== -1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-docktor-600">Lignes :</label>
              <select
                value={tail}
                onChange={(e) => setTail(Number(e.target.value))}
                className="text-sm border border-docktor-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {TAIL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filtres */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showStdout}
                onChange={(e) => setShowStdout(e.target.checked)}
                className="w-4 h-4 rounded border-docktor-300 text-primary focus:ring-primary/20"
              />
              <span className="text-sm font-medium text-emerald-600">stdout</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showStderr}
                onChange={(e) => setShowStderr(e.target.checked)}
                className="w-4 h-4 rounded border-docktor-300 text-primary focus:ring-primary/20"
              />
              <span className="text-sm font-medium text-red-600">stderr</span>
            </label>
          </div>

          {/* Recherche */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-docktor-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-docktor-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-4 h-4 rounded border-docktor-300 text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-docktor-600">Auto-scroll</span>
            </label>
            <button
              onClick={loadLogs}
              disabled={loading || isStreaming}
              className="px-3 py-1.5 text-sm font-medium text-docktor-700 bg-white border border-docktor-200 rounded-lg hover:bg-docktor-50 disabled:opacity-50 transition-colors"
            >
              Actualiser
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1.5 text-sm font-medium text-docktor-700 bg-white border border-docktor-200 rounded-lg hover:bg-docktor-50 transition-colors"
            >
              Effacer
            </button>
            <button
              onClick={downloadLogs}
              className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-light transition-colors"
            >
              Telecharger
            </button>
          </div>
        </div>

        {/* Logs */}
        <div
          ref={logsContainerRef}
          className="flex-1 overflow-auto bg-docktor-950 font-mono text-sm"
        >
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-docktor-400">
              <div className="w-8 h-8 border-2 border-docktor-700 border-t-docktor-400 rounded-full animate-spin" />
              <p className="mt-4">Chargement des logs...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-400">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="mt-4 font-medium">{error}</p>
              <button
                onClick={loadLogs}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reessayer
              </button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-docktor-500">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4">{searchTerm ? 'Aucun resultat' : 'Aucun log disponible'}</p>
            </div>
          ) : (
            <div className="p-4 space-y-0.5">
              {filteredLogs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className="flex gap-3 py-1 px-2 rounded hover:bg-docktor-900/50 group"
                >
                  <span className="text-docktor-500 shrink-0 select-none">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span
                    className={`shrink-0 w-12 text-xs font-medium ${
                      log.stream === 'stderr' ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {log.stream}
                  </span>
                  <span className="text-docktor-200 break-all whitespace-pre-wrap">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-docktor-900 text-docktor-400 text-xs flex items-center justify-between">
          <span>
            {filteredLogs.length} ligne{filteredLogs.length !== 1 ? 's' : ''}
            {searchTerm && ` (filtre sur ${logs.length})`}
          </span>
          <span>
            ID: {container.id}
          </span>
        </div>
      </div>
    </div>
  );
}
