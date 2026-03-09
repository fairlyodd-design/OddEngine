
export function calculatePnL(position:any){

 const move = (Math.random()*20-10)

 return {
   ticker:position.ticker,
   pnl:move.toFixed(2)+"%"
 }

}
