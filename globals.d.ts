// globals.d.ts
import * as PIXI from "pixi.js";

declare global {
  interface Window {
    PIXI: typeof PIXI;
  }
}