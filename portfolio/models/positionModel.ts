
export function createPosition(ticker:string,strategy:string,size:number){

 return {
   ticker,
   strategy,
   size,
   entry:Date.now(),
   status:"OPEN"
 }

}
