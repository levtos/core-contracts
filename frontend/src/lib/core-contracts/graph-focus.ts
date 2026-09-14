import type { GraphSnapshot } from './types';

export type GraphMode='current'|'all'|'impaired'|'upstream'|'downstream';
export interface GraphSelection {bindings:Set<string>;fusions:Set<string>;contracts:Set<string>;currentBindings:Set<string>;currentFusions:Set<string>}

const empty=():GraphSelection=>({bindings:new Set(),fusions:new Set(),contracts:new Set(),currentBindings:new Set(),currentFusions:new Set()});

export function selectGraphNodes(graph:GraphSnapshot,focus:string,mode:GraphMode):GraphSelection {
  const result=empty();
  const [kind,id]=focus.split(':',2);
  const fusionById=new Map(graph.fusions.map(item=>[item.fusion_id,item]));
  const contractById=new Map(graph.contracts.map(item=>[item.contract_id,item]));

  const addFusionUpstream=(fusionId:string)=>{
    if(result.fusions.has(fusionId))return;
    const fusion=fusionById.get(fusionId);if(!fusion)return;
    result.fusions.add(fusionId);
    fusion.input_binding_ids.forEach(bindingId=>result.bindings.add(bindingId));
    fusion.input_fusion_ids.forEach(addFusionUpstream);
  };
  const addContractUpstream=(contractId:string)=>{
    result.contracts.add(contractId);
    graph.fusions.filter(item=>item.contract_id===contractId).forEach(item=>addFusionUpstream(item.fusion_id));
  };
  const addFusionDownstream=(fusionId:string)=>{
    if(result.fusions.has(fusionId))return;
    const fusion=fusionById.get(fusionId);if(!fusion)return;
    result.fusions.add(fusionId);
    result.contracts.add(fusion.contract_id);
    graph.fusions.filter(item=>item.input_fusion_ids.includes(fusionId)).forEach(item=>addFusionDownstream(item.fusion_id));
  };
  const addBindingDownstream=(bindingId:string)=>{
    result.bindings.add(bindingId);
    graph.fusions.filter(item=>item.input_binding_ids.includes(bindingId)).forEach(item=>addFusionDownstream(item.fusion_id));
  };
  const markCurrent=()=>{
    for(const contractId of result.contracts){
      const contract=contractById.get(contractId);
      Object.values(contract?.field_evaluations??{}).flatMap(item=>item.active_binding_ids).forEach(bindingId=>result.currentBindings.add(bindingId));
    }
    let changed=true;
    while(changed){changed=false;for(const fusionId of result.fusions){const fusion=fusionById.get(fusionId);if(fusion&&!result.currentFusions.has(fusionId)&&(fusion.input_binding_ids.some(value=>result.currentBindings.has(value))||fusion.input_fusion_ids.some(value=>result.currentFusions.has(value)))){result.currentFusions.add(fusionId);changed=true;}}}
  };

  if(mode==='upstream'){
    if(kind==='contract')addContractUpstream(id);
    if(kind==='fusion')addFusionUpstream(id);
    if(kind==='binding')result.bindings.add(id);
  }else if(mode==='downstream'){
    if(kind==='contract')result.contracts.add(id);
    if(kind==='fusion')addFusionDownstream(id);
    if(kind==='binding')addBindingDownstream(id);
  }else{
    if(kind==='contract')addContractUpstream(id);
    if(kind==='fusion'){addFusionUpstream(id);const fusion=fusionById.get(id);if(fusion)result.contracts.add(fusion.contract_id);}
    if(kind==='binding')addBindingDownstream(id);
    if(mode==='impaired'){
      const impaired=new Set([...result.contracts].filter(contractId=>{const health=contractById.get(contractId)?.health;return health==='blocked'||health==='degraded';}));
      result.contracts=new Set(impaired);
      result.fusions=new Set([...result.fusions].filter(fusionId=>impaired.has(fusionById.get(fusionId)?.contract_id??'')));
      const inputs=new Set([...result.fusions].flatMap(fusionId=>fusionById.get(fusionId)?.input_binding_ids??[]));
      result.bindings=new Set([...result.bindings].filter(bindingId=>inputs.has(bindingId)));
    }
  }

  markCurrent();
  if(mode==='current'){
    result.bindings=new Set([...result.bindings].filter(bindingId=>result.currentBindings.has(bindingId)));
    result.fusions=new Set([...result.fusions].filter(fusionId=>result.currentFusions.has(fusionId)));
  }
  return result;
}
