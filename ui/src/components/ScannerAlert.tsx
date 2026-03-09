
import React from "react"

export default function ScannerAlert({alert}:any){

 return (
   <div className="oe-alert">
     {alert.type} — {alert.ticker || alert.sector}
   </div>
 )

}
