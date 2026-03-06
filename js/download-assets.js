const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = __dirname;

// All files the Svelte bundles try to load
const FILES = [
  // ─── Integrated partner logos (from thorchain.org) ───
  ['images/integrated/thorswap.png', 'https://thorchain.org/images/integrated/thorswap.png'],
  ['images/integrated/trust.svg', 'https://thorchain.org/images/integrated/trust.svg'],
  ['images/integrated/ledger.svg', 'https://thorchain.org/images/integrated/ledger.svg'],
  ['images/integrated/okxwallet.png', 'https://thorchain.org/images/integrated/okxwallet.png'],
  ['images/integrated/bitget_logo.png', 'https://thorchain.org/images/integrated/bitget_logo.png'],
  ['images/integrated/shapeshift.png', 'https://thorchain.org/images/integrated/shapeshift.png'],
  ['images/integrated/thorwallet.png', 'https://thorchain.org/images/integrated/thorwallet.png'],
  ['images/integrated/lifi.svg', 'https://thorchain.org/images/integrated/lifi.svg'],
  ['images/integrated/zengo.svg', 'https://thorchain.org/images/integrated/zengo.svg'],
  ['images/integrated/coin98.svg', 'https://thorchain.org/images/integrated/coin98.svg'],
  ['images/integrated/unstoppablewallet.png', 'https://thorchain.org/images/integrated/unstoppablewallet.png'],
  ['images/integrated/jumper.png', 'https://thorchain.org/images/integrated/jumper.png'],
  ['images/integrated/CTRL.svg', 'https://thorchain.org/images/integrated/CTRL.svg'],
  ['images/integrated/asgardex.svg', 'https://thorchain.org/images/integrated/asgardex.svg'],
  ['images/integrated/symbiosis.svg', 'https://thorchain.org/images/integrated/symbiosis.svg'],
  ['images/integrated/keplr.svg', 'https://thorchain.org/images/integrated/keplr.svg'],
  ['images/integrated/rango.png', 'https://thorchain.org/images/integrated/rango.png'],
  ['images/integrated/tokenpocket.png', 'https://thorchain.org/images/integrated/tokenpocket.png'],
  ['images/integrated/vultisig.png', 'https://thorchain.org/images/integrated/vultisig.png'],
  ['images/integrated/unizen.png', 'https://thorchain.org/images/integrated/unizen.png'],
  ['images/integrated/edge.png', 'https://thorchain.org/images/integrated/edge.png'],
  ['images/integrated/openocean.svg', 'https://thorchain.org/images/integrated/openocean.svg'],
  ['images/integrated/SwapKit.png', 'https://thorchain.org/images/integrated/SwapKit.png'],

  // ─── Coin logos the Svelte code needs ───
  ['images/coins/TCY.svg', 'https://thorchain.org/images/coins/TCY.svg'],
  ['images/coins/binance-coin-bnb-logo.svg', 'https://thorchain.org/images/coins/binance-coin-bnb-logo.svg'],
  ['images/coins/usd-coin-usdc-logo.svg', 'https://thorchain.org/images/coins/usd-coin-usdc-logo.svg'],
  ['images/coins/tether-usdt-logo.svg', 'https://thorchain.org/images/coins/tether-usdt-logo.svg'],
  ['images/coins/wrapped-bitcoin-wbtc-logo.svg', 'https://thorchain.org/images/coins/wrapped-bitcoin-wbtc-logo.svg'],
  ['images/coins/multi-collateral-dai-dai-logo.svg', 'https://thorchain.org/images/coins/multi-collateral-dai-dai-logo.svg'],
  ['images/coins/gemini-dollar-gusd-logo.svg', 'https://thorchain.org/images/coins/gemini-dollar-gusd-logo.svg'],
  ['images/coins/liquity-usd-logo.svg', 'https://thorchain.org/images/coins/liquity-usd-logo.svg'],
  ['images/coins/paxos-standard-usdp-logo.svg', 'https://thorchain.org/images/coins/paxos-standard-usdp-logo.svg'],
  ['images/coins/bitcoin-cash-bch-logo.svg', 'https://thorchain.org/images/coins/bitcoin-cash-bch-logo.svg'],
  ['images/coins/litecoin-ltc-logo.svg', 'https://thorchain.org/images/coins/litecoin-ltc-logo.svg'],
  ['images/coins/avalanche-avax-logo.svg', 'https://thorchain.org/images/coins/avalanche-avax-logo.svg'],
  ['images/coins/cosmos-atom-logo.svg', 'https://thorchain.org/images/coins/cosmos-atom-logo.svg'],
  ['images/coins/dogecoin-doge-logo.svg', 'https://thorchain.org/images/coins/dogecoin-doge-logo.svg'],
  ['images/coins/xrp-xrp-logo.svg', 'https://thorchain.org/images/coins/xrp-xrp-logo.svg'],

  // ─── Video poster ───
  ['images/video-posters/home-hero-poster.png', 'https://thorchain.org/images/video-posters/home-hero-poster.png'],
  ['images/video-posters/home-hero-poster.jpg', 'https://thorchain.org/images/video-posters/home-hero-poster.jpg'],

  // ─── Video ───
  ['videos/home-hero.mp4', 'https://thorchain.org/videos/home-hero.mp4'],

  // ─── Fallback logo ───
  ['assets/coins/fallback-logo.svg', 'https://thorchain.org/assets/coins/fallback-logo.svg'],

  // ─── Svelte error page (create a minimal one) ───
  // This one we'll handle separately
];

function download(localPath, url) {
  return new Promise((resolve) => {
    const fullPath = path.join(BASE, localPath);
    const dir = path.dirname(fullPath);

    // Create directory
    fs.mkdirSync(dir, { recursive: true });

    // Skip if already exists
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.size > 0) {
        console.log(`  SKIP ${localPath} (exists, ${stat.size} bytes)`);
        resolve(true);
        return;
      }
    }

    const getter = url.startsWith('https') ? https : http;

    getter.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`  REDIRECT ${localPath} -> ${res.headers.location}`);
        download(localPath, res.headers.location).then(resolve);
        return;
      }

      if (res.statusCode !== 200) {
        console.log(`  FAIL ${localPath} (HTTP ${res.statusCode})`);
        resolve(false);
        return;
      }

      const file = fs.createWriteStream(fullPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(fullPath).size;
        console.log(`  OK   ${localPath} (${size} bytes)`);
        resolve(true);
      });
    }).on('error', (err) => {
      console.log(`  ERR  ${localPath}: ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('Downloading missing assets from thorchain.org...\n');

  let ok = 0, fail = 0;

  for (const [local, url] of FILES) {
    const result = await download(local, url);
    if (result) ok++; else fail++;
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 100));
  }

  // Create the Svelte error page stub
  const errorPath = path.join(BASE, '_app/immutable/error.svelte-6244b8fa.js');
  if (!fs.existsSync(errorPath)) {
    fs.mkdirSync(path.dirname(errorPath), { recursive: true });
    fs.writeFileSync(errorPath, 'export default function(){return{}}; export const hydrate = true;');
    console.log('  OK   _app/immutable/error.svelte-6244b8fa.js (stub created)');
    ok++;
  }

  console.log(`\nDone! ${ok} succeeded, ${fail} failed.`);
}

main();