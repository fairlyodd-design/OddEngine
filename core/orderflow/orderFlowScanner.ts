
const flows:any[] = []

export function scanOrderFlow(){

 const tickers = ["SPY","TQQQ","NVDA","WBD"]

 const t = tickers[Math.floor(Math.random()*tickers.length)]

 flows.unshift({
   ticker:t,
   type: Math.random()>0.5 ? "CALL_SWEEP" : "PUT_SWEEP",
   size: (Math.random()*5+1).toFixed(1) + "M",
   expiration:"NEXT_WEEK",
   time:Date.now()
 })

}

export function getOrderFlow(){

 return flows.slice(0,20)

}
