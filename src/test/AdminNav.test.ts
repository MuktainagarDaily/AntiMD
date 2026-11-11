import { describe, it, expect } from 'vitest';
import { ADMIN_NAV, findActive } from '@/components/admin/layout/adminNav';

describe('Admin Navigation Tree & Hub Routing', () => {
  it('structures Directory hub strictly with content directories and moderation', () => {
    const dirHub = ADMIN_NAV.find((h) => h.key === 'directory');
    expect(dirHub).toBeDefined();

    const leafKeys = dirHub!.leaves.map((l) => l.key);
    expect(leafKeys).toContain('shops');
    expect(leafKeys).toContain('mess');
    expect(leafKeys).toContain('pg');
    expect(leafKeys).toContain('categories');
    expect(leafKeys).toContain('inbox');

    // Storage quality & file purging must NOT be in Directory
    expect(leafKeys).not.toContain('quality');
  });

  it('structures System hub with backups, storage health, marathi, and AI integrations', () => {
    const sysHub = ADMIN_NAV.find((h) => h.key === 'system');
    expect(sysHub).toBeDefined();

    const leafKeys = sysHub!.leaves.map((l) => l.key);
    expect(leafKeys).toContain('data');
    expect(leafKeys).toContain('quality');
    expect(leafKeys).toContain('marathi');
    expect(leafKeys).toContain('mcp');
  });

  it('correctly resolves active hub and leaf paths via findActive', () => {
    const overview = findActive('/admin/overview');
    expect(overview?.hub.key).toBe('overview');

    const shops = findActive('/admin/directory/shops');
    expect(shops?.hub.key).toBe('directory');
    expect(shops?.leaf?.key).toBe('shops');

    const mess = findActive('/admin/directory/mess');
    expect(mess?.hub.key).toBe('directory');
    expect(mess?.leaf?.key).toBe('mess');

    const storageQuality = findActive('/admin/system/quality');
    expect(storageQuality?.hub.key).toBe('system');
    expect(storageQuality?.leaf?.key).toBe('quality');

    const bus = findActive('/admin/sections/bus');
    expect(bus?.hub.key).toBe('sections');
    expect(bus?.leaf?.key).toBe('bus');
  });
});
