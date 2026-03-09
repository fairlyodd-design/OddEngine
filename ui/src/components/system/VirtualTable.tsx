
import React from "react"

export default function VirtualTable({rows}:any){

 const max = 200
 const visible = rows.slice(0,max)

 return (

  <div>

   {visible.map((r:any,i:number)=>(
     <div key={i}>
       {JSON.stringify(r)}
     </div>
   ))}

   {rows.length>max && (
     <div>Showing {max} of {rows.length}</div>
   )}

  </div>

 )

}
