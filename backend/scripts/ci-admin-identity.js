// CI-only bootstrap. A named account is not an administrator: embed its actual
// authenticated UUID into the disposable integration bundle's allowlist.
const fs = require('fs');
const path = require('path');
const { Client } = require('@heroiclabs/nakama-js');

async function main() {
  if (process.env.CI !== 'true') throw new Error('CI admin bootstrap requires CI=true');
  const envPath = path.resolve(__dirname, '../.env');
  const env = fs.readFileSync(envPath, 'utf8');
  if (!/^TEST_FIXTURE_RPCS_ENABLED=true$/m.test(env)) {
    throw new Error('CI admin bootstrap requires the disposable fixture bundle');
  }
  const client = new Client(
    process.env.NAKAMA_SERVER_KEY, '127.0.0.1', '7350', false, 10000, false
  );
  const session = await client.authenticateEmail('admin@test.local', 'admin123', true, 'admin');
  const id = session.user_id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) {
    throw new Error('CI admin account did not return a UUID v4');
  }
  const updated = env.replace(/^ADMIN_USER_IDS=.*(?:\r?\n|$)/gm, '');
  fs.writeFileSync(envPath, `${updated.trimEnd()}\nADMIN_USER_IDS=${id}\n`);
  console.log('CI-only admin allowlist written from authenticated identity');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
