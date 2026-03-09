
const alerts:any[] = []

export function pushAgentAlert(alert:any){

 alerts.unshift({
   ...alert,
   time:Date.now()
 })

 console.log("AGENT ALERT:",alert.message)

}

export function getAgentAlerts(){

 return alerts.slice(0,50)

}
