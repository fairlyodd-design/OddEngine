
import React from "react"

export default function InfinityPluginMarketplace(){

 const plugins=[
  "Options Scanner",
  "Grow Automation",
  "Crypto Radar",
  "Mining Control",
  "Family Planner",
  "Writer Studio"
 ]

 return(
  <div className="pluginMarket">

   <h3>Plugin Marketplace</h3>

   {plugins.map(p=>(
    <div key={p} className="pluginItem">
      {p}
      <button>Install</button>
    </div>
   ))}

  </div>
 )
}
