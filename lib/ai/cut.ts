export class AICutService {
  private intervalId: NodeJS.Timeout | null = null;
  private screenshots: string[] = [];
  public isRunning: boolean = false;
  // default frequency: every 3 minutes
  public freq: number = 3;

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
      this.screenshots.push(screenshot as string);
      console.warn('Captured screenshot, total:', this.screenshots.length);
    } else {
      console.warn('Failed to capture screenshot');
    }
  }

  // start the AI cut service
  async start(freq: number) {
    if (this.isRunning) {
      console.warn('AI Cut Service is already running');
      return;
    }
    this.freq = freq;
    this.isRunning = true;
    // do capture immediately
    await this.doCapture();
    // set interval for periodic capture
    this.intervalId = setInterval(async () => {
      await this.doCapture();
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
    this.screenshots.forEach((dataUrl, index) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `screenshot_${index + 1}.png`;
      a.click();
    });
  }
}
