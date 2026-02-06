'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAppTemplates, createApp, validateGitConfig } from '@/lib/api';
import type { AppTemplate, AppType, GitAuthMethod, EnvVariable, CreateAppRequest } from '@/types';

// ============================================
// Types locaux
// ============================================

interface GitFormState {
  enabled: boolean;
  url: string;
  branch: string;
  isPrivate: boolean;
  authMethod: GitAuthMethod;
  accessToken: string;
  username: string;
  password: string;
  sshPrivateKey: string;
}

interface FormErrors {
  name?: string;
  git?: string[];
  general?: string;
}

// ============================================
// Constantes
// ============================================

const GIT_PROVIDERS = [
  { name: 'GitHub', domain: 'github.com', icon: '🐙' },
  { name: 'GitLab', domain: 'gitlab.com', icon: '🦊' },
  { name: 'Bitbucket', domain: 'bitbucket.org', icon: '🪣' },
];

const AUTH_METHODS: { value: GitAuthMethod; label: string; description: string }[] = [
  { value: 'token', label: 'Token d\'accès', description: 'Personal Access Token (recommandé)' },
  { value: 'username_password', label: 'Identifiants', description: 'Nom d\'utilisateur et mot de passe' },
  { value: 'ssh', label: 'Clé SSH', description: 'Clé privée SSH' },
];

// ============================================
// Composant Principal
// ============================================

export default function NewAppPage() {
  const router = useRouter();
  
  // États du formulaire
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [selectedType, setSelectedType] = useState<AppType | null>(null);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [envInput, setEnvInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customDockerfile, setCustomDockerfile] = useState('');
  const [customDockerCompose, setCustomDockerCompose] = useState('');
  
  // État Git
  const [git, setGit] = useState<GitFormState>({
    enabled: false,
    url: '',
    branch: 'main',
    isPrivate: false,
    authMethod: 'token',
    accessToken: '',
    username: '',
    password: '',
    sshPrivateKey: '',
  });

  // État UI
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [validatingGit, setValidatingGit] = useState(false);
  const [gitValid, setGitValid] = useState<boolean | null>(null);

  // Charger les templates
  useEffect(() => {
    getAppTemplates()
      .then(setTemplates)
      .catch(console.error);
  }, []);

  // Detecter le provider Git
  const detectProvider = useCallback((url: string) => {
    const lower = url.toLowerCase();
    return GIT_PROVIDERS.find(p => lower.includes(p.domain))?.name || 'Autre';
  }, []);

  // Valider la configuration Git
  const validateGit = useCallback(async () => {
    if (!git.enabled || !git.url) return;

    setValidatingGit(true);
    setGitValid(null);
    
    try {
      const result = await validateGitConfig({
        url: git.url,
        branch: git.branch,
        isPrivate: git.isPrivate,
        authMethod: git.isPrivate ? git.authMethod : 'none',
        accessToken: git.authMethod === 'token' ? git.accessToken : undefined,
        username: git.authMethod === 'username_password' ? git.username : undefined,
        password: git.authMethod === 'username_password' ? git.password : undefined,
        sshPrivateKey: git.authMethod === 'ssh' ? git.sshPrivateKey : undefined,
      });

      setGitValid(result.valid);
      if (!result.valid) {
        setErrors(prev => ({ ...prev, git: result.errors }));
      } else {
        setErrors(prev => ({ ...prev, git: undefined }));
      }
    } catch (err) {
      setGitValid(false);
      setErrors(prev => ({ ...prev, git: ['Erreur de validation'] }));
    } finally {
      setValidatingGit(false);
    }
  }, [git]);

  // Valider le formulaire avant passage à l'étape suivante
  const validateStep = useCallback(() => {
    const newErrors: FormErrors = {};

    if (step === 1 && !selectedType) {
      newErrors.general = 'Sélectionnez un type d\'application';
    }

    if (step === 2) {
      if (!name || name.length < 2) {
        newErrors.name = 'Le nom doit contenir au moins 2 caractères';
      } else if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
        newErrors.name = 'Caractères autorisés: lettres, chiffres, tirets, underscores';
      }

      if (git.enabled && git.isPrivate) {
        const gitErrors: string[] = [];
        
        if (!git.url) {
          gitErrors.push('URL du repository requise');
        }
        
        if (git.authMethod === 'token' && !git.accessToken) {
          gitErrors.push('Token d\'accès requis');
        }
        if (git.authMethod === 'username_password') {
          if (!git.username) gitErrors.push('Nom d\'utilisateur requis');
          if (!git.password) gitErrors.push('Mot de passe requis');
        }
        if (git.authMethod === 'ssh' && !git.sshPrivateKey) {
          gitErrors.push('Clé SSH privée requise');
        }

        if (gitErrors.length > 0) {
          newErrors.git = gitErrors;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [step, selectedType, name, git]);

  // Passer à l'étape suivante
  const nextStep = () => {
    if (validateStep()) {
      setStep(s => Math.min(s + 1, 4));
    }
  };

  // Revenir à l'étape précédente
  const prevStep = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  // Parser les variables d'environnement
  const parseEnvVariables = (input: string) => {
    const lines = input.split('\n').filter(l => l.trim() && l.includes('='));
    const vars: EnvVariable[] = lines.map(line => {
      const [key, ...valueParts] = line.split('=');
      return {
        key: key.trim(),
        value: valueParts.join('=').trim(),
        isSecret: key.toLowerCase().includes('secret') || key.toLowerCase().includes('password'),
      };
    });
    setEnvVariables(prev => [...prev, ...vars]);
    setEnvInput('');
  };

  // Ajouter une variable d'environnement
  const addEnvVariable = () => {
    setEnvVariables([...envVariables, { key: '', value: '' }]);
  };

  // Supprimer une variable d'environnement
  const removeEnvVariable = (index: number) => {
    setEnvVariables(envVariables.filter((_, i) => i !== index));
  };

  // Mettre à jour une variable d'environnement
  const updateEnvVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVariables];
    updated[index][field] = value;
    setEnvVariables(updated);
  };

  // Soumettre le formulaire
  const handleSubmit = async () => {
    if (!validateStep()) return;
    if (!selectedType) return;

    setLoading(true);
    setErrors({});

    try {
      const request: CreateAppRequest = {
        name,
        type: selectedType,
        envVariables: envVariables.filter(v => v.key && v.value),
        domain: domain || undefined,
        dockerfile: showAdvanced && customDockerfile ? customDockerfile : undefined,
        dockerCompose: showAdvanced && customDockerCompose ? customDockerCompose : undefined,
      };

      // Ajouter la configuration Git si activée
      if (git.enabled && git.url) {
        request.git = {
          url: git.url,
          branch: git.branch || 'main',
          isPrivate: git.isPrivate,
          authMethod: git.isPrivate ? git.authMethod : 'none',
          accessToken: git.authMethod === 'token' ? git.accessToken : undefined,
          username: git.authMethod === 'username_password' ? git.username : undefined,
          password: git.authMethod === 'username_password' ? git.password : undefined,
          sshPrivateKey: git.authMethod === 'ssh' ? git.sshPrivateKey : undefined,
        };
      }

      const app = await createApp(request);
      
      // Rediriger vers la page principale avec l'app sélectionnée
      router.push(`/?app=${app.id}&deploy=true`);
      
    } catch (err: any) {
      setErrors({ general: err.message || 'Erreur lors de la création de l\'application' });
    } finally {
      setLoading(false);
    }
  };

  // Template sélectionné
  const selectedTemplate = templates.find(t => t.type === selectedType);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Retour
            </Link>
            <h1 className="text-xl font-bold text-slate-800">Nouvelle Application</h1>
          </div>
          
          {/* Indicateur d'étapes */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? 'bg-cyan-600 text-white'
                    : s < step
                    ? 'bg-cyan-100 text-cyan-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Erreur générale */}
        {errors.general && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Erreur:</strong> {errors.general}
          </div>
        )}

        {/* Étape 1: Type d'application */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Type d'application</h2>
              <p className="text-slate-600">Sélectionnez le type qui correspond à votre projet</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {templates.map(template => (
                <button
                  key={template.type}
                  onClick={() => setSelectedType(template.type)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedType === template.type
                      ? 'border-cyan-500 bg-cyan-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow'
                  }`}
                >
                  <div className="text-2xl mb-2">
                    {template.type === 'php' && '🐘'}
                    {template.type === 'laravel' && '🔴'}
                    {template.type === 'nodejs' && '💚'}
                    {template.type === 'nodejs-typescript' && '💙'}
                    {template.type === 'nextjs' && '⚫'}
                    {template.type === 'static' && '📄'}
                    {template.type === 'python' && '🐍'}
                    {template.type === 'custom' && '🔧'}
                  </div>
                  <div className="font-semibold text-slate-800">{template.name}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Étape 2: Configuration */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Configuration</h2>
              <p className="text-slate-600">Informations de base et source du code</p>
            </div>

            {/* Nom de l'application */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nom de l'application <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="mon-application"
                className={`w-full px-4 py-3 rounded-lg border ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-600">{errors.name}</p>
              )}
              <p className="mt-2 text-sm text-slate-500">
                Caractères autorisés: lettres, chiffres, tirets, underscores
              </p>
            </div>

            {/* Source Git */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">Repository Git</h3>
                  <p className="text-sm text-slate-500">Cloner le code depuis un repository</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={git.enabled}
                    onChange={e => setGit({ ...git, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-cyan-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>

              {git.enabled && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  {/* URL du repository */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      URL du repository
                    </label>
                    <input
                      type="text"
                      value={git.url}
                      onChange={e => setGit({ ...git, url: e.target.value })}
                      placeholder="https://github.com/user/repo.git"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    {git.url && (
                      <p className="mt-2 text-sm text-slate-500">
                        Provider détecté: <span className="font-medium">{detectProvider(git.url)}</span>
                      </p>
                    )}
                  </div>

                  {/* Branche */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Branche
                    </label>
                    <input
                      type="text"
                      value={git.branch}
                      onChange={e => setGit({ ...git, branch: e.target.value })}
                      placeholder="main"
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  {/* Repository privé */}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="isPrivate"
                      checked={git.isPrivate}
                      onChange={e => setGit({ ...git, isPrivate: e.target.checked })}
                      className="w-5 h-5 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                    />
                    <label htmlFor="isPrivate" className="cursor-pointer">
                      <span className="font-medium text-slate-800">Repository privé</span>
                      <p className="text-sm text-slate-500">Nécessite une authentification</p>
                    </label>
                  </div>

                  {/* Authentification pour repo privé */}
                  {git.isPrivate && (
                    <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700">
                        <span>🔐</span>
                        <span className="font-medium">Authentification requise</span>
                      </div>

                      {/* Méthode d'authentification */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Méthode d'authentification
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {AUTH_METHODS.map(method => (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => setGit({ ...git, authMethod: method.value })}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${
                                git.authMethod === method.value
                                  ? 'border-cyan-500 bg-white'
                                  : 'border-slate-200 bg-white/50 hover:border-slate-300'
                              }`}
                            >
                              <div className="font-medium text-sm text-slate-800">{method.label}</div>
                              <div className="text-xs text-slate-500">{method.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Champs selon la méthode */}
                      {git.authMethod === 'token' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Personal Access Token <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={git.accessToken}
                            onChange={e => setGit({ ...git, accessToken: e.target.value })}
                            placeholder="ghp_xxxxx... ou glpat-xxxxx..."
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                          <p className="mt-2 text-xs text-slate-500">
                            {detectProvider(git.url) === 'GitHub' && 'GitHub: Settings → Developer settings → Personal access tokens'}
                            {detectProvider(git.url) === 'GitLab' && 'GitLab: Preferences → Access Tokens'}
                            {detectProvider(git.url) === 'Bitbucket' && 'Bitbucket: Personal settings → App passwords'}
                          </p>
                        </div>
                      )}

                      {git.authMethod === 'username_password' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Nom d'utilisateur <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={git.username}
                              onChange={e => setGit({ ...git, username: e.target.value })}
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Mot de passe <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="password"
                              value={git.password}
                              onChange={e => setGit({ ...git, password: e.target.value })}
                              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                          </div>
                        </>
                      )}

                      {git.authMethod === 'ssh' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Clé SSH privée <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={git.sshPrivateKey}
                            onChange={e => setGit({ ...git, sshPrivateKey: e.target.value })}
                            placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                            rows={6}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                          />
                          <p className="mt-2 text-xs text-slate-500">
                            Collez le contenu de votre fichier id_rsa ou id_ed25519
                          </p>
                        </div>
                      )}

                      {/* Erreurs Git */}
                      {errors.git && errors.git.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <ul className="text-sm text-red-700 list-disc list-inside">
                            {errors.git.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Bouton de validation */}
                      <button
                        type="button"
                        onClick={validateGit}
                        disabled={validatingGit}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {validatingGit ? 'Validation...' : 'Valider la configuration'}
                      </button>

                      {gitValid !== null && (
                        <div className={`p-3 rounded-lg ${gitValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {gitValid ? '✓ Configuration valide' : '✗ Configuration invalide'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Domaine */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Domaine personnalisé (optionnel)
              </label>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="app.example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="mt-2 text-sm text-slate-500">
                Configurez votre DNS pour pointer vers ce serveur
              </p>
            </div>
          </div>
        )}

        {/* Étape 3: Variables d'environnement */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Variables d'environnement</h2>
              <p className="text-slate-600">Configurez les variables nécessaires à votre application</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              {/* Variables par défaut du template */}
              {selectedTemplate && selectedTemplate.defaultEnvVariables.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>Variables par défaut ({selectedTemplate.name}):</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.defaultEnvVariables.map(v => (
                      <span key={v.key} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono">
                        {v.key}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Liste des variables */}
              {envVariables.map((variable, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={variable.key}
                    onChange={e => updateEnvVariable(index, 'key', e.target.value)}
                    placeholder="NOM_VARIABLE"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <span className="py-2 text-slate-400">=</span>
                  <input
                    type="text"
                    value={variable.value}
                    onChange={e => updateEnvVariable(index, 'value', e.target.value)}
                    placeholder="valeur"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVariable(index)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Bouton ajouter */}
              <button
                type="button"
                onClick={addEnvVariable}
                className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-cyan-500 hover:text-cyan-600 transition-colors"
              >
                + Ajouter une variable
              </button>

              {/* Import en masse */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Import en masse (format KEY=value)
                </label>
                <textarea
                  value={envInput}
                  onChange={e => setEnvInput(e.target.value)}
                  placeholder={"DB_HOST=localhost\nDB_PORT=5432\nAPI_KEY=secret123"}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => parseEnvVariables(envInput)}
                  disabled={!envInput.trim()}
                  className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Importer
                </button>
              </div>

              {/* Mode avancé */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  {showAdvanced ? '▼' : '▶'} Mode avancé (Dockerfile / docker-compose personnalisés)
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Dockerfile personnalisé
                      </label>
                      <textarea
                        value={customDockerfile}
                        onChange={e => setCustomDockerfile(e.target.value)}
                        placeholder={selectedTemplate?.dockerfile || 'FROM node:20-alpine\n...'}
                        rows={10}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        docker-compose.yml personnalisé
                      </label>
                      <textarea
                        value={customDockerCompose}
                        onChange={e => setCustomDockerCompose(e.target.value)}
                        placeholder={selectedTemplate?.dockerCompose || 'version: "3.8"\n...'}
                        rows={10}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Étape 4: Récapitulatif */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Récapitulatif</h2>
              <p className="text-slate-600">Vérifiez les informations avant de créer l'application</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {/* Informations de base */}
              <div className="p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Informations générales</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Nom</dt>
                    <dd className="font-medium text-slate-800">{name}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Type</dt>
                    <dd className="font-medium text-slate-800">{selectedTemplate?.name}</dd>
                  </div>
                  {domain && (
                    <div>
                      <dt className="text-slate-500">Domaine</dt>
                      <dd className="font-medium text-slate-800">{domain}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Configuration Git */}
              {git.enabled && git.url && (
                <div className="p-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Repository Git</h3>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div className="col-span-2">
                      <dt className="text-slate-500">URL</dt>
                      <dd className="font-medium text-slate-800 font-mono text-xs break-all">
                        {git.url.replace(/\/\/[^@]+@/, '//***@')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Branche</dt>
                      <dd className="font-medium text-slate-800">{git.branch}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Privé</dt>
                      <dd className="font-medium text-slate-800">{git.isPrivate ? 'Oui' : 'Non'}</dd>
                    </div>
                    {git.isPrivate && (
                      <div>
                        <dt className="text-slate-500">Authentification</dt>
                        <dd className="font-medium text-slate-800">
                          {git.authMethod === 'token' && 'Token d\'accès'}
                          {git.authMethod === 'username_password' && 'Identifiants'}
                          {git.authMethod === 'ssh' && 'Clé SSH'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Variables d'environnement */}
              {envVariables.length > 0 && (
                <div className="p-6">
                  <h3 className="font-semibold text-slate-800 mb-4">
                    Variables d'environnement ({envVariables.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {envVariables.filter(v => v.key).map(v => (
                      <span key={v.key} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded font-mono">
                        {v.key}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Configuration personnalisée */}
              {showAdvanced && (customDockerfile || customDockerCompose) && (
                <div className="p-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Configuration personnalisée</h3>
                  <div className="flex gap-2">
                    {customDockerfile && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                        Dockerfile personnalisé
                      </span>
                    )}
                    {customDockerCompose && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                        docker-compose personnalisé
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className="px-6 py-3 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Précédent
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
            >
              Suivant →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Création...
                </>
              ) : (
                <>Créer l'application</>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
