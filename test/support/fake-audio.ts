// A minimal stand-in for Web Audio, recording what the app schedules.
// It implements only what the sound code uses.

export class FakeParam {
  value = 0;
  readonly calls: [method: string, ...args: number[]][] = [];
  setValueAtTime(value: number, time: number) {
    this.calls.push(['setValueAtTime', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push(['linearRamp', value, time]);
  }
  setTargetAtTime(value: number, time: number, constant: number) {
    this.calls.push(['setTargetAtTime', value, time, constant]);
  }
  cancelScheduledValues(time: number) {
    this.calls.push(['cancel', time]);
  }
}

class FakeNode {
  readonly connections: FakeNode[] = [];
  disconnected = false;
  connect(node: FakeNode) {
    this.connections.push(node);
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
  constructor() {
    super();
    this.gain.value = 1;
  }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeParam();
  readonly detune = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  stopCalls = 0;
  onended: (() => void) | null = null;
  start(time: number) {
    this.startedAt = time;
  }
  stop(time?: number) {
    this.stopCalls++;
    if (time !== undefined) this.stoppedAt = time;
  }
}

export class FakeBuffer {
  readonly length: number;
  readonly sampleRate: number;
  private readonly data: Float32Array;
  constructor(length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData() {
    return this.data;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate: number;
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return new FakeBuffer(length, sampleRate);
  }
}

/** Use a fake where the real type is expected. */
export const asReal = <T>(fake: unknown): T => fake as T;
