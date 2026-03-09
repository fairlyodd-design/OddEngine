
import React from "react"
import MarketTerminalBar from "./components/MarketTerminalBar"
import ActivityTimeline from "./components/ActivityTimeline"
import AIOperator from "./components/AIOperator"
import PluginManager from "../plugin-system/PluginManager"
import WorkspaceSelector from "../workspace/WorkspaceSelector"

export default function OmniverseDesktop(){

 return (

  <div className="omniverseDesktop">

   <MarketTerminalBar/>

   <div className="omniverseMain">

     <div className="omniverseLeft">
       <PluginManager/>
       <WorkspaceSelector/>
     </div>

     <div className="omniverseCenter">
       <div className="workspaceArea">
         {/* workspace windows mount here */}
       </div>
     </div>

     <div className="omniverseRight">
       <AIOperator/>
       <ActivityTimeline/>
     </div>

   </div>

  </div>

 )

}
