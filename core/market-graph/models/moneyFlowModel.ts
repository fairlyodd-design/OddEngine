
export function detectMoneyFlow(edges:any){

 return edges.map((e:any)=>{

   return {
     path: e.from + " → " + e.to,
     strength:(Math.random()*1).toFixed(2)
   }

 })

}
