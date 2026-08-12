import { useAuthStore } from "../hooks/use-auth-store";

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
).replace(/\/+$/, "");

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  timestamp: string;
}

type ApiClientResponse<T> = ApiResponse<T> & T;
type ApiListItem = Record<string, unknown>;

/**
 * IMPORTANT:
 * Only one refresh request is allowed at a time.
 *
 * If multiple API requests receive 401 simultaneously,
 * they all wait for the same refresh request instead of
 * sending multiple refresh-token requests.
 */
let refreshPromise: Promise<{
  accessToken: string;
  refreshToken: string;
}> | null = null;

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractErrorMessage(data: unknown): string {
  if (!isRecord(data)) {
    return "An error occurred";
  }

  const message = data.message;
  const error = data.error;

  if (Array.isArray(message)) {
    return message
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }

  if (typeof message === "string") {
    return message;
  }

  if (isRecord(error) && Array.isArray(error.message)) {
    return error.message
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An error occurred";
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

/**
 * Performs the actual refresh request.
 *
 * This function MUST NOT be called directly from multiple API requests.
 * Always use getRefreshedTokens() so concurrent requests share one
 * refresh operation.
 */
async function performRefresh(
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  if (!refreshResponse.ok) {
    let message = "Session expired. Please log in again.";

    try {
      const errorData = await parseResponse(refreshResponse);
      const extracted = extractErrorMessage(errorData);

      if (extracted && extracted !== "An error occurred") {
        message = extracted;
      }
    } catch {
      // Keep default message.
    }

    throw new Error(message);
  }

  const refreshJson = await parseResponse(refreshResponse);

  /**
   * Backend may return:
   *
   * {
   *   success: true,
   *   data: {
   *     accessToken,
   *     refreshToken
   *   }
   * }
   *
   * or:
   *
   * {
   *   accessToken,
   *   refreshToken
   * }
   */
  const refreshData =
    isRecord(refreshJson) && isRecord(refreshJson.data)
      ? refreshJson.data
      : refreshJson;

  if (
    !isRecord(refreshData) ||
    typeof refreshData.accessToken !== "string"
  ) {
    throw new Error("Session refresh failed.");
  }

  const newAccessToken = refreshData.accessToken;

  const newRefreshToken =
    typeof refreshData.refreshToken === "string"
      ? refreshData.refreshToken
      : refreshToken;

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Single-flight refresh.
 *
 * If a refresh is already running, every caller waits for the same
 * Promise instead of creating another refresh request.
 */
async function getRefreshedTokens(
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = performRefresh(refreshToken).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiClient<T = ApiListItem[]>(
  path: string,
  options: FetchOptions = {},
): Promise<ApiClientResponse<T>> {
  const {
    accessToken: originalAccessToken,
    refreshToken,
    activeCompanyId,
    setAuth,
    clearAuth,
  } = useAuthStore.getState();

  const url = buildUrl(path);

  const headers = new Headers(options.headers || {});

  /**
   * Only set JSON content type when the request has a body.
   */
  if (options.body !== undefined && options.body !== null) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  /**
   * Attach JWT access token.
   *
   * Login/register/refresh requests should normally use skipAuth:true,
   * so an old/stale access token is not attached to them.
   */
  if (!options.skipAuth && originalAccessToken) {
    headers.set("Authorization", `Bearer ${originalAccessToken}`);
  }

  /**
   * Company context.
   */
  if (activeCompanyId) {
    headers.set("X-Company-Id", activeCompanyId);
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;

  /**
   * Initial API request.
   */
  try {
    response = await fetch(url, mergedOptions);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[apiClient] Network request failed:", {
      url,
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    throw new Error(
      `Unable to connect to the backend at ${BASE_URL}. ` +
        `Details: ${err.message}. ` +
        `Make sure the NestJS backend is running on port 3001.`,
    );
  }

  /**
   * IMPORTANT:
   *
   * Authentication endpoints must NEVER trigger the automatic
   * refresh-token flow.
   *
   * This prevents:
   *
   * /auth/login -> 401 -> /auth/refresh -> 401
   *
   * from hiding the actual login error behind "Invalid credentials".
   */
  const isAuthRequest =
    path === "/auth/login" ||
    path === "/auth/refresh" ||
    path === "/auth/register" ||
    path === "/auth/forgot-password" ||
    path === "/auth/reset-password";

  /**
   * Handle expired access token.
   *
   * Multiple simultaneous 401 responses will share ONE refresh request.
   */
  if (
    response.status === 401 &&
    !options.skipAuth &&
    !isAuthRequest &&
    refreshToken
  ) {
    let retryToken: string | null = null;
    try {
      const { accessToken: currentAccessToken, refreshToken: currentRefreshToken } = useAuthStore.getState();
      let newAccessToken: string;
      let newRefreshToken: string;

      if (currentAccessToken && currentAccessToken !== originalAccessToken) {
        // Tokens have already been refreshed by another concurrent request
        newAccessToken = currentAccessToken;
        newRefreshToken = currentRefreshToken || refreshToken;
      } else {
        // Trigger / await single-flight token refresh
        const refreshed = await getRefreshedTokens(refreshToken);
        newAccessToken = refreshed.accessToken;
        newRefreshToken = refreshed.refreshToken;

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          setAuth(
            newAccessToken,
            newRefreshToken,
            currentUser,
          );
        } else {
          useAuthStore.setState({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          });
        }
      }

      retryToken = newAccessToken;

      /**
       * Retry original request with NEW access token.
       */
      const retryHeaders = new Headers(options.headers || {});

      if (
        options.body !== undefined &&
        options.body !== null &&
        !retryHeaders.has("Content-Type")
      ) {
        retryHeaders.set("Content-Type", "application/json");
      }

      retryHeaders.set(
        "Authorization",
        `Bearer ${newAccessToken}`,
      );

      /**
       * Use the latest company ID from the store.
       */
      const latestCompanyId =
        useAuthStore.getState().activeCompanyId;

      if (latestCompanyId) {
        retryHeaders.set(
          "X-Company-Id",
          latestCompanyId,
        );
      }

      try {
        response = await fetch(url, {
          ...options,
          headers: retryHeaders,
        });
      } catch (error) {
        console.error(
          "[apiClient] Network request failed after token refresh:",
          {
            url,
            error,
          },
        );

        throw new Error(
          `Unable to connect to the backend at ${BASE_URL}. ` +
            `Make sure the NestJS backend is running on port 3001.`,
        );
      }

      // If the retried request still returns 401, it is genuinely unauthorized
      if (response.status === 401) {
        throw new Error("Session expired. Please log in again.");
      }
    } catch (error) {
      /**
       * Refresh failed or retried request failed with 401.
       *
       * Clear authentication only when the credentials are confirmed invalid and
       * no newer active token has been generated.
       */
      const latestToken = useAuthStore.getState().accessToken;
      if (!retryToken || latestToken === retryToken) {
        clearAuth();
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "Session expired. Please log in again.",
      );
    }
  }

  /**
   * Handle all non-2xx responses.
   */
  if (!response.ok) {
    let errorMsg = `Request failed with status ${response.status}`;

    try {
      const errorData = await parseResponse(response);

      if (isRecord(errorData)) {
        errorMsg = extractErrorMessage(errorData);
      } else if (
        typeof errorData === "string" &&
        errorData.trim()
      ) {
        errorMsg = errorData;
      }
    } catch {
      // Keep HTTP status based error message.
    }

    throw new Error(errorMsg);
  }

  /**
   * Parse successful response.
   */
  const payload = await parseResponse(response);

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    !("data" in payload) ||
    typeof payload.timestamp !== "string"
  ) {
    throw new Error(
      "Backend returned an invalid API response envelope.",
    );
  }

  const envelope: ApiResponse<T> = {
    success: true,
    data: payload.data as T,
    timestamp: payload.timestamp,
  };

  /**
   * Preserve existing API-client behavior:
   *
   * Arrays are returned as array-like objects containing
   * the envelope properties.
   */
  if (Array.isArray(envelope.data)) {
    return Object.assign(
      [...envelope.data],
      envelope,
    ) as unknown as ApiClientResponse<T>;
  }

  if (isRecord(envelope.data)) {
    return Object.assign(
      {},
      envelope.data,
      envelope,
    ) as ApiClientResponse<T>;
  }

  return envelope as ApiClientResponse<T>;
}