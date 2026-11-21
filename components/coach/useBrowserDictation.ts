import { useEffect, useRef, useState } from 'react';
import { decodeDictation, recordDictation } from './browser-dictation-audio';

type Recognition = EventTarget & {
  lang: string;
  processLocally: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = {
  new(): Recognition;
  available?: (options: { langs: string[]; processLocally: true }) => Promise<string>;
};

const locale = 'de-DE';
const noSpeech = 'Ich habe keine Sprache erkannt. Versuche es erneut.';
const microphoneDenied = 'Erlaube dieser Website den Mikrofonzugriff in den Browser-Einstellungen.';
const localError = 'Die lokale Spracherkennung konnte nicht gestartet werden. Prüfe deine Verbindung und versuche es erneut.';

async function nativeRecognition() {
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!Constructor?.available) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const available = await Promise.race([
      Constructor.available({ langs: [locale], processLocally: true }),
      new Promise<string>(resolve => { timer = setTimeout(() => resolve('unavailable'), 1500); }),
    ]);
    if (available !== 'available') return undefined;
    const recognition = new Constructor();
    if (!('processLocally' in recognition)) return undefined;
    recognition.lang = locale;
    recognition.processLocally = true;
    recognition.interimResults = true;
    return recognition;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export function useBrowserDictation(onFinal: (text: string) => void) {
  const session = useRef<AbortController | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const worker = useRef<Worker | null>(null);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    function cancel() {
      session.current?.abort();
      session.current = null;
      stop.current = null;
      worker.current?.terminate();
      worker.current = null;
    }
    function handleVisibility() {
      if (!document.hidden || !session.current) return;
      cancel();
      setListening(false);
      setStarting(false);
      setInterim('');
      setMessage('');
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      cancel();
    };
  }, []);

  async function toggle() {
    if (stop.current) {
      stop.current();
      return;
    }
    if (session.current) return;

    const controller = new AbortController();
    const { signal } = controller;
    session.current = controller;
    setStarting(true);
    setMessage('');

    function finish(text = '', notice = '') {
      if (signal.aborted || session.current !== controller) return;
      session.current = null;
      stop.current = null;
      setListening(false);
      setStarting(false);
      setInterim('');
      setMessage(notice);
      if (text.trim()) onFinal(text);
    }

    async function fallback() {
      try {
        const blob = await recordDictation(signal, stopRecording => {
          stop.current = stopRecording;
          setStarting(false);
          setListening(true);
          setMessage('');
        });
        signal.throwIfAborted();
        stop.current = null;
        setListening(false);
        setStarting(true);
        setMessage('Diktat wird auf deinem Gerät verarbeitet …');
        const samples = await decodeDictation(blob);
        signal.throwIfAborted();
        if (!samples) {
          finish('', noSpeech);
          return;
        }

        const engine = worker.current ?? new Worker(new URL('./local-dictation.worker.ts', import.meta.url));
        worker.current = engine;
        const timeout = setTimeout(fail, 120000);

        function cleanup() {
          clearTimeout(timeout);
          signal.removeEventListener('abort', cleanup);
          engine.onmessage = null;
          engine.onerror = null;
        }
        function fail() {
          cleanup();
          engine.terminate();
          worker.current = null;
          finish('', localError);
        }
        signal.addEventListener('abort', cleanup, { once: true });
        engine.onmessage = ({ data }) => {
          if (data.type === 'loading') setMessage('Das Sprachmodell wird geladen und für weitere Diktate im Browser gespeichert …');
          if (data.type === 'recognizing') setMessage('Diktat wird auf deinem Gerät verarbeitet …');
          if (data.type === 'result') {
            cleanup();
            finish(data.text, data.text ? '' : noSpeech);
          }
          if (data.type === 'error') fail();
        };
        engine.onerror = fail;
        try {
          engine.postMessage(samples, [samples.buffer]);
        } catch {
          fail();
        }
      } catch (error) {
        if (signal.aborted) return;
        const name = (error as Error | undefined)?.name;
        finish('', name === 'NotAllowedError' ? microphoneDenied
          : name === 'NotFoundError' ? 'Es wurde kein Mikrofon gefunden.'
          : error instanceof Error && error.message.startsWith('Lokale Spracheingabe') ? error.message : localError);
      }
    }

    const recognition = await nativeRecognition();
    if (signal.aborted) return;
    if (!recognition) {
      await fallback();
      return;
    }

    let transcript = '';
    let error = '';
    const abort = () => recognition.abort();
    signal.addEventListener('abort', abort, { once: true });
    recognition.onresult = event => {
      if (signal.aborted) return;
      transcript = Array.from(event.results, item => item[0].transcript).join(' ');
      setInterim(transcript);
    };
    recognition.onerror = event => { error = event.error; };
    recognition.onend = () => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) return;
      if (error === 'not-allowed' || error === 'audio-capture') {
        finish('', error === 'not-allowed' ? microphoneDenied : 'Es wurde kein Mikrofon gefunden.');
      } else if (error && error !== 'no-speech' && error !== 'aborted') {
        stop.current = null;
        setInterim('');
        setListening(false);
        setStarting(true);
        void fallback();
      } else {
        finish(transcript, transcript ? '' : noSpeech);
      }
    };

    try {
      recognition.start();
      stop.current = () => recognition.stop();
      setListening(true);
      setStarting(false);
    } catch {
      signal.removeEventListener('abort', abort);
      await fallback();
    }
  }

  return { listening, starting, interim, message, toggle };
}
