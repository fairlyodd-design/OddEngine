
import React,{useEffect,useState} from "react"
import { getPortfolio,analyzePortfolio } from "../../../portfolio/engine/portfolioAI"
import { calculatePnL } from "../../../portfolio/engine/pnlCalculator"

export default function PortfolioAIPanel(){

 const [data,setData] = useState<any>({})
 const [positions,setPositions] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{

     const portfolio = getPortfolio()
     const analysis = analyzePortfolio()

     const pnl = portfolio.positions.map(p=>calculatePnL(p))

     setData(analysis)
     setPositions(pnl)

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

   <div className="panel">

     <div className="h">Portfolio AI</div>

     <div>Cash: ${data.cash}</div>
     <div>Open Positions: {data.openPositions}</div>
     <div>Portfolio Risk: {data.portfolioRisk}</div>

     <div style={{marginTop:10}}>

       {positions.map((p,i)=>(
         <div key={i}>
           {p.ticker} PnL {p.pnl}
         </div>
       ))}

     </div>

   </div>

 )

}
