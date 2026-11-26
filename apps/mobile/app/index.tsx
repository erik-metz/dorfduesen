import { Redirect } from 'expo-router';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';

export default function IndexScreen() {
  const { status, error, accessNotice, login } = useAuth();

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
      <Image source={require('../store-assets/icons/app-icon-1024.png')} style={styles.mark} accessibilityLabel="Dorfdüsen Runclub-Logo" />
      <Text style={styles.eyebrow}>RUNCLUB NORDHEIM</Text>
      <Text style={styles.title}>Dorfdüsen</Text>
      <Text style={styles.copy}>Melde dich mit Strava an, um dein Dashboard und die Düsen-Arena zu öffnen.</Text>
      {accessNotice === 'pending' ? (
        <View accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeTitle}>Wir prüfen deine Anfrage</Text>
          <Text style={styles.noticeText}>Danke für dein Interesse! Die App ist nur für Mitglieder der Dorfdüsen. Ein Admin schaut sich deine Anfrage gleich an. Sobald du freigeschaltet bist, meldest du dich hier einfach noch einmal mit Strava an.</Text>
        </View>
      ) : accessNotice === 'rejected' ? (
        <View accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeTitle}>Noch kein Zugang</Text>
          <Text style={styles.noticeText}>Die App ist nur für Mitglieder der Dorfdüsen, und dein Zugang ist gerade nicht freigeschaltet. Du läufst bei uns mit? Dann sprich uns beim nächsten Lauf an.</Text>
        </View>
      ) : null}
      {error && !accessNotice ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => void login()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{accessNotice === 'pending' ? 'Erneut anmelden' : 'Mit Strava anmelden'}</Text>
      </Pressable>
      <Text style={styles.hint}>Die Anmeldung erfolgt sicher über Strava. Deine Strava-Zugangsdaten werden nicht von der App gespeichert.</Text>
      <View style={styles.links}><Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://dorfduesen.de/datenschutz')}><Text style={styles.link}>Datenschutz</Text></Pressable><Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://dorfduesen.de/support')}><Text style={styles.link}>Support</Text></Pressable></View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#09090b' },
  page: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#09090b' },
  mark: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', marginBottom: 28 },
  eyebrow: { color: '#fc7a3d', fontSize: 11, fontWeight: '800', letterSpacing: 2.4, marginBottom: 8 },
  title: { color: '#fafafa', fontSize: 38, fontWeight: '900', letterSpacing: -1.2 },
  copy: { color: '#a1a1aa', fontSize: 16, lineHeight: 24, marginTop: 14, marginBottom: 30 },
  button: { alignItems: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: '#fc5200', opacity: 0.75 },
  pressed: { opacity: 0.9 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  notice: { borderWidth: 1, borderColor: 'rgba(252,122,61,0.35)', backgroundColor: 'rgba(252,82,0,0.1)', borderRadius: 14, padding: 16, marginBottom: 16, gap: 6 },
  noticeTitle: { color: '#fdba74', fontSize: 16, fontWeight: '800' },
  noticeText: { color: '#e4e4e7', fontSize: 14, lineHeight: 21 },
  error: { color: '#fca5a5', fontSize: 13, lineHeight: 19, marginBottom: 12, textAlign: 'center' },
  hint: { color: '#71717a', fontSize: 12, lineHeight: 18, marginTop: 14, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 26 },
  link: { color: '#fb923c', fontSize: 12, textDecorationLine: 'underline' },
  muted: { color: '#a1a1aa', fontSize: 14 },
});
