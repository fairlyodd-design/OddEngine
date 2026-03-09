
let portfolio = {
 cash:46,
 positions:[]
}

export function addPosition(pos:any){
 portfolio.positions.push(pos)
}

export function closePosition(index:number){
 portfolio.positions.splice(index,1)
}

export function getPortfolio(){
 return portfolio
}

export function analyzePortfolio(){

 const exposure = portfolio.positions.length * 0.02

 return {
   cash:portfolio.cash,
   openPositions:portfolio.positions.length,
   portfolioRisk:(exposure*100).toFixed(1)+"%"
 }

}
