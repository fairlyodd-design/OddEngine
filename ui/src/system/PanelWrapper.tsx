
import React from "react"
import ErrorBoundary from "./ErrorBoundary"

export default function PanelWrapper({children}:any){

 return (

  <ErrorBoundary>
   <div className="panelWrapper">
     {children}
   </div>
  </ErrorBoundary>

 )

}
