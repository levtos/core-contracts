import type { AppView } from './store.svelte';

export interface AppRoute { view: AppView; contract?: string; field?: string; query?: Record<string, string> }
const ROUTES: AppView[]=['overview','contracts','contract','sources','devices','graph','problems','changes','settings','trace'];
/** Old hash names keep working after the rename to "Aktuelle Probleme". */
const ALIASES: Record<string, AppView> = { setup: 'problems' };
const RESERVED = new Set(['contract', 'field']);

export function parseRoute(hash:string,fallback:AppView='overview'):AppRoute {
  const [path,queryText]=hash.replace(/^#\/?/,'').split('?');
  const resolved = ALIASES[path] ?? path;
  const view=ROUTES.includes(resolved as AppView)?resolved as AppView:fallback;
  const query=new URLSearchParams(queryText??'');
  const rest: Record<string, string> = {};
  for (const [key, value] of query) if (!RESERVED.has(key) && value) rest[key] = value;
  return {view,contract:query.get('contract')??undefined,field:query.get('field')??undefined,...(Object.keys(rest).length?{query:rest}:{})};
}

export function routeHash(route:AppRoute):string {
  const query=new URLSearchParams();
  if(route.contract)query.set('contract',route.contract);
  if(route.field)query.set('field',route.field);
  for (const [key, value] of Object.entries(route.query ?? {})) if (value && !RESERVED.has(key)) query.set(key, value);
  return `#/${route.view}${query.size?`?${query}`:''}`;
}
