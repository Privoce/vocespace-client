export type JoinStage =
  | 'session'
  | 'create'
  | 'prepare'
  | 'connect'
  | 'confirm'
  | 'settings'
  | 'cleanup';
export class JoinError extends Error {
  constructor(
    readonly stage: JoinStage,
    readonly cause: unknown,
  ) {
    super(`JOIN_${stage.toUpperCase()}_FAILED`);
  }
}
export async function atJoinStage<T>(stage: JoinStage, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw error instanceof JoinError ? error : new JoinError(stage, error);
  }
}
