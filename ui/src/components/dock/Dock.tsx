
import React from "react"

export default function Dock(){
 const items=[
  "Trading",
  "Grow",
  "Money",
  "Writing",
  "Family"
 ]

 return(
  <div className="dock">
   {items.map(i=>(<button key={i}>{i}</button>))}
  </div>
 )
}
