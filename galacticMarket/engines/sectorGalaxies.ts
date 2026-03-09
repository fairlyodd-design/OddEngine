
export interface Galaxy {
 sector:string
 radius:number
 rotation:number
}

export function getSectorGalaxies(){

 return [
  {sector:"TECH",radius:3,rotation:0.02},
  {sector:"ENERGY",radius:4,rotation:0.015},
  {sector:"MEDIA",radius:2.5,rotation:0.018},
  {sector:"FINANCE",radius:3.5,rotation:0.012},
  {sector:"INDEX",radius:5,rotation:0.01}
 ]

}
