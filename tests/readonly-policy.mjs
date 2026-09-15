import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
if (!process.env.PGLITE_MODULE) throw new Error('PGLITE_MODULE muss auf PGlite index.js zeigen, z. B. aus Hotel-Lab/assets/pglite/')
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)

const db = await PGlite.create()
const policy = readFileSync(new URL('../sql/04_nur_lesen_haerten.sql', import.meta.url), 'utf8')
// PGlite verwendet eine einzelne Datenbank postgres; nur der Zielname variiert.
const testPolicy = policy.replace("ziel_datenbank text := 'hotel'", "ziel_datenbank text := 'postgres'")
let checks = 0
async function denied(sql) {
  await db.exec('BEGIN READ WRITE; SET LOCAL ROLE studi_hotel;')
  try { await assert.rejects(db.exec(sql), e => e.code === '42501'); checks++ }
  finally { await db.exec('ROLLBACK') }
}
try {
  await db.exec(`CREATE ROLE studi_hotel LOGIN;
    CREATE ROLE anderer_login LOGIN;
    CREATE SCHEMA hotel_bi;
    CREATE TABLE hotel_bi.probe(id int);
    INSERT INTO hotel_bi.probe VALUES (1);
    GRANT USAGE ON SCHEMA hotel_bi TO studi_hotel;
    GRANT SELECT ON hotel_bi.probe TO studi_hotel;
    GRANT TEMP ON DATABASE postgres TO studi_hotel;`)
  // Vorher beide Befunde reproduzieren, anschließend alles zurückrollen.
  await db.exec(`BEGIN READ WRITE; SET LOCAL ROLE studi_hotel;
    CREATE TEMP TABLE before_probe(id int);
    SELECT lo_from_bytea(0, ''::bytea); ROLLBACK;`)
  checks++
  // Der Schutz vor versehentlicher Ausführung in einer anderen DB greift.
  await assert.rejects(db.exec(policy), /ausschließlich/)
  await db.exec('ROLLBACK'); checks++
  await db.exec(testPolicy)
  await db.exec(testPolicy) // Wiederholte Ausführung bleibt möglich.
  checks++
  const rights = await db.query(`SELECT
    has_database_privilege('studi_hotel',current_database(),'TEMP') AS demo_temp,
    has_database_privilege('anderer_login',current_database(),'TEMP') AS other_temp,
    has_function_privilege('studi_hotel','pg_catalog.lo_from_bytea(oid,bytea)','EXECUTE') AS demo_lo,
    has_function_privilege('anderer_login','pg_catalog.lo_from_bytea(oid,bytea)','EXECUTE') AS other_lo`)
  assert.deepEqual(rights.rows[0], {demo_temp:false, other_temp:true, demo_lo:false, other_lo:true}); checks++
  for (const sql of [
    'CREATE TEMP TABLE denied_probe(id int)',
    "SELECT lo_from_bytea(0, ''::bytea)", 'SELECT lo_create(0)', 'SELECT lo_creat(-1)',
    'SELECT lo_unlink(0)', "SELECT lo_put(0, 0, ''::bytea)",
    "SELECT lowrite(0, ''::bytea)", 'SELECT lo_truncate(0,0)', 'SELECT lo_truncate64(0,0)',
    'INSERT INTO hotel_bi.probe VALUES (2)', 'UPDATE hotel_bi.probe SET id=2',
    'DELETE FROM hotel_bi.probe', 'TRUNCATE hotel_bi.probe',
    'CREATE TABLE hotel_bi.denied_probe(id int)'
  ]) await denied(sql)
  await db.exec('SET ROLE studi_hotel')
  assert.equal((await db.query('SELECT count(*) FROM hotel_bi.probe')).rows[0].count, 1); checks++
  await db.exec('RESET ROLE; SET ROLE anderer_login; BEGIN; CREATE TEMP TABLE allowed_probe(id int); SELECT lo_from_bytea(0,\'\'::bytea); ROLLBACK; RESET ROLE;')
  checks++
  console.log(`${checks} Prüfungen bestanden; keine Verbindung zur produktiven Datenbank.`)
} finally { await db.close() }
