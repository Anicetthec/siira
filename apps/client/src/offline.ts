type PendingRequest = { id: string; url: string; method: string; body: string; headers: Record<string, string> };
const storageKey = 'siira-client-offline-queue';

function readQueue(): PendingRequest[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as PendingRequest[];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingRequest[]) {
  localStorage.setItem(storageKey, JSON.stringify(queue));
}

export function queueRequest(request: Omit<PendingRequest, 'id'>) {
  const item = { ...request, id: crypto.randomUUID() };
  writeQueue([...readQueue(), item]);
  return item.id;
}

export async function syncQueue() {
  const remaining: PendingRequest[] = [];
  for (const request of readQueue()) {
    try {
      const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body });
      if (!response.ok && response.status >= 500) throw new Error('server unavailable');
    } catch {
      remaining.push(request);
    }
  }
  writeQueue(remaining);
  return { pending: remaining.length };
}

export function pendingCount() {
  return readQueue().length;
}
