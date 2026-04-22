import { BadRequestError, ServiceUnavailableError } from "../errors/httpErrors.js";
import { ENV } from "./env.js";

type AssistantRole = "user" | "assistant";

type AssistantMessage = {
  role: AssistantRole;
  content: string;
};

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

type GroqMessageContent =
  | string
  | Array<{
      type?: string;
      text?: string;
    }>
  | undefined;

type GroqErrorResponse = {
  error?: {
    message?: string;
  };
};

const ASSISTANT_SYSTEM_PROMPT = `
汝為 UrbanFix 內助理。專答 civic complaint、reporting、grievance routing 之問。答皆用 English。

UrbanFix 之用：
Feed 頁可覽 public reports，搜尋 place/issue/text，排序 ranked/newest/most raised/most discussed，篩 workflow status：all/open/acknowledged/in progress/resolved。可開 thread 詳閱。已登入者可 follow issue、share context。訪客唯可讀；欲發帖或互動，須 login/register。

New Post 頁之用：
登入者可發 civic complaint。可擇 category、source language，書 issue description，附至多 4 images，選 anonymous。Location 可為 none、manual、auto-detected。Manual 用 area picker 或 typed label。Auto-detected 用 browser geolocation。提交時，app 先 upload images，再送 backend，經 spam screening，後建 post。

汝之職：
釋 UrbanFix 各頁、按鈕、欄位、流程之義。
助 user 判斷應新建 complaint、開既有 thread、follow issue、或補充 context。
授 complaint writing best practice：描述清楚、類別得當、位置明白、證據足、匿名選項善用。
亦可答如何向其他 official government portals 或 public grievance channels 登記 complaint。

界限甚嚴：
但答 complaint/reporting/grievance/use-of-UrbanFix/government grievance portal 相關事。
若問 coding、娛樂、閒談、個人建議、或此外之事，當簡拒之，導回 complaint 相關。
不得虛構 laws、contacts、portal rules、official procedures；不知則直言 unsure。
不得宣稱已代 user 完成外部 portal submission。
遇 urgent danger，唯勸聯絡 official emergency services。
答宜 concise、practical、action-focused。
`.trim();

function extractContent(
  content: GroqMessageContent,
) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? "")
      .join(" ")
      .trim();
  }

  return "";
}

async function readGroqError(response: Response) {
  try {
    const payload = (await response.json()) as GroqErrorResponse;
    return payload.error?.message ?? null;
  } catch {
    return null;
  }
}

function sanitizeMessageContent(value: unknown, name: string) {
  if (typeof value !== "string") {
    throw new BadRequestError(`${name} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestError(`${name} cannot be empty`);
  }

  if (trimmed.length > 4000) {
    throw new BadRequestError(`${name} is too long`);
  }

  return trimmed;
}

function sanitizeHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AssistantMessage[];
  }

  return value
    .filter(
      (item): item is AssistantMessage =>
        Boolean(item) &&
        typeof item === "object" &&
        (item as AssistantMessage).role !== undefined &&
        (item as AssistantMessage).content !== undefined,
    )
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: sanitizeMessageContent(item.content, "history content"),
    }))
    .slice(-8);
}

export async function getComplaintAssistantReply(body: Record<string, unknown>) {
  const message = sanitizeMessageContent(body.message, "message");
  const history = sanitizeHistory(body.history);

  const response = await fetch(`${ENV.GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ENV.GROQ_CHAT_MODEL,
      temperature: 0.2,
      max_completion_tokens: ENV.GROQ_CHAT_MAX_TOKENS,
      messages: [
        {
          role: "system",
          content: ASSISTANT_SYSTEM_PROMPT,
        },
        ...history,
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    const providerMessage = await readGroqError(response);
    throw new ServiceUnavailableError(
      providerMessage
        ? `Chat assistant is unavailable right now because Groq returned ${response.status}: ${providerMessage}`
        : `Chat assistant is unavailable right now because Groq responded with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as GroqChatCompletionResponse;
  const reply = extractContent(payload.choices?.[0]?.message?.content);

  if (!reply) {
    throw new ServiceUnavailableError("Chat assistant returned an empty reply.");
  }

  return { message: reply };
}
