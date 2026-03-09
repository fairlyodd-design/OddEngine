
import React,{useEffect,useState} from "react"
import { runNeuralInference,getPredictions } from "../../../core/neural/neuralStrategyEngine"

export default function NeuralStrategyPanel(){

 const [predictions,setPredictions] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    runNeuralInference()

    setPredictions(getPredictions())

  },4000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Neural Strategy Network</div>

   {predictions.map((p,i)=>(

     <div key={i} style={{marginBottom:12}}>

       <b>{p.ticker}</b> — {p.setup}

       <div>
        Probability: {(p.probability*100).toFixed(0)}%
       </div>

       <div>
        Expected Move: {p.expectedMove}%
       </div>

       <div>
        Confidence: {(p.confidence*100).toFixed(0)}%
       </div>

     </div>

   ))}

  </div>

 )

}
