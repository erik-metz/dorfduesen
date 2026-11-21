const maximumRecordingMs = 30000;
const sampleRate = 16000;

export async function recordDictation(signal: AbortSignal, onRecording: (stop: () => void) => void) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || typeof OfflineAudioContext === 'undefined') {
    throw new Error('Lokale Spracheingabe braucht einen Browser mit Mikrofonzugriff und Audioaufnahme.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const closeMic = () => stream.getTracks().forEach(track => track.stop());

  try {
    signal.throwIfAborted();
    return await new Promise<Blob>((resolve, reject) => {
      const recorder = new MediaRecorder(stream);
      const parts: Blob[] = [];
      function cleanup() {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        closeMic();
      }
      function stop() {
        if (recorder.state !== 'inactive') recorder.stop();
      }
      function cancel() {
        stop();
        cleanup();
        reject(signal.reason);
      }
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      recorder.onerror = () => {
        cleanup();
        reject(new Error('Die Mikrofonaufnahme wurde unterbrochen.'));
      };
      recorder.onstop = () => {
        cleanup();
        resolve(new Blob(parts, { type: recorder.mimeType }));
      };
      recorder.start();
      signal.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(stop, maximumRecordingMs);
      onRecording(stop);
    });
  } finally {
    closeMic();
  }
}

export async function decodeDictation(blob: Blob) {
  if (!blob.size) return undefined;
  const context = new OfflineAudioContext(1, 1, sampleRate);
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  const samples = decoded.getChannelData(0);
  return samples.some(sample => Math.abs(sample) > 0.004) ? samples : undefined;
}
