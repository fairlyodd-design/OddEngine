
const nodes = [
 {id:"SPY", type:"ETF"},
 {id:"QQQ", type:"ETF"},
 {id:"TQQQ", type:"ETF"},
 {id:"NVDA", type:"STOCK"},
 {id:"WBD", type:"STOCK"},
 {id:"VIX", type:"VOL"}
]

const edges = [
 {from:"SPY", to:"VIX"},
 {from:"QQQ", to:"NVDA"},
 {from:"TQQQ", to:"QQQ"},
 {from:"SPY", to:"WBD"}
]

export function getMarketGraph(){

 return {
  nodes,
  edges
 }

}
