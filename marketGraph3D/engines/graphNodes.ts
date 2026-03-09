
export interface GraphNode {
 ticker:string
 sector:string
 x:number
 y:number
 z:number
}

export function getNodes(){

 return [
  {ticker:"SPY",sector:"INDEX",x:0,y:0,z:0},
  {ticker:"TQQQ",sector:"INDEX",x:1,y:0,z:0},
  {ticker:"NVDA",sector:"TECH",x:2,y:1,z:0},
  {ticker:"AMD",sector:"TECH",x:3,y:1,z:0},
  {ticker:"WBD",sector:"MEDIA",x:-2,y:1,z:0},
  {ticker:"XLE",sector:"ENERGY",x:-1,y:-1,z:0},
  {ticker:"XLF",sector:"FINANCE",x:1,y:-2,z:0}
 ]

}
