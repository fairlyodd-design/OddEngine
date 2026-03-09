
export interface MarketNode {
 ticker:string
 sector:string
}

export const nodes:MarketNode[] = [
 {ticker:"SPY",sector:"INDEX"},
 {ticker:"TQQQ",sector:"INDEX"},
 {ticker:"VIX",sector:"VOL"},
 {ticker:"NVDA",sector:"TECH"},
 {ticker:"AMD",sector:"TECH"},
 {ticker:"WBD",sector:"MEDIA"},
 {ticker:"XLE",sector:"ENERGY"},
 {ticker:"XLF",sector:"FINANCE"}
]

export function getMarketNodes(){
 return nodes
}
