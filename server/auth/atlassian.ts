// Atlassian's OAuth 2.0 (3LO): the four calls a dealer's Jira sign-in needs. Replies are
// checked at the edge; tests pass a fake fetch.
import { z } from "zod";
import type { JiraSite } from "../../shared/protocol.ts";

/**
 * What we ask for. `offline_access` is what gets a refresh token: it isn't listed in the
 * developer console, it only goes in this request. Every other scope must be added there.
 */
export const SCOPES = [
  "read:jira-work",
  "read:jira-user",
  "write:jira-work",
  "read:sprint:jira-software",
  "read:board-scope:jira-software",
  "read:me",
  "offline_access",
];

export interface AtlassianConfig {
  clientId: string;
  clientSecret: string;
  /** Overrides SCOPES (space-separated), for an app set up with different ones. */
  scopes?: string;
  fetch?: typeof fetch;
}

/** A fresh access token, and the refresh token that replaces the last one (they rotate). */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds the access token lasts. */
  expiresIn: number;
}

export interface AtlassianUser {
  accountId: string;
  name: string;
}

/** Atlassian said no to a refresh token: the dealer has to sign in again. */
export class SignInExpired extends Error {}

const TokenReply = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});
const MeReply = z.object({ account_id: z.string(), name: z.string().catch("") });
const SitesReply = z.array(
  z.object({ id: z.string(), name: z.string().catch(""), url: z.string(), scopes: z.array(z.string()).catch([]) }),
);

const AUTH = "https://auth.atlassian.com";
const API = "https://api.atlassian.com";

export function atlassian(cfg: AtlassianConfig) {
  const fetch = cfg.fetch ?? globalThis.fetch;
  const scope = cfg.scopes?.trim() || SCOPES.join(" ");

  async function token(body: Record<string, string>): Promise<Tokens> {
    const res = await fetch(`${AUTH}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
      signal: AbortSignal.timeout(10_000),
    });
    // a 400 or 403 here means the code or refresh token is no good any more
    if (res.status === 400 || res.status === 401 || res.status === 403)
      throw new SignInExpired(`Atlassian answered ${res.status}`);
    if (!res.ok) throw new Error(`Atlassian answered ${res.status}`);
    const parsed = TokenReply.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new Error("Atlassian sent a token reply we couldn't read");
    const t = parsed.data;
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresIn: t.expires_in };
  }

  async function get<S extends z.ZodType>(schema: S, path: string, accessToken: string): Promise<z.infer<S>> {
    const res = await fetch(API + path, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Atlassian answered ${res.status} for ${path}`);
    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new Error(`Atlassian sent a reply we couldn't read for ${path}`);
    return parsed.data;
  }

  return {
    /** The Atlassian page that asks the dealer to allow Point Poker, coming back to `redirectUri`. */
    authorizeUrl(redirectUri: string, state: string): string {
      const url = new URL(`${AUTH}/authorize`);
      url.search = new URLSearchParams({
        audience: "api.atlassian.com",
        client_id: cfg.clientId,
        scope,
        redirect_uri: redirectUri,
        state,
        response_type: "code",
        prompt: "consent",
      }).toString();
      return url.toString();
    },
    /** Trades the code Atlassian sent back for tokens. `redirectUri` must be the one we sent. */
    exchange: (code: string, redirectUri: string) =>
      token({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    /** A new access token. The refresh token rotates: keep the new one, the old one stops working. */
    refresh: (refreshToken: string) => token({ grant_type: "refresh_token", refresh_token: refreshToken }),
    async me(accessToken: string): Promise<AtlassianUser> {
      const me = await get(MeReply, "/me", accessToken);
      return { accountId: me.account_id, name: me.name };
    },
    /** The Jira sites this login can read. */
    async sites(accessToken: string): Promise<JiraSite[]> {
      const sites = await get(SitesReply, "/oauth/token/accessible-resources", accessToken);
      return sites
        .filter((s) => s.scopes.some((sc) => sc.includes("jira")))
        .map(({ id, name, url }) => ({ id, name, url: url.replace(/\/+$/, "") }));
    },
  };
}

export type Atlassian = ReturnType<typeof atlassian>;
