/* eslint-disable no-undef */
/**
 * Vercel Serverless Function — Binance Trading API Proxy
 *
 * Catches all routes under /api/* and proxies them to Binance
 * with HMAC-SHA256 signature using stored API keys.
 *
 * Deployed on Vercel in region fra1 (Frankfurt) to avoid Binance geo-block (HTTP 451).
 *
 * SETUP:
 * 1. Deploy this folder on Vercel
 * 2. Add Environment Variables: BINANCE_API_KEY, BINANCE_API_SECRET
 * 3. Set the resulting URL as BINANCE_PROXY_URL in Base44 app settings
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
];

const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');

  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({
      error: 'Binance API keys not set. Add BINANCE_API_KEY and BINANCE_API_SECRET in Vercel Environment Variables.',
    });
  }

  // Build the Binance path from Vercel's dynamic route params
  // Vercel passes catch-all segments in req.query.path (string or array)
  let pathname = req.query.path || '';
  if (Array.isArray(pathname)) pathname = pathname.join('/');
  if (!pathname.startsWith('/')) pathname = '/' + pathname;

  // Health check
  if (pathname === '/' || pathname === '/health') {
    return res.status(200).json({
      status: 'ok',
      proxy: 'binance-vercel-proxy',
      region: process.env.VERCEL_REGION || 'local',
    });
  }

  try {
    // Build query params
    const params = new URLSearchParams();
    params.set('timestamp', Date.now().toString());
    params.set('recvWindow', '10000');

    // Merge query params from URL (skip the catch-all "path" param)
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key !== 'path') params.set(key, value);
    }

    // Merge body params for POST requests
    if (req.method === 'POST' && req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      for (const [key, value] of Object.entries(body)) {
        params.set(key, String(value));
      }
    }

    // Sign the request
    const signature = crypto.createHmac('sha256', apiSecret).update(params.toString()).digest('hex');
    params.append('signature', signature);

    // Try multiple Binance API endpoints
    let lastData = null;
    let lastStatus = 500;

    for (const host of BINANCE_HOSTS) {
      try {
        const binanceUrl = `${host}${pathname}?${params.toString()}`;
        const response = await fetch(binanceUrl, {
          method: req.method === 'POST' ? 'POST' : 'GET',
          headers: { 'X-MBX-APIKEY': apiKey },
        });

        lastData = await response.text();
        lastStatus = response.status;

        // If we get a non-451 response, return it immediately
        if (response.status !== 451) {
          return res.status(response.status).send(lastData);
        }
      } catch (e) {
        continue;
      }
    }

    // All hosts failed
    return res.status(lastStatus === 451 ? 451 : 502).json({
      error: 'All Binance API endpoints returned errors. If 451 — try changing the region in vercel.json.',
      lastStatus,
    });
  } catch (error) {
    return res.status(502).json({ error: error.message, status: 'proxy_error' });
  }
};