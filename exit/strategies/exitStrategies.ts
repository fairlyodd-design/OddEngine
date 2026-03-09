
export function takeProfit(position:any){

 if(position.pnl >= 30){
   return {action:"TAKE_PROFIT", reason:"Target reached"}
 }

 return null
}

export function stopLoss(position:any){

 if(position.pnl <= -20){
   return {action:"STOP_LOSS", reason:"Risk threshold hit"}
 }

 return null
}

export function trailingStop(position:any){

 if(position.pnl >= 15 && position.pnlDrop >= 5){
   return {action:"TRAIL_STOP", reason:"Trailing stop triggered"}
 }

 return null
}
