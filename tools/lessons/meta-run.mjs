// Load only the credential needed by the selected job into its child process.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {getBasetenApiKey} from './baseten-key.mjs';
import {getMetaApiKey} from './meta-key.mjs';
const [task,...args]=process.argv.slice(2);
if(task==='--status'){
  const baseten=getBasetenApiKey();
  const meta=getMetaApiKey();
  console.log(JSON.stringify({basetenConfigured:Boolean(baseten.key),basetenCredential:'BASETEN_API_KEY',metaConfigured:Boolean(meta.key),metaCredential:'DD_META_KEY',metaSource:meta.source,valueDisclosed:false}));
  process.exit(0);
}
if(!['batch','repair'].includes(task))throw Error('Use meta-run.mjs --status | batch SOURCES LEDGER NEW_OUTPUT | repair ...');
let env={...process.env};
if(task==='batch'){
  const {key,source}=getBasetenApiKey();
  if(!key)throw Error('BASETEN_API_KEY is unavailable in the environment or named macOS Keychain item. No provider call made.');
  delete env.DD_META_KEY;
  env.BASETEN_API_KEY=key;
  env.DD_BASETEN_KEY_SOURCE=source||'unavailable';
}else{
  const {key,source}=getMetaApiKey();
  if(!key)throw Error('DD_META_KEY is unavailable in the environment or named macOS Keychain item. No Meta request was made.');
  delete env.BASETEN_API_KEY;
  env.DD_META_KEY=key;
  env.DD_META_KEY_SOURCE=source||'unavailable';
}
const script=fileURLToPath(new URL('./'+task+'.mjs',import.meta.url));
const result=spawnSync(process.execPath,[script,...args],{env,stdio:'inherit'});
delete env.BASETEN_API_KEY;delete env.DD_META_KEY;if(result.error)throw Error('Unable to start lesson tool.');process.exitCode=result.status??1;
