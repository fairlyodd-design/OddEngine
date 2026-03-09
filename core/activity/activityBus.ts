
type Activity = {
 type:string
 message:string
 time:number
}

const log:Activity[] = []

export function pushActivity(type:string,message:string){

 log.push({
  type,
  message,
  time:Date.now()
 })

}

export function getActivity(){

 return log

}
