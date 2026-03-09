
export function crossoverStrategies(a:any,b:any){

 return {
   ticker: Math.random()>0.5 ? a.ticker : b.ticker,
   entry: Math.random()>0.5 ? a.entry : b.entry,
   exit: Math.random()>0.5 ? a.exit : b.exit,
   stop: (a.stop + b.stop)/2,
   takeProfit:(a.takeProfit + b.takeProfit)/2
 }

}

export function mutateStrategy(s:any){

 const mutation = Math.random()

 if(mutation > 0.6){
   s.stop = Math.max(0.01, s.stop + (Math.random()-0.5)*0.02)
 }

 if(mutation > 0.7){
   s.takeProfit = Math.max(0.05, s.takeProfit + (Math.random()-0.5)*0.05)
 }

 return s

}
