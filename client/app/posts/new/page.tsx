"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import { FALLBACK_AREAS, ISSUE_CATEGORIES } from "@/lib/catalog";
import type {
  AreaListResponse,
  AreaRef,
  Category,
  CategoryListResponse,
  PostCreateRequest,
  PostDetail,
} from "@/lib/types";

function formatAreaOptionLabel(area: AreaRef) {
  const typeLabel = area.areaType.replace("_", " ");
  return `${area.name} (${typeLabel})`;
}

function isLocalhostHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function pickPreferredAreas(allAreas: AreaRef[]) {
  const localityAreas = allAreas.filter((area) => area.areaType === "locality");
  return localityAreas.length ? localityAreas : allAreas;
}

type ComposerMeta = {
  categories: Category[];
  areas: AreaRef[];
  metaError: string | null;
  usingFallbackAreas: boolean;
};

const composerMetaCache = new Map<string, Promise<ComposerMeta>>();
const GEO_FAST_TIMEOUT_MS = 8000;
const GEO_STANDARD_TIMEOUT_MS = 20000;
const GEO_WATCH_TIMEOUT_MS = 45000;

async function loadComposerMeta(accessToken: string): Promise<ComposerMeta> {
  const [categoryResponse, areaResponse] = await Promise.allSettled([
    apiFetch<CategoryListResponse>("/categories", {
      accessToken,
    }),
    apiFetch<AreaListResponse>("/areas?limit=200", {
      accessToken,
    }),
  ]);

  const messages: string[] = [];

  const categories =
    categoryResponse.status === "fulfilled" && categoryResponse.value.items.length
      ? categoryResponse.value.items
      : ISSUE_CATEGORIES;
  if (categoryResponse.status === "rejected") {
    messages.push(
      "Categories could not be loaded from the backend, so the built-in list is being used.",
    );
  } else if (!categoryResponse.value.items.length) {
    messages.push(
      "The backend returned no categories, so the built-in list is being used.",
    );
  }

  let areas: AreaRef[] = [];
  let usingFallbackAreas = false;
  if (areaResponse.status === "fulfilled") {
    const allAreas = areaResponse.value.items;
    const localityAreas = allAreas.filter((area) => area.areaType === "locality");
    areas = pickPreferredAreas(allAreas);

    if (!allAreas.length) {
      areas = pickPreferredAreas(FALLBACK_AREAS);
      usingFallbackAreas = true;
      messages.push(
        "The backend returned no areas, so the built-in area list is being used.",
      );
    } else if (!localityAreas.length) {
      messages.push(
        "No locality rows were found, so the selector is showing broader backend areas instead.",
      );
    }
  } else {
    areas = pickPreferredAreas(FALLBACK_AREAS);
    usingFallbackAreas = true;
    messages.push(
      "Area lookup is unavailable right now, so the built-in area list is being used.",
    );
  }

  return {
    categories,
    areas,
    metaError: messages.join(" ") || null,
    usingFallbackAreas,
  };
}

function getComposerMeta(accessToken: string) {
  const cached = composerMetaCache.get(accessToken);
  if (cached) {
    return cached;
  }

  const request = loadComposerMeta(accessToken).catch((error) => {
    composerMetaCache.delete(accessToken);
    throw error;
  });
  composerMetaCache.set(accessToken, request);
  return request;
}

export default function NewPostPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [areas, setAreas] = useState<AreaRef[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [usingFallbackAreas, setUsingFallbackAreas] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoPoint, setGeoPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "requesting" | "ready" | "error" | "unsupported"
  >("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoRequestTimeoutRef = useRef<number | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const geoRequestIdRef = useRef(0);
  const [form, setForm] = useState({
    categoryId: "",
    description: "",
    sourceLanguage: "en",
    locationMode: "none" as "auto_detected" | "manual" | "none",
    areaId: "",
    areaLabel: "",
    isAnonymous: true,
  });

  const clearGeoTimeout = useCallback(() => {
    if (geoRequestTimeoutRef.current !== null) {
      window.clearTimeout(geoRequestTimeoutRef.current);
      geoRequestTimeoutRef.current = null;
    }
  }, []);

  const clearGeoWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      geoWatchIdRef.current = null;
      return;
    }

    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  }, []);

  const cancelGeoRequest = useCallback(() => {
    geoRequestIdRef.current += 1;
    clearGeoTimeout();
    clearGeoWatch();
  }, [clearGeoTimeout, clearGeoWatch]);

  const requestCurrentLocation = useCallback(() => {
    if (!window.isSecureContext && !isLocalhostHost(window.location.hostname)) {
      setGeoStatus("error");
      setGeoError(
        "Browser geolocation only works on HTTPS or localhost. Open the frontend on http://localhost:3000 or an HTTPS URL and try again.",
      );
      return;
    }

    if (!navigator.geolocation) {
      setGeoStatus("unsupported");
      setGeoError("This browser does not support location detection.");
      return;
    }

    clearGeoTimeout();
    clearGeoWatch();

    const requestId = geoRequestIdRef.current + 1;
    geoRequestIdRef.current = requestId;
    setGeoStatus("requesting");
    setGeoError(null);

    const applyPosition = (position: GeolocationPosition) => {
      if (geoRequestIdRef.current !== requestId) {
        return;
      }

      const { latitude, longitude } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        clearGeoTimeout();
        clearGeoWatch();
        setGeoStatus("error");
        setGeoError(
          "The browser returned invalid coordinates. Try detecting again, or choose an area manually.",
        );
        return;
      }

      clearGeoTimeout();
      clearGeoWatch();
      setGeoPoint({ latitude, longitude });
      setGeoStatus("ready");
    };

    const applyFinalGeoError = (positionError: GeolocationPositionError) => {
      setGeoStatus("error");
      if (positionError.code === 1) {
        setGeoError(
          "Location access was denied. Allow location for this site in your browser settings and try again.",
        );
        return;
      }

      if (positionError.code === 2) {
        const rawMessage = positionError.message.trim().toLowerCase();
        setGeoError(
          rawMessage.includes("malformed")
            ? "The browser location service returned an invalid result. This is usually a browser or OS location-provider problem. Try reloading the page, switching browser, or choose an area manually."
            : "The browser could not determine your current location. Try again with Wi-Fi or device location enabled.",
        );
        return;
      }

      if (positionError.code === 3) {
        setGeoError(
          "The browser location provider did not return coordinates in time. Try detecting again, or choose an area manually.",
        );
        return;
      }

      setGeoError(positionError.message || "Unable to detect your current location.");
    };

    const startWatchFallback = () => {
      clearGeoTimeout();
      clearGeoWatch();
      geoRequestTimeoutRef.current = window.setTimeout(() => {
        if (geoRequestIdRef.current !== requestId) {
          return;
        }

        clearGeoWatch();
        setGeoStatus("error");
        setGeoError(
          "Location detection is taking longer than expected. If it does not finish soon, try detecting again or choose an area manually.",
        );
      }, GEO_WATCH_TIMEOUT_MS);

      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          applyPosition(position);
        },
        (positionError) => {
          if (geoRequestIdRef.current !== requestId) {
            return;
          }

          clearGeoTimeout();
          clearGeoWatch();
          applyFinalGeoError(positionError);
        },
        {
          enableHighAccuracy: false,
          maximumAge: 600000,
        },
      );
    };

    const runRequest = (useHighAccuracy: boolean) => {
      clearGeoTimeout();
      geoRequestTimeoutRef.current = window.setTimeout(() => {
        if (geoRequestIdRef.current !== requestId) {
          return;
        }

        setGeoStatus("error");
        setGeoError(
          "Location detection is taking longer than expected. If it does not finish soon, try detecting again or choose an area manually.",
        );
      }, useHighAccuracy ? GEO_FAST_TIMEOUT_MS : GEO_STANDARD_TIMEOUT_MS);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          applyPosition(position);
        },
        (positionError) => {
          if (geoRequestIdRef.current !== requestId) {
            return;
          }

          clearGeoTimeout();
          if (useHighAccuracy && (positionError.code === 2 || positionError.code === 3)) {
            setGeoStatus("requesting");
            setGeoError("High-accuracy lookup failed. Retrying with standard accuracy...");
            runRequest(false);
            return;
          }

          if (!useHighAccuracy && (positionError.code === 2 || positionError.code === 3)) {
            setGeoStatus("requesting");
            setGeoError("Single-shot lookup failed. Waiting for a location fix...");
            startWatchFallback();
            return;
          }

          applyFinalGeoError(positionError);
        },
        {
          enableHighAccuracy: useHighAccuracy,
          timeout: useHighAccuracy ? GEO_FAST_TIMEOUT_MS : GEO_STANDARD_TIMEOUT_MS,
          maximumAge: useHighAccuracy ? 300000 : 600000,
        },
      );
    };

    runRequest(true);
  }, [clearGeoTimeout, clearGeoWatch]);

  useEffect(() => {
    const accessToken = session?.access_token;

    if (!accessToken) {
      setCategories([]);
      setAreas([]);
      setMetaError(null);
      setMetaLoading(false);
      setUsingFallbackAreas(false);
      return;
    }

    const resolvedAccessToken = accessToken;
    let ignore = false;

    setMetaLoading(true);

    async function hydrateMeta() {
      try {
        const meta = await getComposerMeta(resolvedAccessToken);

        if (ignore) return;

        setCategories(meta.categories);
        setAreas(meta.areas);
        setMetaError(meta.metaError);
        setUsingFallbackAreas(meta.usingFallbackAreas);
        setForm((current) => ({
          ...current,
          categoryId: meta.categories.some((category) => category.id === current.categoryId)
            ? current.categoryId
            : meta.categories[0]?.id ?? "",
          areaId: meta.areas.some((area) => area.id === current.areaId)
            ? current.areaId
            : "",
        }));
      } catch {
        if (!ignore) {
          setCategories(ISSUE_CATEGORIES);
          setAreas(pickPreferredAreas(FALLBACK_AREAS));
          setMetaError(
            "Metadata could not be loaded from the backend. The composer is using built-in categories and the built-in area list.",
          );
          setUsingFallbackAreas(true);
          setForm((current) => ({
            ...current,
            categoryId: current.categoryId || ISSUE_CATEGORIES[0]?.id || "",
            areaId: current.areaId,
          }));
        }
      } finally {
        if (!ignore) {
          setMetaLoading(false);
        }
      }
    }

    hydrateMeta();

    return () => {
      ignore = true;
    };
  }, [session?.access_token]);

  useEffect(() => {
    return () => {
      cancelGeoRequest();
    };
  }, [cancelGeoRequest]);

  useEffect(() => {
    if (form.locationMode !== "auto_detected") {
      cancelGeoRequest();
      return;
    }
  }, [cancelGeoRequest, form.locationMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token) {
      setError("You must be signed in before you can publish a post.");
      return;
    }

    if (!form.description.trim()) {
      setError("Please add a description before publishing.");
      return;
    }

    if (!form.categoryId) {
      setError("Choose a category before publishing.");
      return;
    }

    if (
      form.locationMode === "manual" &&
      !form.areaId &&
      !form.areaLabel.trim()
    ) {
      setError("Choose an area or type a location label before publishing.");
      return;
    }

    if (form.locationMode === "auto_detected" && !geoPoint) {
      setError("Automatic location is still unavailable. Allow location access or choose an area manually.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const accessToken = session.access_token;

    const payload: PostCreateRequest = {
      categoryId: form.categoryId,
      description: form.description.trim(),
      sourceLanguage: form.sourceLanguage,
      translateTargets: ["en"],
      isAnonymous: form.isAnonymous,
      location: {
        mode: form.locationMode,
        areaId:
          form.locationMode === "manual" && form.areaId ? form.areaId : undefined,
        areaLabel:
          form.locationMode === "manual" && form.areaLabel.trim()
            ? form.areaLabel.trim()
            : undefined,
        geoPoint:
          form.locationMode === "auto_detected" && geoPoint ? geoPoint : undefined,
      },
      media: [],
    };

    try {
      const response = await apiFetch<PostDetail>("/posts", {
        method: "POST",
        accessToken,
        body: JSON.stringify(payload),
      });

      router.push(`/posts/${response.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to publish the post.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <StateBlock title="Loading session" description="Checking your account." />;
  }

  if (!session) {
    return (
      <StateBlock
        title="Sign in to publish"
        description="Creating a civic issue report requires an authenticated session."
        actionLabel="Go to login"
        actionHref="/login"
      />
    );
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="surface relative rounded-[32px] border border-white/10 p-6">
        {submitting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[32px] bg-slate-950/80 px-6 text-center backdrop-blur-sm">
            <div className="max-w-md rounded-[28px] border border-cyan-300/20 bg-cyan-400/10 px-6 py-7 shadow-2xl">
              <div
                className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-cyan-300"
                aria-hidden="true"
              />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                Checking for spam
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                The backend is checking this post with Ollama before it is created. This can take a few seconds.
              </p>
            </div>
          </div>
        )}
        <p className="label-text">Create a post</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
          Publish a new civic issue
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          This page submits directly to the backend API. Media upload can be added next
          once the Supabase Storage flow is finalized.
        </p>

        {metaError && (
          <div className="mt-5 rounded-[24px] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            {metaError}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-[24px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {submitting && (
            <div className="rounded-[24px] border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
              The backend is checking your post for spam before it allows creation.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label-text">Category</span>
              <select
                className="select-field mt-2"
                value={form.categoryId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, categoryId: event.target.value }))
                }
                disabled={metaLoading || !categories.length}
              >
                <option value="">
                  {metaLoading
                    ? "Loading categories..."
                    : categories.length
                      ? "Select a category"
                      : "No categories available"}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label-text">Source language</span>
              <select
                className="select-field mt-2"
                value={form.sourceLanguage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceLanguage: event.target.value,
                  }))
                }
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="bn">Bengali</option>
                <option value="ta">Tamil</option>
                <option value="mr">Marathi</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="label-text">Issue description</span>
            <textarea
              className="textarea-field mt-2"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Describe what is happening, who is affected, and why it needs attention."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label-text">Location mode</span>
              <select
                className="select-field mt-2"
                value={form.locationMode}
                onChange={(event) => {
                  const nextMode = event.target.value as
                    | "auto_detected"
                    | "manual"
                    | "none";

                  if (nextMode === "auto_detected" && !geoPoint) {
                    setGeoStatus("idle");
                    setGeoError(null);
                  }

                  if (nextMode !== "auto_detected") {
                    cancelGeoRequest();
                    setGeoError(null);
                  }

                  setForm((current) => ({
                    ...current,
                    locationMode: nextMode,
                  }));
                }}
              >
                <option value="none">Global or no location</option>
                <option value="manual">Choose an area</option>
                <option value="auto_detected">Detect my current location</option>
              </select>
              <p className="mt-2 text-xs leading-6 text-slate-400">
                Choose manual location to attach the post to a backend area or type a label yourself, or use your browser location for automatic detection.
              </p>
              {form.locationMode === "auto_detected" && (
                <div className="mt-2 space-y-2 text-xs leading-6 text-slate-400">
                  <p>
                    {geoStatus === "idle" &&
                      "Click detect current location to ask the browser for your coordinates."}
                    {geoStatus === "requesting" && "Requesting browser location access..."}
                    {geoStatus === "ready" && "Current coordinates detected and ready to send with the post."}
                    {geoStatus === "unsupported" && geoError}
                    {geoStatus === "error" && geoError}
                  </p>
                  <button
                    type="button"
                    className="button-secondary text-xs"
                    onClick={() => {
                      setGeoPoint(null);
                      requestCurrentLocation();
                    }}
                  >
                    {geoStatus === "ready" ? "Detect again" : "Detect current location"}
                  </button>
                  {geoPoint && (
                    <p>
                      Latitude {geoPoint.latitude.toFixed(5)}, longitude {geoPoint.longitude.toFixed(5)}
                    </p>
                  )}
                </div>
              )}
            </label>

            <label className="block">
              <span className="label-text">Area</span>
              {form.locationMode === "manual" && areas.length > 0 ? (
                <>
                  <select
                    className="select-field mt-2"
                    value={form.areaId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, areaId: event.target.value }))
                    }
                  >
                    <option value="">Select an area</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {formatAreaOptionLabel(area)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    {usingFallbackAreas
                      ? "Area choices are coming from the built-in fallback list because backend areas are unavailable."
                      : "Area choices are coming from the backend lookup endpoint."}
                  </p>
                </>
              ) : (
                <div className="mt-2 rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                  {form.locationMode === "manual"
                    ? "No selectable backend areas are available, so you can type a location label below."
                    : "Switch to manual mode if you want to attach a backend area or type a location label."}
                </div>
              )}
              {form.locationMode === "manual" && (
                <input
                  className="field mt-3"
                  value={form.areaLabel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, areaLabel: event.target.value }))
                  }
                  placeholder={
                    areas.length
                      ? "Optional location label"
                      : "Type your area, landmark, or neighborhood"
                  }
                />
              )}
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              checked={form.isAnonymous}
              onChange={(event) =>
                setForm((current) => ({ ...current, isAnonymous: event.target.checked }))
              }
            />
            Publish this report anonymously by default
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={submitting} className="button-primary">
              {submitting ? "Checking for spam..." : "Publish post"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
