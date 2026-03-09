
export function suggestOptionsContract(ticker:string, price:number){

 const target = price * 1.03

 return {
  strike: Math.round(target),
  type:"CALL"
 }

}
