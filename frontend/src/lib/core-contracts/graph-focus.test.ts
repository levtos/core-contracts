import { describe, expect, it } from 'vitest';
import { previewData } from './fixtures';
import { selectGraphNodes, type GraphMode } from './graph-focus';

describe('dependency graph focus',()=>{
  const graph=previewData().graph;
  it.each([
    ['current','contract:room.living'],
    ['all','contract:room.living'],
    ['impaired','contract:room.living'],
    ['upstream','fusion:fusion.living.temperature'],
    ['downstream','binding:binding.living.temperature'],
  ] as [GraphMode,string][])('supports %s mode from an explicit focus', (mode,focus)=>{
    const result=selectGraphNodes(graph,focus,mode);
    expect(result.bindings.size+result.fusions.size+result.contracts.size).toBeGreaterThan(0);
  });
  it('highlights only the active path while retaining alternatives in all mode',()=>{
    const current=selectGraphNodes(graph,'contract:room.living','current');
    const all=selectGraphNodes(graph,'contract:room.living','all');
    expect(current.bindings).toContain('binding.living.temperature');
    expect(current.currentBindings).toContain('binding.living.temperature');
    expect(current.bindings).not.toContain('binding.living.humidity');
    expect(all.bindings.size).toBeGreaterThanOrEqual(current.bindings.size);
  });
});
