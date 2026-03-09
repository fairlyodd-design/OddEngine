
import React from "react"
import DockablePanel from "../components/DockablePanel"

export default function WorkspacePanel(){

 return (

 <div className="oe-workspace">

  <DockablePanel title="Market Brain">
    Market regime info
  </DockablePanel>

  <DockablePanel title="Order Flow Radar">
    Flow data
  </DockablePanel>

  <DockablePanel title="AI Trader">
    Trade suggestions
  </DockablePanel>

 </div>

 )

}
