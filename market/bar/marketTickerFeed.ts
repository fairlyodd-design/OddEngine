
const tickers = ["SPY","QQQ","NVDA","VIX","WBD"]

export function getTickerSnapshot(){
 return tickers.map(t=>({
   symbol:t,
   price:(Math.random()*500+10).toFixed(2),
   change:(Math.random()*2-1).toFixed(2)
 }))
}
