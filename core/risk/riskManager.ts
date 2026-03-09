
export function calculatePositionSize(account:number, riskPercent:number){

 const risk = account * riskPercent

 return {
  maxRisk:risk.toFixed(2),
  suggestedContracts: Math.max(1, Math.floor(risk / 20))
 }

}
