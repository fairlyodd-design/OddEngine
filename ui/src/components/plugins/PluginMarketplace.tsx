
import React from "react"

export default function PluginMarketplace(){

 const plugins=[
  {name:"Trading Tools"},
  {name:"Grow Dashboard"},
  {name:"Crypto Radar"},
  {name:"Mining Monitor"},
 ]

 return(
  <div className="pluginMarket">
   <h2>Plugin Marketplace</h2>

   {plugins.map(p=>(
    <div key={p.name} className="pluginCard">
      <b>{p.name}</b>
      <button>Install</button>
    </div>
   ))}

  </div>
 )
}
