# THORChain Proxy & Swap Tracker

A production-ready Node.js implementation for proxying `swap.thorchain.org`, monitoring user swaps, sending Telegram alerts, and automatically generating affiliate memos for high-value swaps (> $50,000).

## Features

- **Proxy Server**: Fetches and modifies THORChain UI to bypass frame restrictions.
- **Same-Origin Interceptor**: Injects a script into the iframe to capture `fetch` and `XHR` calls.
- **Affiliate Memo Injection**: Automatically generates affiliate memos for high-value swaps.
- **Telegram Notifications**: Real-time alerts for every tracked and confirmed swap.
- **In-Memory Cache**: 5-minute cache for modified HTML to reduce latency.
- **Security**: Cleans up pending high-value swaps after 1 hour.

## Prerequisites

- Node.js (v18+ recommended)
- A Telegram Bot (created via @BotFather)
- A THORName and RUNE address for affiliate fees.

## Installation

1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Update the `.env` file with your actual Telegram tokens and THORChain details.

## Running the Server

### Locally
```bash
npm start
```
The server will be available at `http://localhost:3000`.

### Production with PM2
We recommend using **PM2** for process management in production.
```bash
# Install PM2 globally
npm install pm2 -g

# Start the application
pm2 start server.js --name "thorchain-proxy"

# Enable startup script
pm2 startup
pm2 save
```

## Production Recommendations

### 1. Caching with Redis
While this implementation uses a simple in-memory cache, for high-traffic production environments, we recommend **Redis**.
- Replace `htmlCache` logic in `server.js` with `redis.get` and `redis.setex`.
- This ensures cache persistence across server restarts and scalability across multiple nodes.

### 2. Rate Limiting
To prevent abuse of your proxy and endpoints, add `express-rate-limit`:
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/track-swap', limiter);
```

### 3. API Key Protection
Add a simple middleware to protect your `/track-swap` and `/confirm-swap` endpoints if you want to ensure only your frontend can call them:
```javascript
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.INTERNAL_API_KEY) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
};
```

## URL Rewriting Note
The proxy currently uses `cheerio` to rewrite relative URLs to `https://swap.thorchain.org`. If the THORChain UI changes its asset structure (e.g., moves away from standard Next.js paths), you may need to update the selector logic in `server.js` within the `/proxy` endpoint.

## License
MIT
