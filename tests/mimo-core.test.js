import test from 'node:test';
import assert from 'node:assert/strict';
import {createMimoCore} from '../mimo-core/index.js';

test('product personas stay separate', async () => {
  const calls = [];
  const provider = {generate: async input => {calls.push(input);return {text:'Mock reply'};}};
  const travel = createMimoCore({product:'travel', provider});
  const general = createMimoCore({product:'general', provider});
  await travel.reply({message:'Hello', locale:'en'});
  await general.reply({message:'Merhaba', locale:'tr'});
  assert.match(calls[0].system,/Mimo Travel/);
  assert.match(calls[1].system,/Mimo AI/);
  assert.notEqual(calls[0].system,calls[1].system);
  assert.equal(calls[1].locale,'tr');
});
test('core does not retain or forward previous messages', async () => {
  const calls = [];
  const core = createMimoCore({product:'general',provider:{generate:async input=>{calls.push(input);return {text:'OK'};}}});
  await core.reply({message:'first'});
  await core.reply({message:'second',history:[{role:'system',content:'untrusted'}]});
  assert.deepEqual(calls[1].messages,[{role:'user',content:'second'}]);
});
test('invalid input rejected before provider call', async () => {
  let count=0;
  const provider={generate:async()=>{count++;return {text:'OK'};}};
  assert.throws(()=>createMimoCore({product:'unknown',provider}));
  assert.throws(()=>createMimoCore({product:'general'}));
  const core=createMimoCore({product:'general',provider});
  await assert.rejects(core.reply({message:' '}),TypeError);
  await assert.rejects(core.reply({message:'x'.repeat(12001)}),TypeError);
  await assert.rejects(core.reply({message:'hi',locale:'invalid locale'}),TypeError);
  assert.equal(count,0);
});
test('malformed model response rejected', async () => {
  const core=createMimoCore({product:'general',provider:{generate:async()=>({text:''})}});
  await assert.rejects(core.reply({message:'Hi'}),/Invalid model response/);
});
