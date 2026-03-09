
import React from "react"
import { AutoPanels } from "../registry/autoPanelRegistry"

export default function MarketIntelligenceWorkspace(){

 return (

  <div className="workspace">

    <div className="workspaceHeader">
      Market Intelligence
    </div>

    <div className="workspaceGrid">

      {AutoPanels.map((panel)=>(

        <div key={panel.id} className="workspacePanel">
          <panel.component />
        </div>

      ))}

    </div>

  </div>

 )

}
