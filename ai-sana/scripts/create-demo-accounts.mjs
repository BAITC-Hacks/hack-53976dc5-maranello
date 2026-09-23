import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const destination=process.argv[2];
if(!destination) throw new Error('Usage: node scripts/create-demo-accounts.mjs PRIVATE_JSON_PATH_OUTSIDE_REPOSITORY');
const output=path.resolve(destination),relative=path.relative(process.cwd(),output);
if(!relative.startsWith('..'+path.sep) && !path.isAbsolute(relative)) throw new Error('Save credentials outside the repository.');
if(existsSync(output)) throw new Error('Credentials file already exists.');
const envPath=path.resolve('.dev.vars');
const current=existsSync(envPath)?readFileSync(envPath,'utf8'):'';
if(/^APP_ACCOUNTS=.+$/m.test(current)) throw new Error('Accounts already configured; explicit rotation is required.');
const records=['business','student'].map(role=>{
  const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
  return {id:`app-${role}-${randomUUID()}`,username:role,displayName:role==='business'?'Тестовый бизнес':'Тестовый студент',email:`${role}@demo.invalid`,role,salt,passwordHash:pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex'),password};
});
const config=records.map(({password,...account})=>account);
writeFileSync(output,JSON.stringify(records,null,2),{flag:'wx',mode:0o600});
writeFileSync(envPath,current.replace(/^APP_ACCOUNTS=.*\r?\n?/gm,'').trimEnd()+"\nAPP_ACCOUNTS='"+JSON.stringify(config)+"'\n",{mode:0o600});
console.log('Two test accounts created. Credentials are in the private JSON file; APP_ACCOUNTS is in .dev.vars.');
