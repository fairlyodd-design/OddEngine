
const paperPositions:any[] = []

export function openPaperTrade(trade:any){

 paperPositions.unshift({
   ...trade,
   status:"OPEN",
   openTime:Date.now()
 })

}

export function closePaperTrade(index:number){

 if(paperPositions[index]){
   paperPositions[index].status="CLOSED"
   paperPositions[index].closeTime=Date.now()
 }

}

export function getPaperTrades(){

 return paperPositions.slice(0,20)

}
