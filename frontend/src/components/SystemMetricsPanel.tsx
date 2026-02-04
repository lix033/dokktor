'use client';

/**
 * Composant SystemMetricsPanel
 * Panneau detaille des metriques systeme
 */

import { useState, useEffect, useCallback } from 'react';
import type { SystemMetrics, ProcessInfo } from '@/types';
import { getSystemMetrics, getProcesses, ApiError } from '@/lib/api';

/** Intervalle de rafraichissement (3 secondes) */
const REFRESH_INTERVAL = 3000;

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
 * Barre de progression
 */
function ProgressBar({
  value,
  max = 100,
  color = 'bg-primary',
  showLabel = true,
  height = 'h-2',
}: {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  height?: string;
}) {
  const percent = Math.min((value / max) * 100, 100);

  return (
    <div className="w-full">
      <div className={`w-full ${height} bg-docktor-100 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-docktor-500">
          <span>{value.toFixed(1)}%</span>
          <span>{max}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Section CPU
 */
function CpuSection({ data }: { data: SystemMetrics['cpu'] }) {
  const getBarColor = (value: number) => {
    if (value >= 90) return 'bg-red-500';
    if (value >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-docktor-900">CPU</h3>
        <span className="text-2xl font-bold text-docktor-900">
          {data.usage.overall.toFixed(1)}%
        </span>
      </div>

      {/* Info CPU */}
      <div className="mb-4 p-3 bg-docktor-50 rounded-lg">
        <p className="text-sm font-medium text-docktor-700">
          {data.info.manufacturer} {data.info.brand}
        </p>
        <p className="text-xs text-docktor-500 mt-1">
          {data.info.cores} cores ({data.info.physicalCores} physical) @ {data.info.speed} GHz
        </p>
      </div>

      {/* Barre globale */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-docktor-500 mb-1">
          <span>Overall</span>
          <span>{data.usage.overall.toFixed(1)}%</span>
        </div>
        <ProgressBar
          value={data.usage.overall}
          color={getBarColor(data.usage.overall)}
          showLabel={false}
          height="h-3"
        />
      </div>

      {/* Usage par type */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-docktor-50 rounded">
          <p className="text-lg font-semibold text-docktor-900">
            {data.usage.user.toFixed(1)}%
          </p>
          <p className="text-xs text-docktor-500">User</p>
        </div>
        <div className="text-center p-2 bg-docktor-50 rounded">
          <p className="text-lg font-semibold text-docktor-900">
            {data.usage.system.toFixed(1)}%
          </p>
          <p className="text-xs text-docktor-500">System</p>
        </div>
        <div className="text-center p-2 bg-docktor-50 rounded">
          <p className="text-lg font-semibold text-emerald-600">
            {data.usage.idle.toFixed(1)}%
          </p>
          <p className="text-xs text-docktor-500">Idle</p>
        </div>
      </div>

      {/* Usage par coeur */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-docktor-500 uppercase">Per Core</p>
        <div className="grid grid-cols-4 gap-2">
          {data.usage.perCore.map((usage, idx) => (
            <div key={idx} className="text-center">
              <div className="h-16 w-full bg-docktor-100 rounded relative overflow-hidden">
                <div
                  className={`absolute bottom-0 w-full ${getBarColor(usage)} transition-all duration-300`}
                  style={{ height: `${usage}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-docktor-700">
                  {usage.toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-docktor-500 mt-1">#{idx}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Section Memoire
 */
function MemorySection({ data }: { data: SystemMetrics['memory'] }) {
  const ramPercent = data.ram.usedPercent;
  const swapPercent = data.swap.usedPercent;

  const getColor = (value: number) => {
    if (value >= 90) return 'bg-red-500';
    if (value >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-docktor-900">Memory</h3>
        <span className="text-2xl font-bold text-docktor-900">
          {ramPercent.toFixed(1)}%
        </span>
      </div>

      {/* RAM */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-docktor-600">RAM</span>
          <span className="font-medium text-docktor-900">
            {formatBytes(data.ram.used)} / {formatBytes(data.ram.total)}
          </span>
        </div>
        <ProgressBar
          value={ramPercent}
          color={getColor(ramPercent)}
          showLabel={false}
          height="h-3"
        />
      </div>

      {/* Details RAM */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-docktor-50 rounded">
          <p className="text-sm font-semibold text-docktor-900">
            {formatBytes(data.ram.available)}
          </p>
          <p className="text-xs text-docktor-500">Available</p>
        </div>
        <div className="text-center p-2 bg-docktor-50 rounded">
          <p className="text-sm font-semibold text-docktor-900">
            {formatBytes(data.ram.cached)}
          </p>
          <p className="text-xs text-docktor-500">Cached</p>
        </div>
        <div className="text-center p-2 bg-docktor-50 rounded">
          <p className="text-sm font-semibold text-docktor-900">
            {formatBytes(data.ram.buffers)}
          </p>
          <p className="text-xs text-docktor-500">Buffers</p>
        </div>
      </div>

      {/* Swap */}
      {data.swap.total > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-docktor-600">Swap</span>
            <span className="font-medium text-docktor-900">
              {formatBytes(data.swap.used)} / {formatBytes(data.swap.total)}
            </span>
          </div>
          <ProgressBar
            value={swapPercent}
            color={getColor(swapPercent)}
            showLabel={false}
            height="h-2"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Section Disques
 */
function DisksSection({ data }: { data: SystemMetrics['disks'] }) {
  const getColor = (value: number) => {
    if (value >= 90) return 'bg-red-500';
    if (value >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-docktor-900 mb-4">Storage</h3>

      <div className="space-y-4">
        {data.map((disk, idx) => (
          <div key={idx} className="p-3 bg-docktor-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium text-docktor-900">{disk.mount}</p>
                <p className="text-xs text-docktor-500">
                  {disk.filesystem} ({disk.type})
                </p>
              </div>
              <span className="text-lg font-semibold text-docktor-900">
                {disk.usedPercent.toFixed(1)}%
              </span>
            </div>
            <ProgressBar
              value={disk.usedPercent}
              color={getColor(disk.usedPercent)}
              showLabel={false}
              height="h-2"
            />
            <div className="flex justify-between mt-2 text-xs text-docktor-500">
              <span>{formatBytes(disk.used)} used</span>
              <span>{formatBytes(disk.available)} free</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Section Reseau
 */
function NetworkSection({ data }: { data: SystemMetrics['network'] }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-docktor-900 mb-4">Network</h3>

      {/* Interfaces */}
      <div className="space-y-3 mb-4">
        {data.interfaces.map((iface, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 bg-docktor-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  iface.isUp ? 'bg-emerald-500' : 'bg-docktor-300'
                }`}
              />
              <div>
                <p className="font-medium text-docktor-900">{iface.name}</p>
                <p className="text-xs text-docktor-500">{iface.ip4 || 'No IP'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-docktor-500">{iface.type}</p>
              {iface.speed > 0 && (
                <p className="text-xs text-docktor-400">{iface.speed} Mbps</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Connexions */}
      <div className="p-3 bg-docktor-50 rounded-lg">
        <p className="text-sm font-medium text-docktor-700 mb-2">Connections</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-semibold text-emerald-600">
              {data.connections.established}
            </p>
            <p className="text-xs text-docktor-500">Established</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-sky-600">
              {data.connections.listening}
            </p>
            <p className="text-xs text-docktor-500">Listening</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-amber-600">
              {data.connections.timeWait}
            </p>
            <p className="text-xs text-docktor-500">Time Wait</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-docktor-600">
              {data.connections.total}
            </p>
            <p className="text-xs text-docktor-500">Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Section Processus
 */
function ProcessesSection({
  processes,
  onRefresh,
}: {
  processes: ProcessInfo[];
  onRefresh: () => void;
}) {
  const [sortBy, setSortBy] = useState<'cpu' | 'memory'>('cpu');

  const sorted = [...processes].sort((a, b) =>
    sortBy === 'cpu' ? b.cpu - a.cpu : b.memory - a.memory
  );

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-docktor-900">Top Processes</h3>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'cpu' | 'memory')}
            className="text-xs border border-docktor-200 rounded px-2 py-1 bg-white"
          >
            <option value="cpu">Sort by CPU</option>
            <option value="memory">Sort by Memory</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-docktor-500 border-b border-docktor-100">
              <th className="pb-2 font-medium">PID</th>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium text-right">CPU %</th>
              <th className="pb-2 font-medium text-right">Mem %</th>
              <th className="pb-2 font-medium text-right">Memory</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 10).map((proc) => (
              <tr
                key={proc.pid}
                className="border-b border-docktor-50 hover:bg-docktor-50"
              >
                <td className="py-2 text-docktor-500">{proc.pid}</td>
                <td className="py-2 font-medium text-docktor-900 truncate max-w-[150px]">
                  {proc.name}
                </td>
                <td className="py-2 text-right">
                  <span
                    className={`font-medium ${
                      proc.cpu > 50
                        ? 'text-red-600'
                        : proc.cpu > 20
                        ? 'text-amber-600'
                        : 'text-docktor-700'
                    }`}
                  >
                    {proc.cpu.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 text-right">
                  <span
                    className={`font-medium ${
                      proc.memory > 50
                        ? 'text-red-600'
                        : proc.memory > 20
                        ? 'text-amber-600'
                        : 'text-docktor-700'
                    }`}
                  >
                    {proc.memory.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 text-right text-docktor-500">
                  {formatBytes(proc.memoryUsed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Composant principal
 */
export function SystemMetricsPanel() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'processes'>('overview');

  const loadData = useCallback(async () => {
    try {
      const [metricsData, processesData] = await Promise.all([
        getSystemMetrics(),
        getProcesses(15, 'cpu'),
      ]);
      setMetrics(metricsData);
      setProcesses(processesData.processes);
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

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-2 border-docktor-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="flex flex-col items-center text-center">
          <svg className="w-12 h-12 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="mt-4 text-docktor-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light"
          >
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-docktor-100">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-docktor-500 hover:text-docktor-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('processes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'processes'
              ? 'border-primary text-primary'
              : 'border-transparent text-docktor-500 hover:text-docktor-700'
          }`}
        >
          Processes
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CpuSection data={metrics.cpu} />
          <MemorySection data={metrics.memory} />
          <DisksSection data={metrics.disks} />
          <NetworkSection data={metrics.network} />
        </div>
      ) : (
        <ProcessesSection processes={processes} onRefresh={loadData} />
      )}
    </div>
  );
}
