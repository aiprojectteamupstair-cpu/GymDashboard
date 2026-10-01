import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandHandler } from '../supabase/functions/gym-commands/handler.js';
import { createCommandSender } from '../src/supabase/commands.js';
import { readAll } from '../src/supabase/readData.js';
import { initialAnalysisPeriod, attendanceCoverage } from '../src/prototype/coverage.js';

test('attendance reader handles a server cap smaller than requested page size', async () => {
  const rows = Array.from({length: 1201}, (_, id) => ({id}));
  const client = { from: () => ({ select: () => ({ order: () => ({ range: async start => ({data: rows.slice(start,start+100),count: rows.length}) }) }) }) };
  assert.equal((await readAll(client,'attendance','id')).length,1201);
});
test('historical default period displays latest recorded month, not an empty current month', () => {
  const data={attendance:[{attendance_date:'2026-07-01'},{attendance_date:'2026-09-16'}]};
  assert.deepEqual(initialAnalysisPeriod(data,'2026-10-01'),{start:'2026-09-01',end:'2026-09-16'});
  assert.equal(attendanceCoverage(data).count,2);
});
test('lost response retries same request and blocks a different unconfirmed write', async () => {
  const bodies=[];
  const client={functions:{invoke:async (_,{body})=>{bodies.push(body);return bodies.length===1?{error:{message:'network'}}:{data:{result:{member_id:'test'}}};}}};
  const send=createCommandSender(client);
  await assert.rejects(()=>send('member.save',{name:'a'}),/could not be confirmed/);
  await assert.rejects(()=>send('member.save',{name:'b'}),/unconfirmed/);
  await send('member.save',{name:'a'});
  assert.equal(bodies[0].request_id,bodies[1].request_id);
});
test('command handler uses verified identity, never a body actor; denies unauthorized access', async () => {
  let args;
  const query={select(){return this;},eq(){return this;},is(){return this;},async maybeSingle(){return {data:{id:'staff'}};}};
  const handler=createCommandHandler({userClient:()=>({auth:{getUser:async()=>({data:{user:{id:'verified'}}})},from:()=>query}),adminClient:()=>({rpc:async (_,input)=>{args=input;return {data:{ok:true}};}})});
  const body={command:'member.save',request_id:crypto.randomUUID(),payload:{full_name:'test'},actor_auth_id:'forged'};
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)}))).status,401);
  assert.equal((await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify(body)}))).status,200);
  assert.equal(args.actor_auth_id,'verified');
});
