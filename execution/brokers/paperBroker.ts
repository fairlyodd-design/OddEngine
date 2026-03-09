
import { createOrder } from "../orders/orderManager"

export function sendPaperOrder(order:any){

 createOrder({
   ...order,
   broker:"PAPER"
 })

 return {
   success:true,
   message:"Paper trade executed"
 }

}
