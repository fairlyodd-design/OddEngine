
export function approveTrade(account:number, riskPercent:number){

 const maxRisk = account * riskPercent

 if(maxRisk < 1){
   return {
     approved:false,
     reason:"Account too small for configured risk"
   }
 }

 return {
   approved:true
 }

}
