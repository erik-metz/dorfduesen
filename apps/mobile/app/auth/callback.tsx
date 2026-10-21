import { Link, Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';

export default function AuthCallbackScreen() {
  const { status, error } = useAuth();
  if (status === 'authenticated') return <Redirect href="/(tabs)/dashboard" />;
  return (
    <View style={styles.page}>
      {status === 'loading' ? <ActivityIndicator color="#fc5200" /> : null}
      <Text style={styles.title}>{status === 'loading' ? 'Anmeldung wird abgeschlossen …' : 'Anmeldung fehlgeschlagen'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {status === 'anonymous' ? <Link href="/" asChild><Pressable style={styles.button}><Text style={styles.buttonText}>Zurück zum Login</Text></Pressable></Link> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#09090b' },
  title: { color: '#fafafa', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  error: { color: '#fca5a5', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: { marginTop: 8, borderRadius: 12, backgroundColor: '#fc5200', paddingHorizontal: 18, paddingVertical: 13 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
