
export function runPluginSafe(plugin:any){

 try{

   console.log("Running plugin:", plugin.name)

   if(plugin.run){
     plugin.run()
   }

 }catch(err){

   console.error("Plugin crashed but sandbox prevented system crash:", err)

 }

}
