import { LocalParticipant, LocalTrackPublication, Track } from 'livekit-client';

/**
 * 裁剪截图单条信息
 */
export interface CutScreenShot {
  data: string; // base64 图片数据
  timestamp: number; // 截图时间戳
  showTime: boolean; // 是否在时间轴上显示时间
}

export const newCutScreenShot = (data: string, showTime: boolean): CutScreenShot => {
  return {
    data,
    timestamp: Date.now(),
    showTime,
  };
};

export class AICutService {
  private intervalId: NodeJS.Timeout | null = null;
  private screenshots: CutScreenShot[] = [];
  public isRunning: boolean = false;
  // default frequency: every 3 minutes
  public freq: number = 3;
  public timeline: boolean = false;
  public localParicipant: LocalParticipant | null = null;
  // 从用户的分享屏幕的视频流中进行截图
  async captureFromChannel() {
    if (!this.localParicipant) return;

    try {
      const videoTracks = this.localParicipant.videoTrackPublications;
      let screenShareTrack: LocalTrackPublication | null = null;
      for (const [tid, track] of videoTracks) {
        if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
          // Capture the screen share video track
          screenShareTrack = track;
          break;
        }
      }
      // 获取到了屏幕分享的视频流
      if (screenShareTrack && screenShareTrack.videoTrack) {
        const videoElement = document.createElement('video');
        videoElement.srcObject = new MediaStream([screenShareTrack.videoTrack.mediaStreamTrack]);
        await videoElement.play();

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          this.screenshots.push(newCutScreenShot(dataUrl, this.timeline));
          console.warn('Captured screenshot from screen share, total:', this.screenshots.length);
        }
      }
    } catch (e) {
      console.error('Capture from channel failed:', e);
    }
  }

  // capture use html2canvas
  async capture() {
    try {
      const h2c = (await import('html2canvas')).default;
      const canvas = await h2c(document.body, {
        height: window.innerHeight,
        width: window.innerWidth,
        useCORS: true,
      });

      return canvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
      console.error('html2canvas import or capture failed:', e);
      return null;
    }
  }

  async doCapture() {
    const screenshot = await this.capture();
    if (screenshot) {
      this.screenshots.push(newCutScreenShot(screenshot, this.timeline));
      console.warn('Captured screenshot, total:', this.screenshots.length);
    } else {
      console.warn('Failed to capture screenshot');
    }
  }

  // start the AI cut service
  async start(
    freq: number,
    timeline: boolean,
    localParicipant: LocalParticipant,
    withAnalysis?: (screenShot: CutScreenShot) => Promise<void>,
  ) {
    if (this.isRunning) {
      console.warn('AI Cut Service is already running');
      return;
    }
    this.localParicipant = localParicipant;
    this.freq = freq;
    this.timeline = timeline;
    this.isRunning = true;
    // 超过5分钟，都需要在4分钟这个节点进行一次截图，避免时间点偏移过大
    if (this.freq > 5) {
      setTimeout(async () => {
        if (this.isRunning) {
          await this.doCapture();
          if (withAnalysis) {
            const screenshots = this.getScreenshots();
            const lastScreenshot = screenshots[screenshots.length - 1];
            await withAnalysis(lastScreenshot);
          }
        }
      }, 4 * 60 * 1000);
    }

    // set interval for periodic capture
    this.intervalId = setInterval(async () => {
      // await this.doCapture();
      await this.captureFromChannel();
      // 获取最新截图并进行分析
      if (withAnalysis) {
        const screenshots = this.getScreenshots();
        const lastScreenshot = screenshots[screenshots.length - 1];
        await withAnalysis(lastScreenshot);
      }
    }, this.freq * 60 * 1000);

    console.warn('AI Cut Service started with frequency:', this.freq, 'minutes');
  }

  stop() {
    if (!this.isRunning) return;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.warn('AI Cut Service stopped');
  }

  clearScreenshots() {
    this.screenshots = [];
  }

  getScreenshots() {
    return this.screenshots;
  }

  downloadAllScreenshots() {
    this.screenshots.forEach((screenshot, index) => {
      const a = document.createElement('a');
      a.href = screenshot.data;
      a.download = `${screenshot.timestamp}_${index + 1}.png`;
      a.click();
    });
  }
}
