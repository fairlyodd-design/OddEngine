
import React, { useState } from "react"

export default function WindowFrame({title, children}: any) {
  const [pos, setPos] = useState({x: 200, y: 160})

  function drag(e:any){
    setPos({x: e.clientX, y: e.clientY})
  }

  return (
    <div className="windowFrame" style={{left: pos.x, top: pos.y, position:'absolute'}}>
      <div className="windowHeader" onMouseDown={drag}>{title}</div>
      <div className="windowBody">{children}</div>
    </div>
  )
}
