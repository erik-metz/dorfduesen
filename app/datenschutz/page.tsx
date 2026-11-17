import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzhinweise | Dorfdüsen',
  description: 'Datenschutzhinweise zur Dorfdüsen-App und den dazugehörigen Diensten.',
};

const sections = 'space-y-3 text-sm leading-7 text-zinc-300';
const heading = 'pt-5 text-lg font-bold text-white';

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <a href="/" className="text-sm font-semibold text-orange-400">← Dorfdüsen Nordheim</a>
      <h1 className="mt-7 text-3xl font-black tracking-tight text-white">Datenschutzhinweise</h1>
      <p className="mt-3 text-sm text-zinc-400">Stand: 17. November 2026 · Dorfdüsen iOS-App und zugehörige App-Dienste</p>

      <section className={sections}>
        <h2 className={heading}>Verantwortlicher</h2>
        <p>Erik Metz<br />Schleegasse 7<br />68647 Biblis<br />Deutschland</p>
        <p>Datenschutz- und Supportanfragen: <a className="text-orange-400 underline" href="mailto:metzmade@pm.me">metzmade@pm.me</a></p>

        <h2 className={heading}>Welche Daten verarbeitet werden</h2>
        <p>Für Konto und Anmeldung verarbeitet Dorfdüsen deine Strava-Athleten-ID, deinen Strava-Namen und – soweit von Strava bereitgestellt – Profilbild, Ort und Land. Der Server speichert Strava-Aktivitäten und für die App benötigte Details, zum Beispiel Sportart, Zeit, Distanz, Höhenmeter, Tempo, Herzfrequenz und verfügbare Strecken- oder Aktivitätsdetails.</p>
        <p>Wenn du Profil- und Coach-Funktionen nutzt, verarbeitet die App deine Eingaben und daraus berechnete Trainingswerte, etwa Wochenziele, Trainingspläne, Pace- und Herzfrequenzbereiche sowie Trainingshistorie. Dazu können auch von dir angegebene Körper- und Gesundheitswerte gehören.</p>
        <p>Die optionale Health-Verbindung kann – abhängig von Gerät, Systemfreigabe und deiner Auswahl – Workouts, Schritte, Distanzen, Energieverbrauch, Trainingszeit, Herzfrequenz, Ruhe- und Gehherzfrequenz, Herzratenvariabilität, Sauerstoffsättigung, Atemfrequenz, Körpergewicht, Körperfett, fettfreie Masse, VO₂max und Schlaf importieren. Apple Health oder Health Connect entscheidet über die Systemberechtigungen. Die Übertragung an Dorfdüsen erfordert zusätzlich deine Zustimmung in der App. Der Import startet nur auf deine aktive Anforderung.</p>
        <p>Für Anmeldung und Betrieb verarbeitet der Dienst außerdem App-Sitzungen, OAuth- und Synchronisierungsstatus sowie notwendige technische Fehler- und Betriebsinformationen.</p>

        <h2 className={heading}>Strava und Sichtbarkeit im Club</h2>
        <p>Die Anmeldung wird über Strava OAuth durchgeführt. Dorfdüsen fragt dein Strava-Passwort nicht ab. Der aktuelle OAuth-Aufruf fordert `read` und `activity:read_all` an. Strava-Zugriffs- und Aktualisierungstoken bleiben auf dem Server; die App-Sitzung wird auf dem Gerät geschützt gespeichert und läuft nach 30 Tagen ab.</p>
        <p>Angemeldete Mitglieder des Runclub Nordheim können in Clubansichten Namen, Profilbilder, Clubstatistiken, Ranglisten und Aktivitätsdetails anderer Mitglieder sehen. Dorfdüsen ist kein offizieller Strava-Dienst. Du kannst die Verbindung bei Strava widerrufen; bereits bei Dorfdüsen gespeicherte Daten werden dadurch nicht automatisch gelöscht.</p>

        <h2 className={heading}>Gesundheitsdaten</h2>
        <p>Health-Daten werden getrennt von Strava-Aktivitäten gespeichert und nicht an Clubmitglieder weitergegeben oder in Club-Ranglisten eingerechnet. Du kannst Health-Berechtigungen in den Geräteeinstellungen widerrufen und die Dorfdüsen-Verbindung in der App trennen. Das Stoppen der Verbindung löscht bereits importierte Daten nicht; dafür kannst du die Kontolöschung verwenden.</p>

        <h2 className={heading}>Zwecke und Rechtsgrundlagen</h2>
        <p>Für Konto, Anmeldung und die von dir genutzten App-Funktionen verarbeiten wir Daten zur Bereitstellung des Dienstes (Art. 6 Abs. 1 lit. b DSGVO). Für Sicherheit und technischen Betrieb stützen wir erforderliche Verarbeitungen auf berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO). Optionale Health-Daten werden nur nach deiner ausdrücklichen Einwilligung übertragen und verarbeitet (Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO). Du kannst eine Einwilligung für die Zukunft widerrufen; die Rechtmäßigkeit der vorherigen Verarbeitung bleibt davon unberührt.</p>

        <h2 className={heading}>Dienstleister und KI-Trainingscoach</h2>
        <p>Für Betrieb und Speicherung werden Vercel (Anwendungshosting), Neon (PostgreSQL-Datenbank) und Inngest (Hintergrundaufgaben) eingesetzt. Strava stellt die OAuth-Anmeldung und Aktivitätsdaten bereit. Wenn der KI-Trainingscoach verwendet wird, erhält xAI für die Planerstellung Trainingskennzahlen, Pace- und Herzfrequenzbereiche sowie Plan- und Zielangaben. Der Coach nutzt xAI, wenn der entsprechende Zugang aktiviert ist; andernfalls wird der Plan algorithmisch erstellt. xAI gibt an, API-Ein- und Ausgaben standardmäßig bis zu 30 Tage verschlüsselt für Sicherheits- und Missbrauchsprüfungen zu speichern, nicht zum Modelltraining zu verwenden und danach zu löschen. Eine teamweite Zero-Data-Retention-Einstellung kann diese Speicherung ändern.</p>
        <p>Vercel verarbeitet Daten primär in den USA und kann Daten auch in anderen Ländern verarbeiten; die Ausführungsregion von Serverfunktionen kann je Projekt festgelegt werden. Neon betreibt seine Datenbankinfrastruktur auf AWS und Azure; die konkrete Datenbankregion wird je Neon-Projekt ausgewählt. Inngest Cloud verarbeitet Ereignisse und Workflow-Daten in den USA. Vercel, Neon und Inngest können technische Unterauftragnehmer einsetzen. Bei Übermittlungen außerhalb des EWR können je nach Anbieter und Vertrag geeignete Garantien wie EU-Standardvertragsklauseln gelten. Weiterführende Informationen: <a className="text-orange-400 underline" href="https://vercel.com/legal/dpa">Vercel DPA</a>, <a className="text-orange-400 underline" href="https://neon.tech/pdf/DPA.pdf">Neon DPA</a>, <a className="text-orange-400 underline" href="https://www.inngest.com/docs/platform-and-operations/cloud-architecture-and-security">Inngest Cloud-Architektur</a> und <a className="text-orange-400 underline" href="https://docs.x.ai/developers/faq/security">xAI API-Sicherheit</a>.</p>

        <h2 className={heading}>Speicherung und Kontolöschung</h2>
        <p>Kontodaten werden grundsätzlich für die Nutzung deines Dorfdüsen-Kontos gespeichert. Im App-Dashboard kannst du „Dorfdüsen-Konto löschen“ wählen und bestätigen. Dadurch werden dein Nutzerkonto und die daran geknüpften Strava-Tokens, Aktivitäten, Profil-, Trainingsplan-, Health-, Sitzungs- und zugehörigen App-Daten aus der aktiven Datenbank gelöscht. Die App versucht zusätzlich, den Strava-Token zu widerrufen.</p>
        <p>Gelöschte Daten können während eines noch laufenden Datenbank-Wiederherstellungsfensters in Änderungsverläufen oder aktivierten Snapshots fortbestehen. Bei Neon hängt das Fenster vom Tarif und der Projekteinstellung ab (laut Neon standardmäßig 6 Stunden im Free-Tarif und 1 Tag in bezahlten Tarifen; je nach Tarif sind längere Fenster möglich). Inngest bewahrt Workflow- und Ausführungsdaten für Wiederholungen und Verlauf auf; die Dauer des Protokollverlaufs richtet sich nach dem Tarif. Vercel hält Laufzeitprotokolle für einen begrenzten, tarifabhängigen Zeitraum vor. Anfragen zur Löschung oder Aufbewahrung: <a className="text-orange-400 underline" href="mailto:metzmade@pm.me">metzmade@pm.me</a>.</p>

        <h2 className={heading}>Deine Rechte und Beschwerde</h2>
        <p>Du kannst nach Maßgabe der Datenschutzgesetze Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit verlangen sowie einer Verarbeitung widersprechen oder eine Einwilligung widerrufen. Außerdem kannst du dich bei einer Datenschutzaufsichtsbehörde beschweren. Für Anfragen nutze bitte die oben genannte E-Mail-Adresse.</p>

        <h2 className={heading}>Kontakt und Änderungen</h2>
        <p>Bei Fragen zur App oder zu diesen Datenschutzhinweisen erreichst du Erik Metz unter <a className="text-orange-400 underline" href="mailto:metzmade@pm.me">metzmade@pm.me</a>. Aktualisierungen dieser Hinweise werden auf dieser Seite veröffentlicht.</p>
      </section>
      <footer className="mt-10 border-t border-zinc-800 pt-5 text-xs text-zinc-500"><a className="underline" href="/support">Support</a></footer>
    </main>
  );
}
