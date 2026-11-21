import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { ExpoSpeechRecognitionModule as speech, useSpeechRecognitionEvent } from 'expo-speech-recognition';

const locale = 'de-DE';
const fallback = 'Lokale Spracheingabe ist hier nicht verfügbar. Du kannst die Diktierfunktion deiner Tastatur verwenden.';

export function useCoachDictation(enabled: boolean, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState('');
  const [canDownload, setCanDownload] = useState(false);
  const [needsSettings, setNeedsSettings] = useState(false);
  const session = useRef<symbol | null>(null);
  const recording = useRef(false);
  const lastTranscript = useRef('');

  async function openSettings() {
    try {
      await Linking.openSettings();
    } catch {
      setMessage('Öffne die Systemeinstellungen und erlaube Dorfdüsen den Zugriff auf das Mikrofon.');
    }
  }

  function showSettings() {
    setNeedsSettings(true);
    setMessage('Erlaube Dorfdüsen den Mikrofonzugriff. Tippe danach erneut auf das Mikrofon.');
    void openSettings();
  }

  useSpeechRecognitionEvent('result', event => {
    if (!recording.current) return;
    const text = event.results[0]?.transcript ?? '';
    lastTranscript.current = text;
    if (event.isFinal) {
      onFinal(text);
      lastTranscript.current = '';
      setInterim('');
    } else setInterim(text);
  });

  useSpeechRecognitionEvent('error', event => {
    if (!recording.current || event.error === 'aborted') return;
    if (event.error === 'language-not-supported' && Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      setCanDownload(true);
      setMessage('Für Deutsch ist möglicherweise ein Offline-Sprachpaket erforderlich.');
    } else if (event.error === 'not-allowed') {
      showSettings();
    } else if (event.error !== 'no-speech') {
      setMessage(fallback);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (!recording.current) return;
    recording.current = false;
    session.current = null;
    if (lastTranscript.current) onFinal(lastTranscript.current);
    lastTranscript.current = '';
    setInterim('');
    setListening(false);
  });

  useEffect(() => {
    function cancel(updateState: boolean) {
      session.current = null;
      lastTranscript.current = '';
      if (recording.current) {
        recording.current = false;
        speech.abort();
      }
      if (updateState) {
        setInterim('');
        setListening(false);
        setStarting(false);
      }
    }
    if (!enabled) cancel(true);
    const state = AppState.addEventListener('change', value => {
      if (value === 'background') cancel(true);
    });
    return () => { state.remove(); cancel(false); };
  }, [enabled]);

  async function toggle() {
    if (recording.current) {
      speech.stop();
      return;
    }
    if (!enabled || session.current) return;
    const attempt = Symbol();
    session.current = attempt;
    setStarting(true);
    setMessage('');
    setCanDownload(false);
    setNeedsSettings(false);
    try {
      // The installed native recognizer only uses the on-device Android service on API 33+.
      if (Platform.OS === 'web' || (Platform.OS === 'android' && Number(Platform.Version) < 33)
          || !speech.supportsOnDeviceRecognition()) {
        setMessage(fallback);
        return;
      }
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const locales = await speech.getSupportedLocales({}).catch(() => null);
        if (session.current !== attempt) return;
        const isGerman = (value: string) => /^de(?:[-_]DE)?$/i.test(value);
        if (locales?.locales.some(isGerman) && !locales.installedLocales.some(isGerman)) {
          setCanDownload(true);
          setMessage('Lade Deutsch für die lokale Spracheingabe herunter.');
          return;
        }
      }
      const permission = await speech.requestMicrophonePermissionsAsync();
      if (session.current !== attempt) return;
      if (!permission.granted) {
        if (permission.canAskAgain) {
          setMessage('Erlaube Dorfdüsen den Mikrofonzugriff, um zu diktieren.');
        } else {
          showSettings();
        }
        return;
      }
      recording.current = true;
      setListening(true);
      speech.start({ lang: locale, interimResults: true, requiresOnDeviceRecognition: true });
    } catch {
      if (session.current === attempt) {
        recording.current = false;
        setListening(false);
        setMessage(fallback);
      }
    } finally {
      if (session.current === attempt) {
        if (!recording.current) session.current = null;
        setStarting(false);
      }
    }
  }

  async function download() {
    setCanDownload(false);
    try {
      const result = await speech.androidTriggerOfflineModelDownload({ locale });
      setMessage(result.status === 'download_success'
        ? 'Deutsch ist bereit. Tippe erneut auf das Mikrofon.'
        : 'Wenn der Download abgeschlossen ist, tippe erneut auf das Mikrofon.');
    } catch {
      setMessage(fallback);
    }
  }

  return { listening, starting, interim, message, canDownload, needsSettings, toggle, download, openSettings };
}
