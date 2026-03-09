
import { loadPlugin } from "./pluginHost"

export async function autoLoadPlugins(){

 try{

  const plugins = import.meta.glob("/plugins/**/index.ts")

  for(const path in plugins){

   const module:any = await plugins[path]()

   const plugin = module.default || module

   if(!plugin) continue

   console.log("Auto loading plugin:",plugin.name || path)

   loadPlugin(plugin,{
    events:{},
    state:{},
    ui:{},
   })

  }

 }catch(err){

  console.warn("Plugin autoload failed",err)

 }

}
