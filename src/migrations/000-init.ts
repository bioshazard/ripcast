import { db } from '../lib/db.js'

db.query(`CREATE TABLE sources(
  url UNIQUE,
  created DATETIME DEFAULT CURRENT_TIMESTAMP,
  status DEFAULT "pending",
  title,
  filepath,
  published
)`).run()