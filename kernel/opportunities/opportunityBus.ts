
const listeners:any[] = []

export function publishOpportunity(data:any){
 listeners.forEach(l=>l(data))
}

export function onOpportunity(handler:any){
 listeners.push(handler)
}
