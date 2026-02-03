/**
 * Page principale du Dashboard Docker Monitor
 */

import { ContainerList } from '@/components';

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-docker-dark text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            {/* Logo Docker stylisé */}
            <div className="text-3xl">🐳</div>
            <div>
              <h1 className="text-xl font-bold">Docktor Monitor</h1>
              <p className="text-sm text-gray-300">
                Monitoring et contrôle des containers...
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContainerList />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            Docktor Monitor • Rafraîchissement automatique toutes les 5 secondes
          </p>
        </div>
      </footer>
    </div>
  );
}
