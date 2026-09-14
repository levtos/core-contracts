import type { AppView } from './store.svelte';

export interface AppRoute { view: AppView; contract?: string; field?: string }
const ROUTES: AppView[]=['overview','contracts','contract','sources','devices','graph','setup','changes','settings','trace'];

export function parseRoute(hash:string,fallback:AppView='overview'):AppRoute {
  const [path,queryText]=hash.replace(/^#\/?/,'').split('?');
  const view=ROUTES.includes(path as AppView)?path as AppView:fallback;
  const query=new URLSearchParams(queryText??'');
  return {view,contract:query.get('contract')??undefined,field:query.get('field')??undefined};
}

export function routeHash(route:AppRoute):string {
  const query=new URLSearchParams();
  if(route.contract)query.set('contract',route.contract);
  if(route.field)query.set('field',route.field);
  return `#/${route.view}${query.size?`?${query}`:''}`;
}
