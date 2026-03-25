import { ENV } from "@/lib/env";

type ApiFetchOptions = RequestInit & {
  accessToken?: string;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { accessToken, headers, ...init } = options;
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

  let response: Response;

  try {
    response = await fetch(`${ENV.NEXT_PUBLIC_API_BASE_URL}${path}`, {
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
}
