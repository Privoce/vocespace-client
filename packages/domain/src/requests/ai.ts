import type { Extraction, CutScreenShot } from '../ai';

export interface AnalysisRequestBody {
  spaceName: string;
  userId: string;
  screenShot: CutScreenShot;
  todos: string[];
  freq: number;
  lang: string;
  extraction: Extraction;
  isAuth: boolean;
  blur: boolean;
}
