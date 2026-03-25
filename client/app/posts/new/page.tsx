"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import { ISSUE_CATEGORIES } from "@/lib/catalog";
import type {
  AreaListResponse,
  AreaRef,
  Category,
  CategoryListResponse,
  PostCreateRequest,
  PostDetail,
} from "@/lib/types";

const defaultCategories: Category[] = ISSUE_CATEGORIES;

export default function NewPostPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [areas, setAreas] = useState<AreaRef[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: defaultCategories[0]?.id ?? "",
    description: "",
    sourceLanguage: "en",
    locationMode: "none" as "auto_detected" | "manual" | "none",
    areaId: "",
    isAnonymous: true,
  });

  useEffect(() => {
    if (!session?.access_token) return;

    const activeSession = session;
    let ignore = false;

    async function loadMeta() {
      const accessToken = activeSession.access_token;
      try {
        const [categoryResponse, areaResponse] = await Promise.allSettled([
          apiFetch<CategoryListResponse>("/categories", {
            accessToken,
          }),
          apiFetch<AreaListResponse>("/areas?type=locality", {
            accessToken,
          }),
        ]);

        if (ignore) return;

        if (categoryResponse.status === "fulfilled" && categoryResponse.value.items.length) {
          setCategories(categoryResponse.value.items);
          setForm((current) => ({
            ...current,
            categoryId: current.categoryId || categoryResponse.value.items[0].id,
          }));
        }

        if (areaResponse.status === "fulfilled") {
          setAreas(areaResponse.value.items);
        }

        if (categoryResponse.status === "rejected" || areaResponse.status === "rejected") {
          setMetaError(
            "Some metadata endpoints are not available yet. You can still create a global text post.",
          );
        }
      } catch {
        if (!ignore) {
          setMetaError(
            "Metadata could not be loaded. Falling back to built-in category options.",
          );
        }
      }
    }

    loadMeta();

    return () => {
      ignore = true;
    };
  }, [session]);

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
      <div className="surface rounded-[32px] border border-white/10 p-6">
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
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label-text">Category</span>
              <select
                className="select-field mt-2"
                value={form.categoryId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, categoryId: event.target.value }))
                }
              >
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    locationMode: event.target.value as "auto_detected" | "manual" | "none",
                  }))
                }
              >
                <option value="none">Global or no location</option>
                <option value="manual">Choose an area</option>
                <option value="auto_detected">Auto-detected later</option>
              </select>
            </label>

            <label className="block">
              <span className="label-text">Area</span>
              <select
                className="select-field mt-2"
                value={form.areaId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, areaId: event.target.value }))
                }
                disabled={form.locationMode !== "manual" || !areas.length}
              >
                <option value="">Select an area</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
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
              {submitting ? "Publishing..." : "Publish post"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
