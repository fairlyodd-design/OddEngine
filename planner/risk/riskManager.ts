
export function calculatePositionSize(account:number, riskPercent:number){

 const riskAmount = account * riskPercent

 const contractCost = 50

 const contracts = Math.max(1,Math.floor(riskAmount / contractCost))

 return contracts

}
