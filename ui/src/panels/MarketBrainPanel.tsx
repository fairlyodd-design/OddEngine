
import React,{useEffect,useState} from "react"
import { updateMarketBrain,getMarketBrain } from "../../../core/market-brain/marketBrain"

export default function MarketBrainPanel(){

 const [state,setState] = useState<any>({})

 useEffect(()=>{

  const i = setInterval(()=>{

    updateMarketBrain()

    setState({...getMarketBrain()})

  },4000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Market Brain</div>

   <div>
     <b>Signals</b>
     {(state.signals||[]).map((s:any,i:number)=>(
       <div key={i}>{s}</div>
     ))}
   </div>

   <div style={{marginTop:10}}>

     <b>Correlations</b>

     {(state.correlations||[]).map((c:any,i:number)=>(
       <div key={i}>
        {c.pair}: {c.correlation}
       </div>
     ))}

   </div>

  </div>

 )

}
