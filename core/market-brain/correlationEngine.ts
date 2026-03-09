
export function computeCorrelations(data:any){

 const pairs = [
  ["SPY","VIX"],
  ["QQQ","NVDA"],
  ["TQQQ","SPY"],
  ["WBD","SPY"]
 ]

 return pairs.map(p=>{
   return {
     pair:p.join("-"),
     correlation:(Math.random()*2-1).toFixed(2)
   }
 })

}
