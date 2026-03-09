
let orders:any[] = []

export function createOrder(order:any){
 orders.push({
   ...order,
   status:"PENDING",
   created:Date.now()
 })
}

export function getOrders(){
 return orders
}

export function updateOrderStatus(index:number,status:string){
 if(!orders[index]) return
 orders[index].status = status
}
