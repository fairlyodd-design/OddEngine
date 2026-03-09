
import React,{useEffect,useState} from "react"
import { getTickerSnapshot } from "../../../../market/bar/marketTickerFeed"

export default function MarketCommandBar(){

 const [tickers,setTickers] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{
     setTickers(getTickerSnapshot())
   },2000)

   return ()=>clearInterval(i)

 },[])

 return (

  <div className="oe-commandbar">

   {tickers.map((t,i)=>(
     <div key={i} className="oe-ticker">
       {t.symbol} {t.price}
     </div>
   ))}

   <input
     className="oe-command-input"
     placeholder="Type command or ticker..."
   />

  </div>

 )

}
