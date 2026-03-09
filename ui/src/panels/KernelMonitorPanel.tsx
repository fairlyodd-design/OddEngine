
import React,{useEffect,useState} from "react"

export default function KernelMonitorPanel(){

 const [events,setEvents] = useState<string[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    setEvents(e=>[
      "Kernel heartbeat "+Date.now(),
      ...e.slice(0,10)
    ])

  },2000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Kernel Monitor</div>

   {events.map((e,i)=>(
     <div key={i}>{e}</div>
   ))}

  </div>

 )
}
