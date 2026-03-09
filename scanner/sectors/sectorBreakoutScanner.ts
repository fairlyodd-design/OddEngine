
const sectorSignals:any[] = []

export function scanSectorBreakouts(){

 const sectors = ["TECH","SEMICONDUCTORS","ENERGY","MEDIA"]

 const s = sectors[Math.floor(Math.random()*sectors.length)]

 sectorSignals.unshift({
   type:"SECTOR_BREAKOUT",
   sector:s,
   momentum:(Math.random()*1).toFixed(2)
 })

}

export function getSectorSignals(){
 return sectorSignals.slice(0,10)
}
