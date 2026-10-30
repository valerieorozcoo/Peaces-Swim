import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {priceDesign} from '../lib/catalog.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const block=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
// Include catalog and state declarations only, before the geometry table.
const catalog=html.slice(html.indexOf('  var STYLES={'),html.indexOf('\n  };',html.indexOf('  var state={'))+5);
const helpers=block('  function colorDef(id)','  function fabricHex');
const swatches=block('  function buildSwatches(part)','  var SAVE_KEY=');
const restore=block('  var SAVE_KEY=','  ["top","bottom"].forEach(function(part){ buildStyleGrid');
const valid={topStyle:'underwire',bottomStyle:'seamless',topColor:'teal',bottomColor:'coral',sizeTop:'M',sizeBottom:'L',addons:{bows:true,initials:true,beads:true},variant:{bows:'white',laceOver:'invalid'},initials:'mia',tote:true,headband:true};
function fixture(saved){
  const nodes={};
  const node=()=>({children:[],dataset:{},style:{},setAttribute(){},addEventListener(k,fn){this[k]=fn;},appendChild(n){this.children.push(n);},set innerHTML(v){this.children=[];}});
  const document={getElementById:id=>nodes[id]||(nodes[id]=node()),createElement:()=>node()};
  const state=new Function('document','localStorage',catalog+helpers+swatches+
    'function renderAll(){} function buildStyleGrid(){}\n'+restore+'buildSwatches("top");buildSwatches("bottom");return state;')(
    document,{getItem:()=>typeof saved==='string'?saved:JSON.stringify(saved)});
  return {state,nodes};
}
test('saved state is restored before style grids, initials drawers, and extras are built',()=>{
  assert.ok(html.indexOf('(function restoreDesign(){')<html.indexOf('["top","bottom"].forEach(function(part){ buildStyleGrid'));
  assert.ok(html.indexOf('(function restoreDesign(){')<html.indexOf('value="\'+state.initials'));
  const {state,nodes}=fixture(valid);
  assert.equal(state.initials,'MIA');assert.equal(state.tote,true);assert.equal(state.headband,true);
  assert.deepEqual(nodes.topSwatches.children.map(n=>n.dataset.color),['teal','coral']);
  assert.deepEqual(state.addons,{bows:true,initials:true});assert.deepEqual(state.variant,{bows:'white'});
  nodes.topSwatches.children[1].click();
  assert.doesNotThrow(()=>priceDesign({...state,addons:[]}));
});
test('invalid saved data leaves defaults intact and saved initials cannot inject markup',()=>{
  for(const data of ['{bad',[],{...valid,topStyle:'constructor'},{...valid,topColor:'green'},{...valid,sizeTop:'XXL'}]){
    const {state}=fixture(data);assert.equal(state.topStyle,'triangle');assert.equal(state.topColor,'green');
  }
  assert.equal(fixture({...valid,initials:'\"><img src=x onerror=alert(1)>'}).state.initials,'IMG');
});
