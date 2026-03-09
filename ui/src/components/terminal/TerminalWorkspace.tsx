
import React from "react"
import TerminalPanel from "./TerminalPanel"

export default function TerminalWorkspace(){

 return (
  <div className="oe-terminal-grid">

    <TerminalPanel title="Market Brain">
      Market regime data
    </TerminalPanel>

    <TerminalPanel title="Order Flow Radar">
      Flow signals
    </TerminalPanel>

    <TerminalPanel title="Institutional AI Trader">
      Trade tickets
    </TerminalPanel>

  </div>
 )
}
