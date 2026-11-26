import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

// Expo rate-limits update checks; foregrounding more often than this reuses the last result.
const CHECK_INTERVAL_MS = 15 * 60_000;

function formatStamp(date: Date) {
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

/** Human-readable version: store version, native build and the OTA update the app is running. */
export function appVersionLabel(short = true) {
  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '?';
  const build = Constants.nativeBuildVersion;
  const base = build ? `${version} (${build})` : version;
  if (__DEV__ || !Updates.isEnabled) return `${base} · Dev`;
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return `${base} · Store`;
  const stamp = formatStamp(Updates.createdAt);
  return short ? `${base} · ${stamp}` : `${base} · Update ${stamp} · ${Updates.updateId?.slice(0, 8) ?? ''}`;
}

async function checkAndDownload() {
  const check = await Updates.checkForUpdateAsync();
  if (check.isAvailable) await Updates.fetchUpdateAsync();
  return check.isAvailable;
}

/** Small version label for the screen header; tap shows details and checks for an update. */
export function AppVersionBadge() {
  const [checking, setChecking] = useState(false);
  const showDetails = async () => {
    if (__DEV__ || !Updates.isEnabled) { Alert.alert('App-Version', appVersionLabel(false)); return; }
    setChecking(true);
    try {
      const found = await checkAndDownload();
      // A found update raises the banner; only report when nothing new exists.
      if (!found) Alert.alert('App-Version', `${appVersionLabel(false)}\n\nDu hast die neueste Version.`);
    } catch {
      Alert.alert('App-Version', `${appVersionLabel(false)}\n\nUpdate-Prüfung gerade nicht möglich.`);
    } finally { setChecking(false); }
  };
  return <Pressable onPress={showDetails} hitSlop={10} accessibilityRole="button" accessibilityLabel={`App-Version ${appVersionLabel()}. Tippen, um nach Updates zu suchen.`} style={styles.badge}>
    {checking ? <ActivityIndicator size="small" color="#71717a" /> : <Text style={styles.badgeText}>{appVersionLabel()}</Text>}
  </Pressable>;
}

/** Slides in from the top once a new update has been downloaded and applies it on tap. */
export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { isUpdateAvailable, isUpdatePending, isDownloading, isRestarting } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const lastCheck = useRef(0);
  const [offset] = useState(() => new Animated.Value(-200));

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const check = () => {
      if (Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
      lastCheck.current = Date.now();
      void checkAndDownload().catch(() => undefined);
    };
    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      setDismissed(false);
      check();
    });
    return () => subscription.remove();
  }, []);

  // An update found at launch is downloaded automatically; one found by a check is fetched here.
  useEffect(() => {
    if (isUpdateAvailable && !isUpdatePending && !isDownloading) void Updates.fetchUpdateAsync().catch(() => undefined);
  }, [isDownloading, isUpdateAvailable, isUpdatePending]);

  const visible = isUpdatePending && !dismissed;
  useEffect(() => {
    Animated.spring(offset, { toValue: visible ? 0 : -200, useNativeDriver: true, bounciness: 4 }).start();
  }, [offset, visible]);

  const apply = async () => {
    setApplying(true);
    try { await Updates.reloadAsync(); } catch {
      setApplying(false);
      Alert.alert('Update', 'Das Update konnte nicht angewendet werden. Bitte die App neu starten.');
    }
  };

  return <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={[styles.bannerWrap, { paddingTop: insets.top + 6, transform: [{ translateY: offset }] }]}>
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>Neue Version verfügbar</Text>
        <Text style={styles.bannerText}>Tippe auf Aktualisieren, die App lädt kurz neu.</Text>
      </View>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityRole="button" style={styles.later}>
        <Text style={styles.laterText}>Später</Text>
      </Pressable>
      <Pressable onPress={apply} disabled={applying || isRestarting} accessibilityRole="button" style={styles.update}>
        {applying || isRestarting ? <ActivityIndicator size="small" color="#09090b" /> : <Text style={styles.updateText}>Aktualisieren</Text>}
      </Pressable>
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 12, minHeight: 24, justifyContent: 'center' },
  badgeText: { color: '#71717a', fontSize: 10, fontVariant: ['tabular-nums'] },
  bannerWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, zIndex: 1000, elevation: 1000 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#18181b', borderColor: '#fc7a3d', borderWidth: 1, borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  bannerCopy: { flex: 1 },
  bannerTitle: { color: '#fafafa', fontWeight: '700', fontSize: 15 },
  bannerText: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
  later: { paddingVertical: 8, paddingHorizontal: 4 },
  laterText: { color: '#a1a1aa', fontSize: 13 },
  update: { backgroundColor: '#fc7a3d', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, minWidth: 108, alignItems: 'center' },
  updateText: { color: '#09090b', fontWeight: '700', fontSize: 13 },
});
