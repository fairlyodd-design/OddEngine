
import React from "react"

export default function MarketTerminalBar(){

 const symbols = [
  {symbol:"SPY", price:520.22},
  {symbol:"NVDA", price:910.11},
  {symbol:"BTC", price:64000},
  {symbol:"ETH", price:3500}
 ]

 return (

  <div className="marketBar">

   {symbols.map(s => (

    <div key={s.symbol} className="ticker">
      {s.symbol} {s.price}
    </div>

   ))}

  </div>

 )

}
