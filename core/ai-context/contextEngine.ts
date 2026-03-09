
import { getTradingContext } from "./providers/tradingContext"
import { getActivityContext } from "./providers/activityContext"

export async function buildAIContext(){

 const trading = await getTradingContext()
 const activity = await getActivityContext()

 return {
  trading,
  activity
 }

}
