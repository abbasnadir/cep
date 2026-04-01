import { ENV } from "@/lib/env";

type ApiFetchOptions = RequestInit & {
  accessToken?: string;
};

const inflightGetRequests = new Map<string, Promise<unknown>>();

function cloneData<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { accessToken, headers, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const nextHeaders = new Headers(headers);

  if (!nextHeaders.has("Accept")) {
    nextHeaders.set("Accept", "application/json");
  }

  if (init.body && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    nextHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const requestUrl = `${ENV.NEXT_PUBLIC_API_BASE_URL}${path}`;
  const dedupeKey =
    method === "GET" && !init.body ? `${method}:${requestUrl}:${accessToken ?? ""}` : null;

  if (dedupeKey) {
    const existingRequest = inflightGetRequests.get(dedupeKey);
    if (existingRequest) {
      return cloneData((await existingRequest) as T);
    }
  }

  let response: Response;

  const requestPromise = (async () => {
    try {
      response = await fetch(requestUrl, {
        ...init,
        headers: nextHeaders,
        cache: "no-store",
      });
    } catch {
      throw new Error(
        `Could not reach the API at ${ENV.NEXT_PUBLIC_API_BASE_URL}. Make sure the server is running and CORS allows the current frontend origin.`,
      );
    }

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;

      try {
        const data = (await response.json()) as { error?: { message?: string } };
        message = data.error?.message ?? message;
      } catch {
        // Ignore non-JSON errors and keep the generic message.
      }

      throw new Error(message);
    }

    return (await response.json()) as T;
  })();

  if (!dedupeKey) {
    return requestPromise;
  }

  inflightGetRequests.set(dedupeKey, requestPromise);

  try {
    const data = await requestPromise;
    return cloneData(data);
  } finally {
    inflightGetRequests.delete(dedupeKey);
  }

}
