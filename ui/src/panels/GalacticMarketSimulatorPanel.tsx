
import React,{useEffect,useState} from "react"
import { getSectorGalaxies } from "../../../galacticMarket/engines/sectorGalaxies"
import { getSignalConstellations } from "../../../galacticMarket/engines/constellations"
import { getCapitalOrbits } from "../../../galacticMarket/engines/capitalOrbits"

export default function GalacticMarketSimulatorPanel(){

 const [galaxies,setGalaxies] = useState<any[]>([])
 const [signals,setSignals] = useState<any[]>([])
 const [orbits,setOrbits] = useState<any[]>([])

 useEffect(()=>{

   const i=setInterval(()=>{

     setGalaxies(getSectorGalaxies())
     setSignals(getSignalConstellations())
     setOrbits(getCapitalOrbits())

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

   <div className="panel">

     <div className="h">Galactic Market Simulator</div>

     <div style={{marginTop:10}}>

       <div><b>Sector Galaxies</b></div>
       {galaxies.map((g,i)=>(
        <div key={i}>{g.sector} galaxy radius {g.radius}</div>
       ))}

       <div style={{marginTop:10}}><b>AI Constellations</b></div>
       {signals.map((s,i)=>(
        <div key={i}>{s.ticker} constellation → {s.signal}</div>
       ))}

       <div style={{marginTop:10}}><b>Capital Orbits</b></div>
       {orbits.map((o,i)=>(
        <div key={i}>{o.from} orbiting → {o.to}</div>
       ))}

     </div>

   </div>

 )

}
