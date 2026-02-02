import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface RequestContextStore {
  correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export function requestContextMiddleware(req: any, res: any, next: any) {
  const incoming = req.headers["x-correlation-id"] as string | undefined;
  const correlationId = incoming || randomUUID();

  storage.run({ correlationId }, () => {
    next();
  });
}

export function getCorrelationId(): string {
  return storage.getStore()?.correlationId || "N/A";
}
