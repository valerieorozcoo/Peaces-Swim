import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('  function enterDesign(){'),html.indexOf('  // The email box'));

test('prelaunch routes keep the waitlist visible for design links and hash changes',()=>{
  for(const hash of ['#design','','#waitlist']){
    const nodes={landing:{hidden:false},builder:{hidden:true},fulfil:{hidden:true}};
    const location={hash}; let prelaunch=true;
    const document={documentElement:{classList:{contains:()=>prelaunch}},getElementById:id=>nodes[id]||null};
    const route=new Function('document','location','window','showBuilder',
      'var landing=document.getElementById("landing");'+source+'return route;')(
      document,location,{addEventListener(){},scrollTo(){}},()=>{nodes.builder.hidden=false;});
    route(); assert.equal(nodes.landing.hidden,false); assert.equal(nodes.builder.hidden,true);
    location.hash='#design';route();assert.equal(nodes.landing.hidden,false);
    prelaunch=false;route();assert.equal(nodes.landing.hidden,true);assert.equal(nodes.builder.hidden,false);
    prelaunch=true;route();assert.equal(nodes.landing.hidden,false);assert.equal(nodes.builder.hidden,true);
  }
});
