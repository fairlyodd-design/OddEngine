
export function parseTradingCommand(input:string){

 if(input.includes("scan nvda")){
  return "scan.nvda"
 }

 if(input.includes("scan spy")){
  return "scan.spy"
 }

 return null
}
