'use client';

/**
 * Composant CreateAppModal
 * Modal pour creer une nouvelle application
 */

import { useState, useEffect } from 'react';
import type { AppTemplate, AppType, EnvVariable, CreateAppRequest } from '@/types';
import { getAppTemplates, createApp, ApiError } from '@/lib/api';

interface CreateAppModalProps {
  onClose: () => void;
  onCreated: () => void;
}

/** Etapes du formulaire */
type Step = 'type' | 'config' | 'env' | 'review';

export function CreateAppModal({ onClose, onCreated }: CreateAppModalProps) {
  const [step, setStep] = useState<Step>('type');
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Donnees du formulaire
  const [selectedType, setSelectedType] = useState<AppType | null>(null);
  const [appName, setAppName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [domain, setDomain] = useState('');
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [dockerfile, setDockerfile] = useState('');
  const [dockerCompose, setDockerCompose] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Charger les templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await getAppTemplates();
        setTemplates(data);
      } catch (err) {
        setError('Impossible de charger les templates');
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

  // Mettre a jour les valeurs par defaut quand le type change
  useEffect(() => {
    if (selectedType) {
      const template = templates.find((t) => t.type === selectedType);
      if (template) {
        setEnvVariables([...template.defaultEnvVariables]);
        setDockerfile(template.dockerfile);
        setDockerCompose(template.dockerCompose);
      }
    }
  }, [selectedType, templates]);

  // Fermeture avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleAddEnvVariable = () => {
    setEnvVariables([...envVariables, { key: '', value: '' }]);
  };

  const handleRemoveEnvVariable = (index: number) => {
    setEnvVariables(envVariables.filter((_, i) => i !== index));
  };

  const handleUpdateEnvVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVariables];
    updated[index] = { ...updated[index], [field]: value };
    setEnvVariables(updated);
  };

  const handlePasteEnv = (text: string) => {
    const lines = text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    const parsed: EnvVariable[] = lines.map((line) => {
      const [key, ...valueParts] = line.split('=');
      return { key: key?.trim() || '', value: valueParts.join('=').trim() };
    }).filter((v) => v.key);
    
    if (parsed.length > 0) {
      setEnvVariables([...envVariables, ...parsed]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !appName) {
      setError('Le nom et le type sont requis');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const request: CreateAppRequest = {
        name: appName,
        type: selectedType,
        gitUrl: gitUrl || undefined,
        gitBranch: gitBranch || 'main',
        domain: domain || undefined,
        envVariables: envVariables.filter((v) => v.key),
        dockerfile: showAdvanced ? dockerfile : undefined,
        dockerCompose: showAdvanced ? dockerCompose : undefined,
      };

      await createApp(request);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erreur lors de la creation');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'type':
        return selectedType !== null;
      case 'config':
        return appName.trim().length >= 2;
      case 'env':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const steps: Step[] = ['type', 'config', 'env', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['type', 'config', 'env', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-docktor-950/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-docktor-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-docktor-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-docktor-900">Nouvelle Application</h2>
              <p className="text-sm text-docktor-500 mt-0.5">
                Etape {['type', 'config', 'env', 'review'].indexOf(step) + 1} sur 4
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-docktor-400 hover:text-docktor-600 hover:bg-docktor-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {['type', 'config', 'env', 'review'].map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  ['type', 'config', 'env', 'review'].indexOf(step) >= i
                    ? 'bg-primary'
                    : 'bg-docktor-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Step: Type */}
          {step === 'type' && (
            <div>
              <h3 className="text-lg font-medium text-docktor-900 mb-4">
                Choisissez le type d'application
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {templates.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => setSelectedType(template.type)}
                    className={`p-4 text-left border-2 rounded-xl transition-all ${
                      selectedType === template.type
                        ? 'border-primary bg-primary/5'
                        : 'border-docktor-200 hover:border-docktor-300'
                    }`}
                  >
                    <p className="font-semibold text-docktor-900">{template.name}</p>
                    <p className="text-sm text-docktor-500 mt-1">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Config */}
          {step === 'config' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-docktor-900 mb-4">
                Configuration de l'application
              </h3>

              <div>
                <label className="block text-sm font-medium text-docktor-700 mb-1.5">
                  Nom de l'application *
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="mon-application"
                  className="w-full px-4 py-2.5 border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-docktor-700 mb-1.5">
                  URL du repository Git (optionnel)
                </label>
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full px-4 py-2.5 border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-docktor-700 mb-1.5">
                  Branche Git
                </label>
                <input
                  type="text"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-4 py-2.5 border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-docktor-700 mb-1.5">
                  Domaine (optionnel)
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="app.exemple.com"
                  className="w-full px-4 py-2.5 border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Step: Env */}
          {step === 'env' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-docktor-900">
                  Variables d'environnement
                </h3>
                <button
                  onClick={handleAddEnvVariable}
                  className="text-sm text-primary hover:text-primary-light font-medium"
                >
                  + Ajouter
                </button>
              </div>

              {/* Zone de collage */}
              <div className="p-3 bg-docktor-50 rounded-lg">
                <p className="text-xs text-docktor-500 mb-2">
                  Collez vos variables d'environnement (format KEY=VALUE)
                </p>
                <textarea
                  placeholder="DB_HOST=localhost&#10;DB_USER=root&#10;DB_PASS=secret"
                  className="w-full px-3 py-2 text-sm border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  rows={3}
                  onPaste={(e) => {
                    e.preventDefault();
                    handlePasteEnv(e.clipboardData.getData('text'));
                  }}
                />
              </div>

              {/* Liste des variables */}
              <div className="space-y-2">
                {envVariables.map((variable, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => handleUpdateEnvVariable(index, 'key', e.target.value)}
                      placeholder="KEY"
                      className="flex-1 px-3 py-2 text-sm border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                    <span className="text-docktor-400">=</span>
                    <input
                      type={variable.isSecret ? 'password' : 'text'}
                      value={variable.value}
                      onChange={(e) => handleUpdateEnvVariable(index, 'value', e.target.value)}
                      placeholder="VALUE"
                      className="flex-1 px-3 py-2 text-sm border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                    <button
                      onClick={() => handleRemoveEnvVariable(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Configuration avancee */}
              <div className="pt-4 border-t border-docktor-100">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-docktor-600 hover:text-docktor-900"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Configuration avancee (Dockerfile)
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-docktor-700 mb-1.5">
                        Dockerfile
                      </label>
                      <textarea
                        value={dockerfile}
                        onChange={(e) => setDockerfile(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono resize-none"
                        rows={10}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-docktor-700 mb-1.5">
                        Docker Compose
                      </label>
                      <textarea
                        value={dockerCompose}
                        onChange={(e) => setDockerCompose(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-docktor-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono resize-none"
                        rows={10}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-docktor-900 mb-4">
                Resume de l'application
              </h3>

              <div className="p-4 bg-docktor-50 rounded-xl space-y-3">
                <div className="flex justify-between">
                  <span className="text-docktor-500">Nom</span>
                  <span className="font-medium text-docktor-900">{appName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-docktor-500">Type</span>
                  <span className="font-medium text-docktor-900">
                    {templates.find((t) => t.type === selectedType)?.name}
                  </span>
                </div>
                {gitUrl && (
                  <div className="flex justify-between">
                    <span className="text-docktor-500">Repository</span>
                    <span className="font-medium text-docktor-900 text-sm truncate max-w-[200px]">
                      {gitUrl}
                    </span>
                  </div>
                )}
                {domain && (
                  <div className="flex justify-between">
                    <span className="text-docktor-500">Domaine</span>
                    <span className="font-medium text-docktor-900">{domain}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-docktor-500">Variables d'env</span>
                  <span className="font-medium text-docktor-900">
                    {envVariables.filter((v) => v.key).length}
                  </span>
                </div>
              </div>

              <p className="text-sm text-docktor-500">
                L'application sera creee avec un port attribue automatiquement.
                Vous pourrez ensuite la deployer depuis la liste des applications.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-docktor-100 flex items-center justify-between">
          <button
            onClick={step === 'type' ? onClose : prevStep}
            className="px-4 py-2 text-sm font-medium text-docktor-600 hover:text-docktor-900"
          >
            {step === 'type' ? 'Annuler' : 'Retour'}
          </button>

          {step === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-light disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creation...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Creer l'application
                </>
              )}
            </button>
          ) : (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-light disabled:opacity-50 transition-colors"
            >
              Suivant
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
