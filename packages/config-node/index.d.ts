import type { ResolvedVocespaceConfig, PublicClientConf } from '@vocespace/domain/config';
export function configPath(file?: string): string;
export function setConfigPath(file: string): string;
export function readConfiguration(options?: { file?: string; optional?: boolean }): ResolvedVocespaceConfig;
export function normalizeConfiguration(value: unknown): ResolvedVocespaceConfig;
export function publicConfiguration(conf: ResolvedVocespaceConfig): PublicClientConf;
