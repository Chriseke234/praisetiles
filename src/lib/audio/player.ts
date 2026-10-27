/**
 * Audio Playback and Clock Engine for PraiseTiles
 * Rule version: 1.0.0
 * 
 * Provides decoupled, millisecond-accurate audio clock synchronized with Web Audio API.
 * Adheres strictly to browser autoplay policies: only begins playback upon explicit user action.
 */

export class GameAudioPlayer {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startAudioCtxTime: number = 0;
  private pauseOffset: number = 0;
  private isPlaying: boolean = false;
  private onEndedCallback: (() => void) | null = null;
  private volume: number = 0.8;

  constructor() {
    // AudioContext will be lazily initialized on user gesture
  }

  /**
   * Initializes or resumes the AudioContext after user interaction.
   */
  public async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public setBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  public getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * Starts playback from offset (default 0s).
   * Guaranteed to adhere to user gesture requirements.
   */
  public async play(offset: number = 0, onEnded?: () => void): Promise<void> {
    if (!this.buffer) {
      throw new Error('No audio buffer loaded to play.');
    }

    const ctx = await this.ensureContext();
    this.stop(); // Stop any active playback node

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(this.volume, ctx.currentTime);
    this.gainNode.connect(ctx.destination);

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.connect(this.gainNode);

    this.onEndedCallback = onEnded || null;
    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      }
    };

    const startAt = ctx.currentTime;
    this.startAudioCtxTime = startAt;
    this.pauseOffset = offset;
    this.sourceNode.start(startAt, offset);
    this.isPlaying = true;
  }

  /**
   * Stops audio playback and disconnects nodes.
   */
  public stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Node may already be stopped
      }
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.pauseOffset = 0;
  }

  /**
   * Returns exact audio position in seconds, decoupled from React state or frame rendering.
   */
  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.pauseOffset;
    }
    const elapsed = this.ctx.currentTime - this.startAudioCtxTime;
    return Math.max(0, this.pauseOffset + elapsed);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getDuration(): number {
    return this.buffer ? this.buffer.duration : 0;
  }
}
