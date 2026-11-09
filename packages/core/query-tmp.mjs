import { createClient } from '@libsql/client'
import os from 'node:os'
import path from 'node:path'
const file = path.join(os.homedir(), 'AppData', 'Roaming', '梦幻里程', 'data.db')
const db = createClient({ url: 'file:' + encodeURI(file.split(path.sep).join('/')) })
const q = async (s) => (await db.execute(s)).rows
console.log(JSON.stringify(await q("select id,name,type,rules,remind_enabled,remind_before,remind_at_start from game_source where rules <> '[]'"), null, 1))
console.log('records', JSON.stringify(await q('select count(*) n from mileage_record')))
console.log('teams', JSON.stringify(await q('select * from game_team')))
console.log('prices', JSON.stringify(await q('select count(*) n from item_price')))
