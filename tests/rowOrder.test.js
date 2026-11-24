import { describe, it, expect } from 'vitest';
import { updateTenantRowOrder } from '../src/services/tenantDatabaseService';

function fakeClient({ rpcError = null, rowError = null } = {}) {
  const calls = { rpc: 0, updates: [] };
  return {
    calls,
    rpc: async (name, args) => { calls.rpc++; calls.rpcArgs = { name, args }; return { error: rpcError }; },
    from: () => ({
      update: (row) => ({
        eq: async (_col, id) => { calls.updates.push([id, row.row_order]); return { error: rowError }; },
      }),
    }),
  };
}

describe('updateTenantRowOrder', () => {
  it('saves the whole order in one call when the tenant has update 005', async () => {
    const c = fakeClient();
    await updateTenantRowOrder(c, ['C2', 'C1', 'C3']);
    expect(c.calls.rpc).toBe(1);
    expect(c.calls.rpcArgs).toEqual({ name: 'finroute_set_row_order', args: { p_ids: ['C2', 'C1', 'C3'] } });
    expect(c.calls.updates).toEqual([]);
  });

  it('falls back to one update per customer on older tenant databases', async () => {
    const c = fakeClient({ rpcError: { code: 'PGRST202', message: 'Could not find the function' } });
    await updateTenantRowOrder(c, ['C2', 'C1']);
    expect(c.calls.updates).toEqual([['C2', 1], ['C1', 2]]);
  });

  it('reports real errors (so the outbox retries or flags them)', async () => {
    await expect(updateTenantRowOrder(fakeClient({ rpcError: { code: '42501', message: 'permission denied' } }), ['C1']))
      .rejects.toMatchObject({ code: '42501' });
    await expect(updateTenantRowOrder(fakeClient({ rpcError: { code: 'PGRST202', message: 'x' }, rowError: { code: '23503', message: 'fk' } }), ['C1']))
      .rejects.toMatchObject({ code: '23503' });
  });

  it('does nothing for an empty list', async () => {
    const c = fakeClient();
    await updateTenantRowOrder(c, []);
    expect(c.calls.rpc).toBe(0);
  });
});
