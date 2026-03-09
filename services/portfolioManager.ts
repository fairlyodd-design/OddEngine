
let portfolio = {
 cash:1000,
 positions:[]
}

export function getPortfolio(){
 return portfolio
}

export function openPosition(pos:any){
 portfolio.positions.push(pos)
}
