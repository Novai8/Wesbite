# Rapigents account sign-in setup

The app now gates the site behind a Supabase Auth session and offers Google, Microsoft (Outlook), email/password, and email magic-link sign-in. The account screen is implemented, but OAuth will not work until the project owner completes the provider configuration below.

## 1. Configure Cloudflare Pages variables

In Cloudflare Pages, open the Rapigents project settings, then **Variables and Secrets**. Add these variables to both Preview and Production as appropriate:

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL from Supabase Project Settings → API.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the project's anon/public key, or use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the new publishable key format.
- `NEXT_PUBLIC_SITE_URL`: `https://rapigents.com` (optional; used for canonical metadata).

These are public client values. **Never put a Supabase service-role key, OAuth client secret, or other private key in a `NEXT_PUBLIC_*` variable.**

## 2. Configure Supabase Auth URLs

In Supabase → Authentication → URL Configuration:

- Site URL: `https://rapigents.com`
- Redirect URL allowlist:
  - `https://rapigents.com/auth/callback`
  - `https://www.rapigents.com/auth/callback`
  - `http://localhost:3000/auth/callback` (local development only)

If you use a preview domain, add its exact callback URL while testing and remove it when no longer needed.

## 3. Enable Google / Gmail sign-in

In Supabase → Authentication → Sign In / Providers → Google, enable Google and enter the OAuth client ID and secret from Google Cloud Console. Add the **Supabase-provided callback URL** (normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) to the authorized redirect URIs in Google Cloud. Google sign-in authenticates the Google account; it does **not** automatically grant Gmail, Drive, or Calendar API permissions.

## 4. Enable Microsoft / Outlook sign-in

In Supabase → Authentication → Sign In / Providers → Azure, enable the Azure provider and enter the Microsoft Entra application client ID and secret. Configure the supported tenant/issuer settings for the accounts you intend to accept, and add the **Supabase-provided callback URL** to the redirect URIs in Microsoft Entra. The app requests basic OpenID scopes. Mailbox and calendar access require separate Microsoft Graph permissions and consent through a connector.

## 5. Enable email sign-in

In Supabase → Authentication → Sign In / Providers → Email, enable email/password and email OTP (magic link) as desired. Configure your production SMTP sender and verify the email templates and rate limits. For a public launch, do not rely on default test email delivery limits.

## 6. Verify before launch

1. Redeploy the `arena/01a0d281-wesbite` branch through Cloudflare Pages.
2. Open both `https://rapigents.com/login` and `https://www.rapigents.com/login`.
3. Test Google, Microsoft, email/password sign-up, email/password sign-in, magic-link sign-in, sign-out, and direct navigation to a protected route.
4. Confirm that unauthenticated requests to `/api/assistant` and `/api/integrations/mcp` receive HTTP 401.

## Credential handling

- Supabase manages account authentication; Rapigents does not receive users' account passwords from Google or Microsoft.
- The browser uses Supabase's standard persistent auth session. Use a strict Content Security Policy and keep dependencies current to reduce exposure to injected scripts.
- MCP bearer tokens entered on the Integrations page remain in in-memory page state and are cleared on refresh/disconnect. They are not saved to local storage or sent to the AI model.
- Do not paste secrets into the AI assistant. A service login and authorization to read/send email or modify other app data are separate permissions.
- MCP tools can perform real external actions. Users should review the tool name and arguments before approving a run.

This repository does not store OAuth client secrets. Configure those only in the Supabase provider dashboard.
