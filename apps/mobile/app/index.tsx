import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';

export default function IndexScreen() {
  const { status, error, login } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fc5200" />
        <Text style={styles.muted}>Sitzung wird geprüft …</Text>
      </View>
    );
  }

  if (status === 'authenticated') return <Redirect href="/(tabs)/dashboard" />;

  return (
    <View style={styles.page}>
      <View style={styles.mark}><Text style={styles.flame}>↗</Text></View>
      <Text style={styles.eyebrow}>RUNCLUB NORDHEIM</Text>
      <Text style={styles.title}>Dorfdüsen</Text>
      <Text style={styles.copy}>Melde dich mit Strava an, um dein Dashboard und die Düsen-Arena zu öffnen.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => void login()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Mit Strava anmelden</Text>
      </Pressable>
      <Text style={styles.hint}>Die Anmeldung erfolgt sicher über Strava. Deine Strava-Zugangsdaten werden nicht von der App gespeichert.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#09090b' },
  page: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#09090b' },
  mark: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fc520022', borderWidth: 1, borderColor: '#fc520055', marginBottom: 28 },
  flame: { color: '#fc5200', fontSize: 32, fontWeight: '900' },
  eyebrow: { color: '#fc7a3d', fontSize: 11, fontWeight: '800', letterSpacing: 2.4, marginBottom: 8 },
  title: { color: '#fafafa', fontSize: 38, fontWeight: '900', letterSpacing: -1.2 },
  copy: { color: '#a1a1aa', fontSize: 16, lineHeight: 24, marginTop: 14, marginBottom: 30 },
  button: { alignItems: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: '#fc5200', opacity: 0.75 },
  pressed: { opacity: 0.9 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  error: { color: '#fca5a5', fontSize: 13, lineHeight: 19, marginBottom: 12, textAlign: 'center' },
  hint: { color: '#71717a', fontSize: 12, lineHeight: 18, marginTop: 14, textAlign: 'center' },
  muted: { color: '#a1a1aa', fontSize: 14 },
});
