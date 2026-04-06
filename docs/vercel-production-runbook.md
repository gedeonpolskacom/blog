# Vercel Production Runbook (`blog.gedeonpolska.com`)

## 1) Prepare Vercel Project

1. Import repository `https://github.com/gedeonpolskacom/blog.git` in Vercel.
2. Keep GitHub auto-deploy enabled:
   - Production: production branch (for example `main`).
   - Preview: all non-production branches / pull requests.
3. Confirm `vercel.json` is detected (contains cron schedules and host redirect).
4. If your Vercel plan is **Hobby**, keep cron schedules at most once per day (already configured in this repo).

## 2) Configure Environment Variables

Set the same keys in **Production** and **Preview** environments (values can differ by environment if needed):

- `NEXT_PUBLIC_SITE_URL` (set to `https://blog.gedeonpolska.com`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `ADMIN_TOKEN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `B2B_XML_URL`

Also add any integration keys used by your enabled features (AI, image APIs, newsletter providers).

## 3) Domain and Redirect

1. Add both domains in Vercel project settings:
   - `blog.gedeonpolska.com` (primary)
   - `www.blog.gedeonpolska.com`
2. Keep canonical host as `blog.gedeonpolska.com`.
3. Redirect from `www.blog.gedeonpolska.com` to `blog.gedeonpolska.com` is already enforced in `vercel.json`.

## 4) DNS Cutover (hosting panel)

1. In DNS zone for `gedeonpolska.com`, set:
   - `blog` -> CNAME to Vercel target shown in project domain settings.
   - `www.blog` -> CNAME to Vercel target shown in project domain settings.
2. Remove conflicting old records for these hosts (`A`, `AAAA`, or old `CNAME`).
3. Set low TTL during migration (e.g. `300`), then increase after stabilization.

## 5) Validation Checklist

After preview deploy:

- Home page, blog list, blog article render correctly.
- `https://<preview-url>/robots.txt` and `https://<preview-url>/sitemap.xml` return valid output.
- Build/runtime logs contain no critical errors.

After production cutover:

- `https://blog.gedeonpolska.com` serves correctly with valid SSL certificate.
- `https://www.blog.gedeonpolska.com` returns permanent redirect to canonical host.
- `robots.txt`, `sitemap.xml`, canonical tags and OG URLs point to `https://blog.gedeonpolska.com`.

Cron/API checks (with secret):

```powershell
$headers = @{ Authorization = "Bearer <CRON_SECRET>" }
Invoke-WebRequest -Method Get -Headers $headers https://blog.gedeonpolska.com/api/cron/publish-scheduled
Invoke-WebRequest -Method Get -Headers $headers https://blog.gedeonpolska.com/api/cron/send-newsletters
Invoke-WebRequest -Method Get -Headers $headers https://blog.gedeonpolska.com/api/b2b/sync
```

## 6) Rollback

If production incidents occur:

1. Revert DNS records `blog` and `www.blog` to previous origin.
2. Keep Vercel project intact for diagnosis and next cutover attempt.
