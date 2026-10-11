import type { CreateSpaceStrategy } from '../config';

export interface UpdateCreateSpaceConfBody {
  createStrategy: CreateSpaceStrategy;
  whiteList: string[];
}
