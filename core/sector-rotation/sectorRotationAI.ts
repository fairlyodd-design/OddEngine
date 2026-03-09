
const sectors = [
 "TECH",
 "ENERGY",
 "FINANCE",
 "MEDIA",
 "SEMICONDUCTORS"
]

let sectorState:any[] = []

export function updateSectorRotation(){

 sectorState = sectors.map(s=>{

   return {
     sector:s,
     momentum:(Math.random()*2-1).toFixed(2),
     inflow:(Math.random()*100).toFixed(0)
   }

 })

 sectorState.sort((a,b)=>b.momentum-a.momentum)

}

export function getSectorLeaders(){

 return sectorState.slice(0,3)

}

export function getSectorState(){

 return sectorState

}
