
import React from "react"

export default function TerminalPanel({title,children}:any){

 return (
  <div className="oe-terminal-panel">
    <div className="oe-terminal-header">{title}</div>
    <div className="oe-terminal-body">{children}</div>
  </div>
 )
}
