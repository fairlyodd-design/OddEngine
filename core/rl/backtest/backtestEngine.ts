
export async function backtestStrategy(strategy:any){

 const trades = Math.floor(Math.random()*50)+10
 const wins = Math.floor(trades*(0.4+Math.random()*0.3))
 const winRate = wins/trades

 const score = winRate * (0.5+Math.random())

 return {
  trades,
  winRate,
  score
 }

}
