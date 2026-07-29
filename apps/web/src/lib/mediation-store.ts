const sessions = new Map<string, Record<string, unknown>>();

export function saveMediationSession(token: string, data: Record<string, unknown>) {
  sessions.set(`med-${token}`, data);
}

export function getMediationSession(token: string) {
  return sessions.get(`med-${token}`) ?? null;
}

export function updateMediationSession(token: string, data: Record<string, unknown>) {
  const existing = sessions.get(`med-${token}`) ?? {};
  sessions.set(`med-${token}`, { ...existing, ...data });
}
