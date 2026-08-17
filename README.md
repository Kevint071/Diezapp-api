This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Google OAuth proxy for the DiezApp (Flet) Android app

This backend exists because Google no longer accepts a custom-scheme
`redirect_uri` (e.g. `oauth2redirect://...`) for the Authorization Code
flow — it rejects it with `Error 400: invalid_request`. Only an `https://`
`redirect_uri` is accepted, so this server does the whole OAuth exchange
with Google and then hands the tokens off to the app via its own
custom-scheme deep link (see `../diezmapp/README-setup-android-oauth.md`
section 10 for the full write-up).

Routes (`src/app/api/auth/`):

- `GET /api/auth/login?app_state=...` — starts the flow; redirects to Google.
- `GET /api/auth/callback` — Google's redirect target; exchanges the code
  for tokens and redirects back into the app's custom-scheme deep link.
- `POST /api/auth/refresh` — called directly by the app (not the browser)
  to refresh an expired `access_token` (requires `client_secret`, which
  never leaves this server).

### Setup

1. Copy `.env.example` to `.env.local` and fill in `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET` from a Google Cloud **"Web application"** OAuth
   client (Authorized redirect URI: `https://<this-domain>/api/auth/callback`).
2. Set `APP_REDIRECT_SCHEME`/`APP_REDIRECT_HOST` to match
   `[tool.flet.<platform>.deep_linking]` in `diezmapp/pyproject.toml`.
3. Deploy (e.g. Vercel) and update `BACKEND_BASE_URL` in
   `diezmapp/src/utils/gdrive_auth.py` with the deployed domain.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
