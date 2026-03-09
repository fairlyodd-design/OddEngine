
export async function getTradingContext(){

 return {
  openPositions: [],
  watchlist: ["NVDA","SPY","BTC"],
  lastScan: Date.now()
 }

}
