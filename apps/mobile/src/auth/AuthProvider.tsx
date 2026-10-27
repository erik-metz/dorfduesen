import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export type MobileUser = {
  id: string;
  stravaAthleteId: string;
  firstname: string | null;
  lastname: string | null;
  username: string | null;
  profile: string | null;
  city: string | null;
  country: string | null;
  activityCount: number;
  scope?: string | null;
  lastSync?: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  user: MobileUser | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

type CachedResponse = { response: Response; expiresAt: number };

function cacheTtlForPath(pathname: string) {
  if (pathname === '/api/mobile/members') return 5 * 60_000;
  if (pathname === '/api/mobile/arena') return 15_000;
  if (pathname === '/api/mobile/dashboard') return 10_000;
  if (pathname === '/api/coach/metrics' || pathname === '/api/coach/profile' || pathname === '/api/coach/plan') return 20_000;
  if (pathname === '/api/trophies') return 20_000;
  if (pathname === '/api/notifications') return 8_000;
  if (/^\/api\/strava\/activities\/[^/]+$/.test(pathname)) return 60_000;
  return 0;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'dorfduesen_mobile_session';
const PENDING_STATE_KEY = 'dorfduesen_mobile_oauth_state';
const PENDING_VERIFIER_KEY = 'dorfduesen_mobile_pkce_verifier';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const APP_REDIRECT_URI = 'dorfduesen://auth/callback';

WebBrowser.maybeCompleteAuthSession();

function base64Url(value: string) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';
}

async function readJson(response: Response) {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<MobileUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const processingCallback = useRef(false);
  const processedStates = useRef(new Set<string>());
  const responseCache = useRef(new Map<string, CachedResponse>());
  const pendingRequests = useRef(new Map<string, Promise<Response>>());
  const cacheUserId = useRef<string | null>(null);
  const cacheGeneration = useRef(0);

  const clearResponseCache = useCallback(() => {
    cacheGeneration.current += 1;
    responseCache.current.clear();
    pendingRequests.current.clear();
  }, []);

  const loadUser = useCallback(async (token: string) => {
    if (!API_BASE_URL) throw new Error('EXPO_PUBLIC_API_URL ist nicht konfiguriert.');
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await readJson(response);
    if (!response.ok || payload.authenticated !== true || !payload.user) {
      if (response.status === 401) await SecureStore.deleteItemAsync(TOKEN_KEY);
      throw new Error('Die Dorfdüsen-Sitzung ist ungültig oder abgelaufen.');
    }
    setUser(payload.user as MobileUser);
    setStatus('authenticated');
  }, []);

  const processAuthCallback = useCallback(async (url: string) => {
    if (processingCallback.current) return;
    const parsed = Linking.parse(url);
    const params = parsed.queryParams ?? {};
    const code = typeof params.code === 'string' ? params.code : null;
    const state = typeof params.state === 'string' ? params.state : null;
    const authError = typeof params.error === 'string' ? params.error : null;
    if (!code && !authError) return;
    if (state && processedStates.current.has(state)) return;
    if (state) processedStates.current.add(state);

    processingCallback.current = true;
    setStatus('loading');
    setError(null);
    try {
      const [expectedState, verifier] = await Promise.all([
        SecureStore.getItemAsync(PENDING_STATE_KEY),
        SecureStore.getItemAsync(PENDING_VERIFIER_KEY),
      ]);
      if (!state || !expectedState || state !== expectedState || !verifier) {
        throw new Error('Die OAuth-Rückgabe konnte nicht verifiziert werden. Bitte erneut anmelden.');
      }
      if (authError) throw new Error('Die Anmeldung bei Strava wurde abgebrochen.');
      if (!code || !API_BASE_URL) throw new Error('Die Anmeldung konnte nicht abgeschlossen werden.');

      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, verifier }),
      });
      const payload = await readJson(response);
      if (!response.ok || typeof payload.token !== 'string') {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Der Anmeldecode ist ungültig oder abgelaufen.');
      }

      await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
      await loadUser(payload.token);
    } catch (callbackError) {
      setUser(null);
      setStatus('anonymous');
      setError(errorMessage(callbackError));
    } finally {
      await SecureStore.deleteItemAsync(PENDING_STATE_KEY);
      await SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY);
      processingCallback.current = false;
    }
  }, [loadUser]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!active) return;
        if (token) await loadUser(token);
        else setStatus('anonymous');
      } catch (restoreError) {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
        setError(errorMessage(restoreError));
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => { void processAuthCallback(url); });
    void restoreSession();
    void Linking.getInitialURL().then((url) => { if (url) void processAuthCallback(url); });
    return () => { active = false; subscription.remove(); };
  }, [loadUser, processAuthCallback]);

  const login = useCallback(async () => {
    setError(null);
    setStatus('loading');
    try {
      if (!API_BASE_URL) throw new Error('EXPO_PUBLIC_API_URL ist nicht konfiguriert.');
      const state = Crypto.randomUUID();
      const verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      );
      const challenge = base64Url(digest);

      await SecureStore.setItemAsync(PENDING_STATE_KEY, state);
      await SecureStore.setItemAsync(PENDING_VERIFIER_KEY, verifier);

      const loginUrl = new URL('/api/auth/strava/login', API_BASE_URL);
      loginUrl.searchParams.set('platform', 'mobile');
      loginUrl.searchParams.set('state', state);
      loginUrl.searchParams.set('code_challenge', challenge);
      const result = await WebBrowser.openAuthSessionAsync(loginUrl.toString(), APP_REDIRECT_URI);
      if (result.type === 'success') {
        await processAuthCallback(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        await SecureStore.deleteItemAsync(PENDING_STATE_KEY);
        await SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY);
        setStatus('anonymous');
      }
    } catch (loginError) {
      await SecureStore.deleteItemAsync(PENDING_STATE_KEY);
      await SecureStore.deleteItemAsync(PENDING_VERIFIER_KEY);
      setStatus('anonymous');
      setError(errorMessage(loginError));
    }
  }, [processAuthCallback]);

  const logout = useCallback(async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token && API_BASE_URL) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Always clear the local session, even while offline.
      }
    }
    clearResponseCache();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
    setError(null);
    setStatus('anonymous');
  }, [clearResponseCache]);

  const apiFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!API_BASE_URL) throw new Error('EXPO_PUBLIC_API_URL ist nicht konfiguriert.');
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) throw new Error('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
    const { cache: cacheDirective, ...fetchOptions } = init;
    const headers = new Headers(fetchOptions.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const url = new URL(path, `${API_BASE_URL}/`);
    const method = (fetchOptions.method ?? 'GET').toUpperCase();
    const canCache = method === 'GET' && cacheDirective !== 'no-store' && cacheTtlForPath(url.pathname) > 0;
    if (cacheUserId.current !== user?.id) {
      clearResponseCache();
      cacheUserId.current = user?.id ?? null;
    }
    const key = `${user?.id ?? 'unknown'}:${url.toString()}`;
    const now = Date.now();
    const cached = canCache ? responseCache.current.get(key) : undefined;
    if (cached && cached.expiresAt > now) return cached.response.clone();
    if (cached) responseCache.current.delete(key);
    if (canCache) {
      const pending = pendingRequests.current.get(key);
      if (pending) return (await pending).clone();
    }

    const generation = cacheGeneration.current;
    const request = fetch(url.toString(), { ...fetchOptions, headers });
    if (canCache) pendingRequests.current.set(key, request);
    try {
      const response = await request;
      if (method !== 'GET' && response.ok) clearResponseCache();
      if (canCache && response.ok && generation === cacheGeneration.current) {
        responseCache.current.set(key, { response: response.clone(), expiresAt: Date.now() + cacheTtlForPath(url.pathname) });
        if (responseCache.current.size > 100) {
          const oldestKey = responseCache.current.keys().next().value;
          if (oldestKey) responseCache.current.delete(oldestKey);
        }
      }
      return response;
    } finally {
      if (pendingRequests.current.get(key) === request) pendingRequests.current.delete(key);
    }
  }, [clearResponseCache, user?.id]);

  return (
    <AuthContext.Provider value={{ status, user, error, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth muss innerhalb des AuthProvider verwendet werden.');
  return context;
}
