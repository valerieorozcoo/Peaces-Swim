import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('  var fulfilmentSaving=false');
const source=html.slice(begin,html.indexOf('  document.getElementById("checkoutBtn")',begin));
function fixture(api){
  const nodes=Object.fromEntries(['fulfilStatus','fulfilRetry','waitBlock'].map(id=>[id,{hidden:true,textContent:'',disabled:false,addEventListener(event,fn){this[event]=fn;}}]));
  const controls=[nodes.fulfilRetry,{disabled:false}];let shown=null;
  const document={getElementById:id=>nodes[id],querySelectorAll:()=>controls};
  const state={fulfil:'pickup',pickupAt:'3:15 PM'};
  const run=new Function('document','state','api','showWait',
    'var currentOrder={id:"draft",sig:"signed"};'+source+
    'return {send:sendFulfilment,saving:()=>fulfilmentSaving,replaceOrder(){currentOrder={id:"new",sig:"new"};}};')(
    document,state,api,(minutes,note)=>{shown={minutes,note};nodes.waitBlock.hidden=false;});
  return {run,state,nodes,controls,shown:()=>shown};
}
test('pickup shows a pending state and confirms only after a successful save',async()=>{
  let release,calls=0;
  const f=fixture(async()=>{calls++;return new Promise(resolve=>{release=resolve;});});
  const saving=f.run.send(30);
  assert.equal(f.run.saving(),true);assert.equal(f.shown(),null);assert.match(f.nodes.fulfilStatus.textContent,/Saving/);
  assert.ok(f.controls.every(b=>b.disabled));
  await f.run.send(30);assert.equal(calls,1);
  release({ok:true});await saving;
  assert.match(f.shown().note,/3:15 PM/);assert.equal(f.nodes.fulfilRetry.hidden,true);
  assert.match(f.nodes.fulfilStatus.textContent,/saved/);assert.ok(f.controls.every(b=>!b.disabled));
});
test('failed or malformed saves show an error and retry the same preference',async()=>{
  for(const failure of [new Error('Shop offline'),{}]){
    const bodies=[];let succeed=false;
    const f=fixture(async(path,body)=>{bodies.push({...body});if(succeed)return {ok:true};if(failure instanceof Error)throw failure;return failure;});
    await f.run.send(30);
    assert.equal(f.shown(),null);assert.equal(f.nodes.waitBlock.hidden,true);
    assert.match(f.nodes.fulfilStatus.textContent,/wasn't saved/);assert.equal(f.nodes.fulfilRetry.hidden,false);
    assert.equal(f.run.saving(),false);succeed=true;
    f.nodes.fulfilRetry.click();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(bodies[1],bodies[0]);assert.match(f.shown().note,/preference saved/);
  }
});
test('wait mode also requires a saved preference and stale responses cannot confirm a new order',async()=>{
  const f=fixture(async()=>({ok:true}));f.state.fulfil='wait';f.state.pickupAt=null;
  await f.run.send(12);assert.match(f.shown().note,/Stay close/);
  let release;const stale=fixture(()=>new Promise(resolve=>{release=resolve;}));
  const request=stale.run.send(30);stale.run.replaceOrder();release({ok:true});await request;
  assert.equal(stale.shown(),null);
});
