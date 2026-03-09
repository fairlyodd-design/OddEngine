
import React from "react"

export default function ActivityTimeline(){

 const items = [
  "Trade executed: NVDA call",
  "Grow room humidity adjusted",
  "Plugin loaded: options-scanner",
  "Workspace switched: Trading Desk"
 ]

 return (

  <div className="activityTimeline">

   <div className="h">Activity</div>

   {items.map((a,i)=>(
     <div key={i} className="activityItem">{a}</div>
   ))}

  </div>

 )

}
