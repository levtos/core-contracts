import { describe, expect, it } from 'vitest';
import { UxPreferences } from './preferences.svelte';

class MemoryStorage {
  value:string|null=null;
  getItem(){return this.value;}
  setItem(_key:string,value:string){this.value=value;}
}

describe('UX preferences',()=>{
  it('persist and affect the complete shell and navigation behavior',()=>{
    const storage=new MemoryStorage();
    const first=new UxPreferences(storage);
    first.set('density','compact');first.set('technicalNames',true);first.set('timeDisplay','exact');
    first.set('textSize','xlarge');first.set('motion','reduce');first.set('startView','last');
    first.set('openBehavior','detail');first.remember('graph');
    const restored=new UxPreferences(storage);
    expect(restored.snapshot).toMatchObject({density:'compact',technicalNames:true,timeDisplay:'exact',textSize:'xlarge',motion:'reduce',startView:'last',openBehavior:'detail',lastView:'graph'});
    expect(restored.shellClass).toBe('density-compact text-xlarge motion-reduce');
    expect(restored.initialView).toBe('graph');
  });
});
