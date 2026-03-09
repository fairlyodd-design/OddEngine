
const signals:any[] = []

export function pushSignal(signal:any){

 signals.unshift({
   ...signal,
   time:Date.now()
 })

 console.log("SIGNAL:", signal)

}

export function getSignals(){

 return signals.slice(0,100)

}
