import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash } from './routing';

describe('Core Contracts routes',()=>{
  it('parses a direct contract detail URL',()=>{
    expect(parseRoute('#/contract?contract=room.living')).toEqual({view:'contract',contract:'room.living',field:undefined});
  });
  it('round-trips explorer, detail and trace history entries',()=>{
    const history=[
      routeHash({view:'contracts',contract:'room.living'}),
      routeHash({view:'contract',contract:'room.living'}),
      routeHash({view:'trace',contract:'room.living',field:'temperature'}),
    ];
    expect(history.map(value=>parseRoute(value))).toEqual([
      {view:'contracts',contract:'room.living',field:undefined},
      {view:'contract',contract:'room.living',field:undefined},
      {view:'trace',contract:'room.living',field:'temperature'},
    ]);
    expect(parseRoute(history[1])).toMatchObject({view:'contract',contract:'room.living'});
    expect(parseRoute(history[0])).toMatchObject({view:'contracts',contract:'room.living'});
  });
});
