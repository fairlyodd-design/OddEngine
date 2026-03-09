
export interface UniverseNode {
 ticker:string
 sector:string
 energy:number
}

export function getUniverseNodes(){

 return [
  {ticker:"SPY",sector:"INDEX",energy:0.9},
  {ticker:"NVDA",sector:"TECH",energy:0.95},
  {ticker:"AMD",sector:"TECH",energy:0.82},
  {ticker:"WBD",sector:"MEDIA",energy:0.61},
  {ticker:"XLE",sector:"ENERGY",energy:0.74},
  {ticker:"XLF",sector:"FINANCE",energy:0.66}
 ]

}
