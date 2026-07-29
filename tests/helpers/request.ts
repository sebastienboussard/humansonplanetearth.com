import { NextRequest } from "next/server";

type RequestOpts = {
  method?: string;
  cookies?: Record<string, string>;
};

function buildHeaders(cookies?: Record<string, string>, extra?: Record<string, string>) {
  const headers = new Headers(extra);
  if (cookies && Object.keys(cookies).length > 0) {
    headers.set(
      "cookie",
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
    );
  }
  return headers;
}

/** A NextRequest with a JSON body (default POST). */
export function jsonRequest(url: string, body: unknown, opts: RequestOpts = {}): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? "POST",
    headers: buildHeaders(opts.cookies, { "content-type": "application/json" }),
    body: JSON.stringify(body),
    duplex: "half", // undici requires this when a body is present
  });
}

/** A NextRequest whose body is deliberately not valid JSON. */
export function malformedJsonRequest(url: string, opts: RequestOpts = {}): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? "POST",
    headers: buildHeaders(opts.cookies, { "content-type": "application/json" }),
    body: "{not valid json",
    duplex: "half", // undici requires this when a body is present
  });
}

/** A NextRequest with a multipart FormData body (default POST). */
export function formRequest(url: string, form: FormData, opts: RequestOpts = {}): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? "POST",
    headers: buildHeaders(opts.cookies),
    body: form,
    duplex: "half", // undici requires this when a body is present
  });
}

/** A bodyless NextRequest (default GET). Append query params to the URL. */
export function getRequest(url: string, opts: RequestOpts = {}): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    headers: buildHeaders(opts.cookies),
  });
}
