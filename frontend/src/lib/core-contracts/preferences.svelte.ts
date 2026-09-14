export type Density='comfortable'|'compact';
export type TimeDisplay='relative'|'exact'|'both';
export type TextSize='system'|'large'|'xlarge';
export type MotionPreference='system'|'reduce';
export type StartView='overview'|'contracts'|'last';
export type OpenBehavior='inspector'|'detail';
export interface PreferenceData {density:Density;technicalNames:boolean;timeDisplay:TimeDisplay;textSize:TextSize;motion:MotionPreference;startView:StartView;openBehavior:OpenBehavior;lastView:string}
export const DEFAULT_PREFERENCES:PreferenceData={density:'comfortable',technicalNames:false,timeDisplay:'both',textSize:'system',motion:'system',startView:'overview',openBehavior:'inspector',lastView:'overview'};
const KEY='benni-core-contracts:ux-v1';

export class UxPreferences {
  density=$state<Density>('comfortable'); technicalNames=$state(false); timeDisplay=$state<TimeDisplay>('both');
  textSize=$state<TextSize>('system'); motion=$state<MotionPreference>('system'); startView=$state<StartView>('overview');
  openBehavior=$state<OpenBehavior>('inspector'); lastView=$state('overview');
  constructor(private storage:Pick<Storage,'getItem'|'setItem'>|null=typeof localStorage==='undefined'?null:localStorage){this.load();}
  private load(){try{const saved=this.storage?.getItem(KEY);if(saved)Object.assign(this,{...DEFAULT_PREFERENCES,...JSON.parse(saved)});}catch{/* Invalid personal data falls back safely. */}}
  set<K extends keyof PreferenceData>(key:K,value:PreferenceData[K]){(this as unknown as PreferenceData)[key]=value;this.persist();}
  remember(view:string){if(view==='trace'||view==='contract')return;this.lastView=view;this.persist();}
  private persist(){try{this.storage?.setItem(KEY,JSON.stringify(this.snapshot));}catch{/* The UI remains usable when storage is unavailable. */}}
  get snapshot():PreferenceData{return {density:this.density,technicalNames:this.technicalNames,timeDisplay:this.timeDisplay,textSize:this.textSize,motion:this.motion,startView:this.startView,openBehavior:this.openBehavior,lastView:this.lastView};}
  get shellClass(){return `density-${this.density} text-${this.textSize} motion-${this.motion}`;}
  get initialView(){return this.startView==='last'?this.lastView:this.startView;}
}

export function formatRelativeDate(value:string|null|undefined,now=Date.now()):string {
  if(!value)return '—';const timestamp=new Date(value).getTime();if(Number.isNaN(timestamp))return value;
  const seconds=Math.round((timestamp-now)/1000);const abs=Math.abs(seconds);const unit=abs<60?'second':abs<3600?'minute':abs<86400?'hour':'day';
  const divisor=unit==='second'?1:unit==='minute'?60:unit==='hour'?3600:86400;
  return new Intl.RelativeTimeFormat('de-DE',{numeric:'auto'}).format(Math.round(seconds/divisor),unit);
}
