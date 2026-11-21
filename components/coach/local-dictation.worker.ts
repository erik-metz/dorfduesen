import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

const model = 'Xenova/whisper-tiny';
const revision = 'ae5208242db023d4ae9277955f54f07d01c2c3f7';
const createSpeechPipeline = pipeline as unknown as (
  task: 'automatic-speech-recognition', model: string, options: { revision: string; device: 'wasm'; dtype: 'q8' }
) => Promise<AutomaticSpeechRecognitionPipeline>;
let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | undefined;

env.allowLocalModels = false;
// One thread lets the worker run without cross-origin isolation.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

self.onmessage = async ({ data }: MessageEvent<Float32Array>) => {
  try {
    if (!recognizer) {
      self.postMessage({ type: 'loading' });
      recognizer = createSpeechPipeline('automatic-speech-recognition', model, { revision, device: 'wasm', dtype: 'q8' });
    }
    const transcribe = await recognizer;
    self.postMessage({ type: 'recognizing' });
    const result = await transcribe(data, { language: 'de', task: 'transcribe', max_new_tokens: 128 });
    self.postMessage({ type: 'result', text: (Array.isArray(result) ? result.map(chunk => chunk.text).join(' ') : result.text).trim() });
  } catch {
    recognizer = undefined;
    self.postMessage({ type: 'error' });
  }
};
