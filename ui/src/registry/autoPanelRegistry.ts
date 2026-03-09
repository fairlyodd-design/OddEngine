
import MarketIntelligencePanel from "../panels/MarketIntelligencePanel"
import MarketGraph3DPanel from "../panels/MarketGraph3DPanel"
import CapitalFlowPanel from "../panels/CapitalFlowPanel"
import HolographicMarketMapPanel from "../panels/HolographicMarketMapPanel"
import GalacticMarketSimulatorPanel from "../panels/GalacticMarketSimulatorPanel"
import MarketTimeMachinePanel from "../panels/MarketTimeMachinePanel"

export const AutoPanels = [
 { id:"market-map", title:"Market Intelligence Map", component:MarketIntelligencePanel },
 { id:"market-graph-3d", title:"3D Market Graph", component:MarketGraph3DPanel },
 { id:"capital-flow", title:"Capital Flow Engine", component:CapitalFlowPanel },
 { id:"holographic-map", title:"Holographic Market Map", component:HolographicMarketMapPanel },
 { id:"galactic-simulator", title:"Galactic Market Simulator", component:GalacticMarketSimulatorPanel },
 { id:"time-machine", title:"AI Market Time Machine", component:MarketTimeMachinePanel }
]
