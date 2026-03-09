
const listeners:any[] = []

export function sendAlert(alert:any){
 listeners.forEach(l=>l(alert))
}

export function onAlert(handler:any){
 listeners.push(handler)
}
