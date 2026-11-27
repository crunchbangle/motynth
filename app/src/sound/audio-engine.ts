// The app's audio output: one AudioContext, created on first use (browsers
// only allow sound after the user has interacted with the page).

import { WaveBufferCache } from './buffers.ts';

/** What the player needs from the audio output; tests pass a fake. */
export interface AudioOutput {
  readonly buffers: WaveBufferCache;
  /** Makes sure audio is running, and returns where to send sound. */
  open(): { context: BaseAudioContext; destination: AudioNode };
}

const WAVEFORM_SIZE = 512;

type AudioContextConstructor = new () => AudioContext;

export class AudioEngine implements AudioOutput {
  readonly buffers = new WaveBufferCache();
  private graph: { context: AudioContext; master: GainNode; analyser: AnalyserNode } | null = null;

  open(): { context: AudioContext; destination: AudioNode } {
    const graph = this.graph ?? (this.graph = createGraph());
    if (graph.context.state === 'suspended') void graph.context.resume();
    return { context: graph.context, destination: graph.master };
  }

  /** How many samples readWaveform fills. */
  get waveformSize(): number {
    return WAVEFORM_SIZE;
  }

  /**
   * Fills `target` with the latest output samples, as bytes where 128 is
   * silence. Returns false (and leaves `target` alone) before audio starts.
   */
  readWaveform(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.graph) return false;
    this.graph.analyser.getByteTimeDomainData(target);
    return true;
  }
}

/** master → compressor → analyser → speakers */
function createGraph() {
  const Context =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext: AudioContextConstructor }).webkitAudioContext;
  const context = new Context();

  const master = context.createGain();
  master.gain.value = 0.9;

  // Gentle compression keeps chords and stacked layers from clipping.
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;

  const analyser = context.createAnalyser();
  analyser.fftSize = WAVEFORM_SIZE;

  master.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(context.destination);
  return { context, master, analyser };
}
