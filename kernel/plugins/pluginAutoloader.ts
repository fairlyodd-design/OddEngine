
import fs from "fs"
import path from "path"

export function loadPlugins(pluginDir:string){

 const plugins = fs.readdirSync(pluginDir)

 const loaded:any[] = []

 plugins.forEach(p=>{

   const pluginPath = path.join(pluginDir,p,"plugin.json")

   if(fs.existsSync(pluginPath)){

     const meta = JSON.parse(fs.readFileSync(pluginPath,"utf-8"))

     loaded.push({
       name:meta.name,
       version:meta.version,
       path:path.join(pluginDir,p)
     })

   }

 })

 return loaded

}
