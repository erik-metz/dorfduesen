import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={styles.page}>
      <View style={styles.topRow}>
        <Text style={styles.greeting}>{user?.firstname ? `Moin, ${user.firstname}` : 'Willkommen zurück'}</Text>
        <Pressable accessibilityRole="button" onPress={() => void logout()}><Text style={styles.logout}>Abmelden</Text></Pressable>
      </View>
      <Text style={styles.kicker}>DEIN TRAINING</Text>
      <Text style={styles.heading}>Dashboard</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Deine Aktivitäten</Text>
        <Text style={styles.copy}>Deine Strava-Statistiken, Läufe und Fahrten erscheinen hier.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Diese Woche</Text>
        <Text style={styles.copy}>Wochenfortschritt und Arena-Highlights kommen hier zusammen.</Text>
      </View>
      <Text style={styles.note}>Dashboard-Grundgerüst · Daten folgen in den nächsten Schritten</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22, gap: 14, backgroundColor: '#09090b' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  greeting: { color: '#d4d4d8', fontSize: 14, fontWeight: '700' },
  logout: { color: '#a1a1aa', fontSize: 13, fontWeight: '700', padding: 8 },
  kicker: { color: '#fc7a3d', fontWeight: '800', letterSpacing: 1.8, fontSize: 11, marginTop: 12 },
  heading: { color: '#fafafa', fontSize: 30, fontWeight: '900', marginBottom: 8 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b', padding: 18, gap: 8 },
  cardTitle: { color: '#fafafa', fontSize: 16, fontWeight: '800' },
  copy: { color: '#a1a1aa', fontSize: 14, lineHeight: 21 },
  note: { color: '#71717a', fontSize: 12, marginTop: 6 },
});
