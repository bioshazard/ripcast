import { Database } from "bun:sqlite";

const db = new Database("db.sqlite", { create: true })

db.exec("PRAGMA journal_mode = WAL;");

export { db }

// const db = new Database(":memory:");
// const query = db.query("select 'Hello world' as message;");
// const out = query.get(); // => { message: "Hello world" }
// console.log(out)