
const momentumSignals:any[] = []

export function scanMomentum(){

 const tickers = ["NVDA","WBD","SPY","TQQQ"]

 const t = tickers[Math.floor(Math.random()*tickers.length)]

 momentumSignals.unshift({
   type:"MOMENTUM_SETUP",
   ticker:t,
   strength:(Math.random()*1).toFixed(2)
 })

}

export function getMomentumSignals(){
 return momentumSignals.slice(0,10)
}
