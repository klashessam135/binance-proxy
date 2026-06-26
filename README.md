# Binance Trading Proxy — Vercel Deployment

## Quick Deploy

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New" → "Project"**
3. Upload this folder (or connect a Git repo containing it)
4. In **"Environment Variables"**, add:
   - `BINANCE_API_KEY` = your Binance API key
   - `BINANCE_API_SECRET` = your Binance API secret
5. Click **"Deploy"**
6. Copy the deployed URL (e.g. `https://binance-proxy-xxx.vercel.app`)
7. Set it as the `BINANCE_PROXY_URL` secret in your Base44 app settings

## Files

- `vercel.json` — configures the deployment region (fra1 = Frankfurt)
- `api/[...path].js` — the proxy handler (catches all API routes)

## Notes

- Region is set to `fra1` (Frankfurt) to avoid Binance geo-blocking (HTTP 451)
- No external dependencies — uses Node.js built-in `crypto` module