'use client';

/**
 * Composant SystemOverview
 * Affiche un apercu des metriques du serveur VPS
 */

import { useState, useEffect, useCallback } from 'react';
import type { SystemOverview as SystemOverviewType } from '@/types';
import { getSystemOverview, ApiError } from '@/lib/api';

/** Intervalle de rafraichissement (5 secondes) */
const REFRESH_INTERVAL = 5000;

/**
 * Formate les bytes en unite lisible
 */
function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Formate l'uptime en format lisible
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}j ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Composant de jauge circulaire
 */
function CircularGauge({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  color,
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min((value / max) * 100, 100);
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-docktor-100"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-docktor-900">
            {Math.round(percent)}%
          </span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-docktor-700">{label}</span>
      {sublabel && (
        <span className="text-xs text-docktor-500">{sublabel}</span>
      )}
    </div>
  );
}

/**
 * Composant de metrique simple
 */
function MetricCard({
  icon,
  label,
  value,
  sublabel,
  color = 'text-docktor-900',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-docktor-100 text-docktor-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-docktor-500">{label}</p>
        <p className={`text-lg font-semibold ${color}`}>{value}</p>
        {sublabel && <p className="text-xs text-docktor-400">{sublabel}</p>}
      </div>
    </div>
  );
}

export function SystemOverview() {
  const [data, setData] = useState<SystemOverviewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const overview = await getSystemOverview();
      setData(overview);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Impossible de charger les metriques');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-docktor-200 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 text-red-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Determination des couleurs selon les seuils
  const getCpuColor = (usage: number) => {
    if (usage >= 90) return '#ef4444';
    if (usage >= 70) return '#f59e0b';
    return '#10b981';
  };

  const getMemoryColor = (usage: number) => {
    if (usage >= 90) return '#ef4444';
    if (usage >= 70) return '#f59e0b';
    return '#10b981';
  };

  const getDiskColor = (usage: number) => {
    if (usage >= 90) return '#ef4444';
    if (usage >= 80) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-docktor-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-docktor-900">
              {data.hostname}
            </h2>
            <p className="text-sm text-docktor-500">{data.platform}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Online</span>
          </div>
        </div>
      </div>

      {/* Jauges principales */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-3 gap-8">
          <CircularGauge
            value={data.cpu.usage}
            color={getCpuColor(data.cpu.usage)}
            label="CPU"
            sublabel={`${data.cpu.cores} cores`}
          />
          <CircularGauge
            value={data.memory.usedPercent}
            color={getMemoryColor(data.memory.usedPercent)}
            label="Memoire"
            sublabel={`${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}`}
          />
          <CircularGauge
            value={data.disk.usedPercent}
            color={getDiskColor(data.disk.usedPercent)}
            label="Disque"
            sublabel={`${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)}`}
          />
        </div>
      </div>

      {/* Metriques supplementaires */}
      <div className="px-6 py-4 bg-docktor-50/50 border-t border-docktor-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Uptime */}
          <MetricCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Uptime"
            value={formatUptime(data.uptime)}
          />

          {/* Load Average */}
          <MetricCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            label="Load Average"
            value={data.cpu.loadAverage[0].toFixed(2)}
            sublabel={`${data.cpu.loadAverage[1].toFixed(2)} / ${data.cpu.loadAverage[2].toFixed(2)}`}
          />

          {/* Network RX */}
          <MetricCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
            label="Network RX"
            value={formatBytes(data.network.rxBytes)}
            color="text-emerald-600"
          />

          {/* Network TX */}
          <MetricCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            }
            label="Network TX"
            value={formatBytes(data.network.txBytes)}
            color="text-sky-600"
          />
        </div>
      </div>

      {/* Docker Stats */}
      {data.docker && (
        <div className="px-6 py-4 border-t border-docktor-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 text-accent">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186h-2.12a.186.186 0 00-.185.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-docktor-900">Docker</p>
                <p className="text-xs text-docktor-500">
                  {data.docker.images} images
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-semibold text-emerald-600">
                  {data.docker.containersRunning}
                </p>
                <p className="text-xs text-docktor-500">Running</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-docktor-400">
                  {data.docker.containers - data.docker.containersRunning}
                </p>
                <p className="text-xs text-docktor-500">Stopped</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
