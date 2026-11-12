/**
 * YouTube IFrame Player Clock Engine for PraiseTiles
 * 
 * Provides decoupled, millisecond-accurate audio clock synchronized with
 * the official YouTube IFrame Player API.
 * Adheres strictly to browser autoplay policies & player states.
 */

import { PlayableAudioClock } from '@/types/game';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export class YouTubeAudioPlayer implements PlayableAudioClock {
  private player: any = null;
  private videoId: string | null = null;
  private isReady: boolean = false;
  private isPlaying: boolean = false;
  private duration: number = 0;
  private volume: number = 0.8;
  private onEndedCallback: (() => void) | null = null;
  private containerId: string = 'praisetiles-yt-player';

  // Clock interpolation
  private lastPolledTime: number = 0;
  private lastPolledTimestamp: number = 0;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(videoId?: string) {
    if (videoId) {
      this.videoId = videoId;
    }
  }

  public setVideoId(videoId: string): void {
    this.videoId = videoId;
  }

  public getVideoId(): string | null {
    return this.videoId;
  }

  /**
   * Satisfies PlayableAudioClock interface. Pre-initializes YouTube player if needed.
   */
  public async ensureContext(): Promise<void> {
    if (!this.player || !this.isReady) {
      await this.initialize();
    }
  }

  /**
   * Loads the YouTube IFrame API script if not already present on page.
   */
  public async loadYouTubeApi(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      return;
    }

    return new Promise<void>((resolve) => {
      const existingTag = document.getElementById('youtube-iframe-api');
      if (!existingTag) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      window.onYouTubeIframeAPIReady = () => {
        clearInterval(checkInterval);
        resolve();
      };
    });
  }

  /**
   * Initializes the YouTube player inside container element.
   */
  public async initialize(containerElementId?: string): Promise<void> {
    if (containerElementId) {
      this.containerId = containerElementId;
    }

    await this.loadYouTubeApi();

    return new Promise<void>((resolve, reject) => {
      try {
        let container = document.getElementById(this.containerId);
        if (!container) {
          container = document.createElement('div');
          container.id = this.containerId;
          container.style.position = 'fixed';
          container.style.top = '-9999px';
          container.style.left = '-9999px';
          container.style.width = '1px';
          container.style.height = '1px';
          container.style.opacity = '0';
          container.style.pointerEvents = 'none';
          document.body.appendChild(container);
        }

        this.player = new window.YT.Player(this.containerId, {
          height: '1',
          width: '1',
          videoId: this.videoId,
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            autoplay: 0,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: () => {
              this.isReady = true;
              this.duration = this.player.getDuration() || 0;
              this.player.setVolume(Math.round(this.volume * 100));
              resolve();
            },
            onStateChange: (event: any) => {
              // 0: ENDED, 1: PLAYING, 2: PAUSED, 3: BUFFERING
              if (event.data === 0) {
                this.isPlaying = false;
                this.stopPolling();
                if (this.onEndedCallback) {
                  this.onEndedCallback();
                }
              } else if (event.data === 1) {
                this.isPlaying = true;
                this.startPolling();
              } else if (event.data === 2) {
                this.isPlaying = false;
                this.stopPolling();
              }
            },
            onError: (err: any) => {
              console.warn('[YouTube Audio Player Error]', err);
              reject(err);
            },
          },
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Begins playback from offset (seconds).
   */
  public async play(offset: number = 0, onEnded?: () => void): Promise<void> {
    if (!this.player || !this.isReady) {
      await this.initialize();
    }

    this.onEndedCallback = onEnded || null;

    if (this.player) {
      if (offset > 0) {
        this.player.seekTo(offset, true);
      }
      this.player.playVideo();
      this.isPlaying = true;
      this.lastPolledTime = offset;
      this.lastPolledTimestamp = performance.now();
      this.startPolling();
    }
  }

  public pause(): number {
    if (!this.isPlaying || !this.player) return this.getCurrentTime();
    this.player.pauseVideo();
    this.isPlaying = false;
    this.stopPolling();
    return this.getCurrentTime();
  }

  public async resume(onEnded?: () => void): Promise<void> {
    if (this.isPlaying) return;
    if (onEnded) this.onEndedCallback = onEnded;
    if (this.player) {
      this.player.playVideo();
      this.isPlaying = true;
      this.lastPolledTimestamp = performance.now();
      this.startPolling();
    }
  }

  public stop(): void {
    if (this.player) {
      try {
        this.player.stopVideo();
      } catch {}
    }
    this.isPlaying = false;
    this.stopPolling();
    this.lastPolledTime = 0;
    this.lastPolledTimestamp = 0;
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollInterval = setInterval(() => {
      if (this.player && typeof this.player.getCurrentTime === 'function') {
        const time = this.player.getCurrentTime();
        if (typeof time === 'number' && !isNaN(time)) {
          this.lastPolledTime = time;
          this.lastPolledTimestamp = performance.now();
        }
      }
    }, 100);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Returns exact playback time in seconds with microsecond clock interpolation.
   */
  public getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.lastPolledTime;
    }
    const delta = (performance.now() - this.lastPolledTimestamp) / 1000;
    return Math.max(0, this.lastPolledTime + delta);
  }

  public getDuration(): number {
    if (this.player && typeof this.player.getDuration === 'function') {
      const dur = this.player.getDuration();
      if (dur > 0) this.duration = dur;
    }
    return this.duration;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(Math.round(this.volume * 100));
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public destroy(): void {
    this.stop();
    if (this.player && typeof this.player.destroy === 'function') {
      try {
        this.player.destroy();
      } catch {}
    }
    this.player = null;
    this.isReady = false;
  }
}
