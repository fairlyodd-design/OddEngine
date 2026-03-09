
const prints:any[] = []

export function scanDarkPools(){

 const tickers = ["SPY","WBD","NVDA","TQQQ"]

 const t = tickers[Math.floor(Math.random()*tickers.length)]

 prints.unshift({
   ticker:t,
   price:(10 + Math.random()*500).toFixed(2),
   size:Math.floor(Math.random()*200000),
   venue:"DARK_POOL"
 })

}

export function getDarkPoolPrints(){

 return prints.slice(0,20)

}
