export const TERRITORY_REPLAY_BUDGET_MS = 2000;
export const TERRITORY_RETRY_SECONDS = 600;

export class TerritoryBudgetExceededError extends Error {
  readonly code = 'TERRITORY_BUDGET_EXCEEDED';
  constructor() {
    super('Territory projection exceeded its compute budget');
    this.name = 'TerritoryBudgetExceededError';
  }
}

export function isTerritoryBudgetError(error: unknown): error is TerritoryBudgetExceededError {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'TERRITORY_BUDGET_EXCEEDED';
}

export function replayBudget(milliseconds: number) {
  const deadline = Date.now() + Math.max(0, milliseconds);
  return () => {
    if (Date.now() >= deadline) throw new TerritoryBudgetExceededError();
  };
}
