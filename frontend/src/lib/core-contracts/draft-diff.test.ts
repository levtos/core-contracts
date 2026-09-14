import { describe, expect, it } from 'vitest';
import { buildDraftDiff } from './draft-diff';

const base={bindings:[{binding_id:'b1',entity_id:'sensor.one',field:'value'}],fusions:[],contract_instances:[],devices:[],registry_metadata:{}};

describe('draft diff counting',()=>{
  it('counts zero, one and multiple visible changes from the same diff entries',()=>{
    expect(buildDraftDiff(base,structuredClone(base))).toHaveLength(0);
    const one=structuredClone(base);one.bindings[0].entity_id='sensor.two';
    expect(buildDraftDiff(base,one)).toHaveLength(1);
    const many=structuredClone(one);many.bindings[0].field='state';many.registry_metadata={owner:'Benni'} as Record<string,unknown>;
    expect(buildDraftDiff(base,many)).toHaveLength(3);
  });
  it('counts additions and removals as real draft changes',()=>{
    const current=structuredClone(base);current.bindings.push({binding_id:'b2',entity_id:'sensor.two',field:'value'});
    expect(buildDraftDiff(base,current)).toMatchObject([{kind:'binding',objectId:'b2',action:'added'}]);
    expect(buildDraftDiff(base,{...base,bindings:[]})).toMatchObject([{kind:'binding',objectId:'b1',action:'removed'}]);
  });
});
