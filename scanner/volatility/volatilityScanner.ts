
const volSignals:any[] = []

export function scanVolatility(){

 const tickers = ["SPY","QQQ","NVDA","VIX"]

 const t = tickers[Math.floor(Math.random()*tickers.length)]

 volSignals.unshift({
   type:"VOLATILITY_SPIKE",
   ticker:t,
   level:(Math.random()*100).toFixed(2)
 })

}

export function getVolSignals(){
 return volSignals.slice(0,10)
}
