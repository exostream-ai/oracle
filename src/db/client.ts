// Database client stub — public oracle uses seed data only
export function getClientOrNull(): null {
  return null;
}

export function checkConnection(): Promise<boolean> {
  return Promise.resolve(false);
}
