export type DraftKind='binding'|'fusion'|'contract'|'device'|'metadata';
export interface DraftChange {kind:DraftKind;objectId:string;field:string;before:unknown;after:unknown;action:'added'|'changed'|'removed'}
type Item=Record<string,unknown>;
interface Payload {bindings?:Item[];fusions?:Item[];contract_instances?:Item[];devices?:Item[];registry_metadata?:Record<string,unknown>}
const collections:[keyof Payload,DraftKind,string][]=[['bindings','binding','binding_id'],['fusions','fusion','fusion_id'],['contract_instances','contract','contract_id'],['devices','device','device_id']];
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

export function buildDraftDiff(base:Payload,current:Payload):DraftChange[]{
  const changes:DraftChange[]=[];
  for(const [collection,kind,idKey] of collections){
    const before=new Map(((base[collection] as Item[]|undefined)??[]).map(item=>[String(item[idKey]),item]));
    const after=new Map(((current[collection] as Item[]|undefined)??[]).map(item=>[String(item[idKey]),item]));
    for(const [id,item] of after){const previous=before.get(id);if(!previous){changes.push({kind,objectId:id,field:'Objekt',before:undefined,after:item,action:'added'});continue;}for(const key of new Set([...Object.keys(previous),...Object.keys(item)])){if(key===idKey)continue;if(!equal(previous[key],item[key]))changes.push({kind,objectId:id,field:key,before:previous[key],after:item[key],action:'changed'});}}
    for(const [id,item] of before)if(!after.has(id))changes.push({kind,objectId:id,field:'Objekt',before:item,after:undefined,action:'removed'});
  }
  const beforeMeta=base.registry_metadata??{},afterMeta=current.registry_metadata??{};
  for(const key of new Set([...Object.keys(beforeMeta),...Object.keys(afterMeta)]))if(!equal(beforeMeta[key],afterMeta[key]))changes.push({kind:'metadata',objectId:'registry',field:key,before:beforeMeta[key],after:afterMeta[key],action:'changed'});
  return changes;
}
