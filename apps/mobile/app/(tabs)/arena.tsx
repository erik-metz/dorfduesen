import { StyleSheet, Text, View } from 'react-native';

export default function ArenaScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>RUNCLUB NORDHEIM</Text>
      <Text style={styles.heading}>Düsen-Arena</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gemeinsam unterwegs</Text>
        <Text style={styles.copy}>Team-Kennzahlen, Wochen-Champions und Challenge-Fortschritt werden hier angezeigt.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bestenliste</Text>
        <Text style={styles.copy}>Vergleiche später Lauf- und Radkilometer mit dem Club.</Text>
      </View>
      <Text style={styles.note}>Arena-Grundgerüst · Daten folgen in den nächsten Schritten</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 22, gap: 14, backgroundColor: '#09090b' },
  kicker: { color: '#fc7a3d', fontWeight: '800', letterSpacing: 1.8, fontSize: 11, marginTop: 12 },
  heading: { color: '#fafafa', fontSize: 30, fontWeight: '900', marginBottom: 8 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#27272a', backgroundColor: '#18181b', padding: 18, gap: 8 },
  cardTitle: { color: '#fafafa', fontSize: 16, fontWeight: '800' },
  copy: { color: '#a1a1aa', fontSize: 14, lineHeight: 21 },
  note: { color: '#71717a', fontSize: 12, marginTop: 6 },
});
