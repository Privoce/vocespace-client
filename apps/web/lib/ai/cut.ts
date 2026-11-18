import type { CutScreenShot } from '@vocespace/domain/ai';
export type { CutScreenShot } from '@vocespace/domain/ai';
import { LocalParticipant, Track } from 'livekit-client';

/**
 * 裁剪截图单条信息
 */
export const newCutScreenShot = (data: string, showTime: boolean): CutScreenShot => {
  return {
    data,
    timestamp: Date.now(),
    showTime,
  };
};

export class AICutService {
  private intervalId: NodeJS.Timeout | null = null;
  private earlyCaptureId: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private screenshots: CutScreenShot[] = [];
  public isRunning: boolean = false;
  // default frequency: every 3 minutes
  public freq: number = 3;
  public timeline: boolean = false;
  public localParicipant: LocalParticipant | null = null;
  hasScreenShare(participant = this.localParicipant) {
    const publication = participant?.getTrackPublication(Track.Source.ScreenShare);
    const track = publication?.videoTrack?.mediaStreamTrack;
    return !!track && !publication?.isMuted && track.readyState === 'live' && !track.muted;
  }

  // Capture only the currently published local screen, never the meeting page.
  async captureFromChannel(onError?: (error: unknown) => void) {
    if (!this.hasScreenShare()) return null;
    const generation = this.generation;
    const track = this.localParicipant!.getTrackPublication(Track.Source.ScreenShare)!
      .videoTrack!.mediaStreamTrack;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([track]);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await video.play();
          if (video.readyState < 2) {
            await new Promise<void>((resolve) => { video.onloadeddata = () => resolve(); });
          }
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Screen frame timed out')), 5000);
        }),
      ]);
      if (generation !== this.generation || !this.hasScreenShare() ||
          this.localParicipant?.getTrackPublication(Track.Source.ScreenShare)?.videoTrack?.mediaStreamTrack !== track ||
          !video.videoWidth || !video.videoHeight) return null;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const shot = newCutScreenShot(canvas.toDataURL('image/jpeg', 0.6), this.timeline);
      this.screenshots.push(shot);
      return shot;
    } catch (error) {
      if (generation === this.generation) onError?.(error);
      return null;
    } finally {
      clearTimeout(timeout);
      video.onloadeddata = null;
      video.pause();
      video.srcObject = null;
    }
  }

  // start the AI cut service
  async start(
    freq: number,
    timeline: boolean,
    localParicipant: LocalParticipant,
    reload?: boolean,
    withAnalysis?: (screenShot: CutScreenShot) => Promise<void>,
    onSuccess?: () => void,
    onError?: (error: any) => void,
  ) {
    this.stop();
    if (reload) this.clearScreenshots();
    this.localParicipant = localParicipant;
    if (!this.hasScreenShare()) {
      onError?.(new Error('Screen sharing is required'));
      return;
    }
    this.freq = Math.max(0.5, freq || 3);
    this.timeline = timeline;
    this.isRunning = true;
    const generation = this.generation;
    let busy = false;
    const captureAndAnalyze = async () => {
      if (busy || !this.isRunning || generation !== this.generation) return;
      if (!this.hasScreenShare()) { this.stop(); return; }
      busy = true;
      try {
        const shot = await this.captureFromChannel(onError);
        if (shot && this.isRunning && generation === this.generation && this.hasScreenShare()) {
          await withAnalysis?.(shot);
        }
      } catch (error) {
        if (generation === this.generation) onError?.(error);
      } finally {
        busy = false;
      }
    };
    if (this.freq > 5) {
      this.earlyCaptureId = setTimeout(() => void captureAndAnalyze(), 4 * 60 * 1000);
    }
    this.intervalId = setInterval(() => void captureAndAnalyze(), this.freq * 60 * 1000);
    onSuccess?.();
  }

  stop() {
    this.generation++;
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.earlyCaptureId) clearTimeout(this.earlyCaptureId);
    this.intervalId = null;
    this.earlyCaptureId = null;
    this.isRunning = false;
  }

  clearScreenshots() {
    this.screenshots = [];
  }

  getScreenshots() {
    return this.screenshots;
  }

  downloadAllScreenshots() {
    this.screenshots.forEach((screenshot, index) => {
      (async () => {
        try {
          const response = await fetch(screenshot.data);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${screenshot.timestamp}_${index + 1}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('下载截图失败:', e);
        }
      })();
    });
  }

  downloadTargetScreenshot(timestamp: number) {
    const target = this.screenshots.find((shot) => shot.timestamp === timestamp);
    if (target) {
      (async () => {
        try {
          const response = await fetch(target.data);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `screenshot_${target.timestamp}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('下载截图失败:', e);
        }
      })();
    } else {
      console.warn('No screenshot found for timestamp:', timestamp);
    }
  }
}
