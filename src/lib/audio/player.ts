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
   * Hardened for Apple Safari on iPhone, iPad, and macOS:
   * - Supports both window.AudioContext and webkitAudioContext
   * - Resumes from both 'suspended' and iOS 'interrupted' states
   * - Plays a 1-sample silent buffer to unlock the hardware audio pipeline
   */
  public async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }

    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      try {
        await this.ctx.resume();
      } catch {
        // Fallback for strict browser policies
      }
    }

    // iOS Safari audio unlock: play 1-sample zero-gain buffer on user gesture
    try {
      const unlockBuffer = this.ctx.createBuffer(1, 1, 22050);
      const unlockSource = this.ctx.createBufferSource();
      unlockSource.buffer = unlockBuffer;
      unlockSource.connect(this.ctx.destination);
      unlockSource.start(0);
    } catch {
      // Non-blocking
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

    // Set pauseOffset immediately so getCurrentTime() never snaps to 0 while context resumes
    this.pauseOffset = offset;
    const ctx = await this.ensureContext();
    this.stop(); // Stop any active playback node
    this.pauseOffset = offset;

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
   * Pauses audio playback and stores current playback position.
   */
  public pause(): number {
    if (!this.isPlaying) return this.pauseOffset;
    const current = this.getCurrentTime();
    this.pauseOffset = current;
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
    return this.pauseOffset;
  }

  /**
   * Resumes audio playback from current pauseOffset.
   */
  public async resume(onEnded?: () => void): Promise<void> {
    if (this.isPlaying) return;
    await this.play(this.pauseOffset, onEnded);
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
   * Compensates for WebAudio hardware output latency (baseLatency + outputLatency)
   * so tiles hit the receptor in lockstep with audible sound.
   */
  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.pauseOffset;
    }
    const elapsed = this.ctx.currentTime - this.startAudioCtxTime;
    const ctxWithLatency = this.ctx as AudioContext & { outputLatency?: number };
    const hardwareLatency = Math.min(
      0.25,
      Math.max(0, (ctxWithLatency.baseLatency || 0) + (ctxWithLatency.outputLatency || 0))
    );
    return Math.max(0, this.pauseOffset + Math.max(0, elapsed - hardwareLatency));
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getDuration(): number {
    return this.buffer ? this.buffer.duration : 0;
  }
}
