import { useEffect, useRef, useState } from 'react';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = EventTarget & {
  lang: string;
  processLocally: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type LocalOptions = { langs: string[]; processLocally: true };
type RecognitionConstructor = {
  new(): Recognition;
  available?: (options: LocalOptions) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  install?: (options: LocalOptions) => Promise<boolean>;
};
const locale = 'de-DE';
const options: LocalOptions = { langs: [locale], processLocally: true };
const fallback = 'Dein Browser bietet hier keine lokale Spracheingabe auf Deutsch. Du kannst die Diktierfunktion deines Geräts verwenden.';

function constructorForBrowser() {
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export function useBrowserDictation(onFinal: (text: string) => void) {
  const active = useRef<Recognition | null>(null);
  const attempt = useRef<symbol | null>(null);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState('');
  const [canDownload, setCanDownload] = useState(false);

  useEffect(() => {
    function cancel() {
      attempt.current = null;
      const recognizer = active.current;
      active.current = null;
      recognizer?.abort();
    }
    function handleVisibility() {
      if (!document.hidden) return;
      cancel();
      setListening(false);
      setStarting(false);
      setInterim('');
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      cancel();
    };
  }, []);

  async function toggle() {
    if (active.current) {
      active.current.stop();
      return;
    }
    if (attempt.current) return;

    const token = Symbol();
    attempt.current = token;
    setStarting(true);
    setMessage('');
    setCanDownload(false);
    try {
      const Constructor = constructorForBrowser();
      if (!Constructor?.available) {
        setMessage(fallback);
        return;
      }
      const available = await Constructor.available(options);
      if (attempt.current !== token) return;
      if (available !== 'available') {
        setCanDownload(available === 'downloadable' && Boolean(Constructor.install));
        setMessage(available === 'downloadable' ? 'Lade Deutsch für die lokale Spracheingabe herunter.'
          : available === 'downloading' ? 'Das deutsche Sprachpaket wird heruntergeladen.' : fallback);
        return;
      }

      const recognition = new Constructor();
      if (!('processLocally' in recognition)) {
        setMessage(fallback);
        return;
      }
      recognition.lang = locale;
      recognition.processLocally = true;
      recognition.interimResults = true;
      let transcript = '';
      let failed = false;
      recognition.onresult = event => {
        if (active.current !== recognition) return;
        transcript = Array.from(event.results, item => item[0].transcript).join(' ');
        setInterim(transcript);
      };
      recognition.onerror = event => {
        if (active.current !== recognition) return;
        failed = true;
        if (event.error === 'not-allowed') setMessage('Erlaube dem Browser den Zugriff auf das Mikrofon.');
        else if (event.error !== 'no-speech' && event.error !== 'aborted') setMessage(fallback);
      };
      recognition.onend = () => {
        if (active.current !== recognition) return;
        active.current = null;
        setListening(false);
        setInterim('');
        if (!failed && transcript) onFinal(transcript);
      };
      active.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      active.current = null;
      if (attempt.current === token) setMessage(fallback);
    } finally {
      if (attempt.current === token) {
        attempt.current = null;
        setStarting(false);
      }
    }
  }

  async function download() {
    const token = Symbol();
    attempt.current = token;
    setStarting(true);
    setCanDownload(false);
    try {
      const installed = await constructorForBrowser()?.install?.(options);
      if (attempt.current === token) setMessage(installed ? 'Deutsch ist bereit. Tippe erneut auf das Mikrofon.' : fallback);
    } catch {
      if (attempt.current === token) setMessage(fallback);
    } finally {
      if (attempt.current === token) {
        attempt.current = null;
        setStarting(false);
      }
    }
  }

  return { listening, starting, interim, message, canDownload, toggle, download };
}
