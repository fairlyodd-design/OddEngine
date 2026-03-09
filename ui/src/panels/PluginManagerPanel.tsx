
import React,{useEffect,useState} from "react"

export default function PluginManagerPanel(){

 const [plugins,setPlugins] = useState<any[]>([])

 useEffect(()=>{

   // mock plugin discovery
   setPlugins([
     {name:"orderFlowRadar"},
     {name:"sectorRotation"},
     {name:"exampleSafePlugin"}
   ])

 },[])

 return (

  <div className="panel">

   <div className="h">Plugin Manager</div>

   {plugins.map((p,i)=>(

     <div key={i}>
       {p.name}
     </div>

   ))}

  </div>

 )

}
