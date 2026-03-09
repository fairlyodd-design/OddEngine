
const alerts:any[] = []

export function scanUnusualOptions(){

 const tickers = ["SPY","QQQ","NVDA","WBD","TQQQ"]

 const t = tickers[Math.floor(Math.random()*tickers.length)]

 alerts.unshift({
   type:"UNUSUAL_OPTIONS",
   ticker:t,
   size:(Math.random()*5+1).toFixed(1)+"M",
   direction: Math.random()>0.5 ? "CALLS" : "PUTS"
 })

}

export function getOptionsAlerts(){
 return alerts.slice(0,10)
}
