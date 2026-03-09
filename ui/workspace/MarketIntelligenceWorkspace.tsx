import React from "react"

import HolographicMarketMapPanel from "../panels/HolographicMarketMapPanel"
import GalacticMarketSimulatorPanel from "../panels/GalacticMarketSimulatorPanel"
import MarketTimeMachinePanel from "../panels/MarketTimeMachinePanel"

export default function MarketIntelligenceWorkspace(){

 return(

  <div style={{
    display:"grid",
    gridTemplateColumns:"1fr 1fr",
    gap:16,
    padding:16
  }}>

   <HolographicMarketMapPanel/>
   <GalacticMarketSimulatorPanel/>
   <MarketTimeMachinePanel/>

  </div>

 )

}