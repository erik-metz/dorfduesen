import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  deleteAccount: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  getCachedJson: <T>(path: string) => Promise<T | null>;
};

type CachedResponse = { response: Response; expiresAt: number; savedAt: number };
const MEMORY_CACHE_MAX_AGE = 30 * 60_000;

function cacheTtlForPath(pathname: string) {
  if (pathname === '/api/mobile/members') return 5 * 60_000;
  if (pathname === '/api/mobile/arena') return 15_000;
  if (pathname === '/api/arena/territories') return 60_000;
  if (pathname === '/api/mobile/dashboard') return 10_000;
  if (pathname === '/api/coach/profile' || pathname === '/api/coach/metrics' || pathname === '/api/trophies') return 120_000;
  if (pathname === '/api/coach/plan') return 20_000;
  if (pathname === '/api/notifications') return 30_000;
  if (pathname === '/api/mobile/health/status' || pathname === '/api/mobile/health/records') return 60_000;
  if (/^\/api\/strava\/activities\/[^/]+$/.test(pathname)) return 60_000;
  return 0;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'dorfduesen_mobile_session';
const USER_KEY = 'dorfduesen_mobile_cached_user';
const DATA_CACHE_PREFIX = 'dorfduesen_mobile_cache_v1:';
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
      if (response.status === 401) {
        await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
        setUser(null);
        setStatus('anonymous');
      }
      throw new Error('Die Dorfdüsen-Sitzung ist ungültig oder abgelaufen.');
    }
    const loadedUser = payload.user as MobileUser;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(loadedUser));
    setUser(loadedUser);
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
      let hadCachedUser = false;
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!active) return;
        if (token) {
          const cachedUserJson = await SecureStore.getItemAsync(USER_KEY);
          if (cachedUserJson) {
            try {
              const cachedUser = JSON.parse(cachedUserJson) as MobileUser;
              if (cachedUser.id) {
                hadCachedUser = true;
                setUser(cachedUser);
                setStatus('authenticated');
                cacheUserId.current = cachedUser.id;
              }
            } catch {
              await SecureStore.deleteItemAsync(USER_KEY);
            }
          }
          await loadUser(token);
        }
        else setStatus('anonymous');
      } catch (restoreError) {
        if (!active) return;
        // Keep a previously validated local session when the server is temporarily unreachable.
        if (!hadCachedUser) {
          setStatus('anonymous');
          setError(errorMessage(restoreError));
        }
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
    const oldUserId = user?.id;
    clearResponseCache();
    if (oldUserId) {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(`${DATA_CACHE_PREFIX}${oldUserId}:`)));
    }
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
    setError(null);
    setStatus('anonymous');
  }, [clearResponseCache, user?.id]);

  const getCachedJson = useCallback(async <T,>(path: string): Promise<T | null> => {
    const currentUserId = user?.id;
    if (!currentUserId) return null;
    try {
      if (API_BASE_URL) {
        const key = `${currentUserId}:${new URL(path, `${API_BASE_URL}/`).toString()}`;
        const cached = responseCache.current.get(key);
        if (cached && Date.now() - cached.savedAt <= MEMORY_CACHE_MAX_AGE) {
          return await cached.response.clone().json() as T;
        }
      }
      const raw = await AsyncStorage.getItem(`${DATA_CACHE_PREFIX}${currentUserId}:${path}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { savedAt?: number; data?: T };
      if (!parsed.savedAt || Date.now() - parsed.savedAt > 30 * 24 * 60 * 60_000) return null;
      return parsed.data ?? null;
    } catch {
      return null;
    }
  }, [user?.id]);

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
    if (cached && cacheDirective !== 'reload' && cached.expiresAt > now) return cached.response.clone();
    if (cached && now - cached.savedAt > MEMORY_CACHE_MAX_AGE) responseCache.current.delete(key);
    const canShare = canCache && !fetchOptions.signal;
    if (canShare) {
      const pending = pendingRequests.current.get(key);
      if (pending) return (await pending).clone();
    }

    const generation = cacheGeneration.current;
    const request = fetch(url.toString(), { ...fetchOptions, headers });
    if (canShare) pendingRequests.current.set(key, request);
    try {
      const response = await request;
      if (method !== 'GET' && response.ok) {
        // Health uploads send several packages. Only the final package changes the views
        // that an open dashboard needs to refresh.
        let invalidated: string[] | null = null;
        if (url.pathname === '/api/mobile/health/sync') {
          const result = await response.clone().json().catch(() => null) as { syncedAt?: string | null } | null;
          invalidated = result?.syncedAt ? ['/api/mobile/health/', '/api/coach/', '/api/mobile/dashboard', '/api/mobile/arena', '/api/trophies'] : [];
        }
        if (invalidated === null || invalidated.length) {
          cacheGeneration.current += 1;
          pendingRequests.current.clear();
          for (const [cacheKey, value] of responseCache.current) {
            if (invalidated === null || invalidated.some(prefix => cacheKey.includes(`${url.origin}${prefix}`))) value.expiresAt = 0;
          }
        }
      }
      if (canCache && response.ok && generation === cacheGeneration.current) {
        responseCache.current.set(key, { response: response.clone(), savedAt: Date.now(), expiresAt: Date.now() + cacheTtlForPath(url.pathname) });
        if (responseCache.current.size > 100) {
          const oldestKey = responseCache.current.keys().next().value;
          if (oldestKey) responseCache.current.delete(oldestKey);
        }
        const persistentCachePath = url.pathname === '/api/mobile/dashboard' || url.pathname === '/api/mobile/arena' || url.pathname === '/api/arena/territories';
        if (persistentCachePath && user?.id) {
          void response.clone().json().then(async (data) => {
            const storageKey = `${DATA_CACHE_PREFIX}${user.id}:${path}`;
            await AsyncStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), data }));
            const keys = await AsyncStorage.getAllKeys();
            const ownKeys = keys.filter((item) => item.startsWith(`${DATA_CACHE_PREFIX}${user.id}:`));
            if (ownKeys.length > 12) await AsyncStorage.multiRemove(ownKeys.slice(0, ownKeys.length - 12));
          }).catch(() => undefined);
        }
      }
      return response;
    } finally {
      if (pendingRequests.current.get(key) === request) pendingRequests.current.delete(key);
    }
  }, [clearResponseCache, user?.id]);

  const deleteAccount = useCallback(async () => {
    const response = await apiFetch('/api/mobile/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Das Konto konnte nicht gelöscht werden.');
    clearResponseCache();
    const oldUserId = user?.id;
    if (oldUserId) {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(`${DATA_CACHE_PREFIX}${oldUserId}:`)));
    }
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
    setError(null);
    setStatus('anonymous');
  }, [apiFetch, clearResponseCache, user?.id]);

  return (
    <AuthContext.Provider value={{ status, user, error, login, logout, deleteAccount, apiFetch, getCachedJson }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth muss innerhalb des AuthProvider verwendet werden.');
  return context;
}
