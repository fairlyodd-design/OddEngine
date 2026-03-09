
export default {

 name:"example-plugin",

 capabilities:["trading.read"],

 activate(ctx:any){

  console.log("Example plugin activated")

 }

}
