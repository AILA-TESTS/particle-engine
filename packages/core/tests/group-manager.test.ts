import { describe, it, expect } from 'vitest';
import { GroupManager } from '../src/group-manager.js';

describe('GroupManager', () => {
  it('returns 0 for empty string (ungrouped)', () => {
    const gm = new GroupManager();
    expect(gm.getOrCreateId('')).toBe(0);
    expect(gm.getName(0)).toBe('');
  });

  it('assigns sequential IDs to new groups', () => {
    const gm = new GroupManager();
    const id1 = gm.getOrCreateId('stars');
    const id2 = gm.getOrCreateId('planets');
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('returns existing ID for already-registered group', () => {
    const gm = new GroupManager();
    const id1 = gm.getOrCreateId('stars');
    const id2 = gm.getOrCreateId('stars');
    expect(id1).toBe(id2);
  });

  it('getName returns the correct name', () => {
    const gm = new GroupManager();
    gm.getOrCreateId('alpha');
    expect(gm.getName(1)).toBe('alpha');
    expect(gm.getName(999)).toBe(''); // unknown ID
  });

  it('getId returns the correct ID', () => {
    const gm = new GroupManager();
    gm.getOrCreateId('beta');
    expect(gm.getId('beta')).toBe(1);
    expect(gm.getId('nonexistent')).toBeUndefined();
  });

  it('getGroupNames returns all registered names except empty', () => {
    const gm = new GroupManager();
    gm.getOrCreateId('a');
    gm.getOrCreateId('b');
    gm.getOrCreateId('c');
    const names = gm.getGroupNames();
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names).toContain('c');
    expect(names).not.toContain('');
    expect(names.length).toBe(3);
  });

  it('has() checks existence', () => {
    const gm = new GroupManager();
    expect(gm.has('')).toBe(true);
    expect(gm.has('x')).toBe(false);
    gm.getOrCreateId('x');
    expect(gm.has('x')).toBe(true);
  });

  it('snapshot and restore work correctly', () => {
    const gm = new GroupManager();
    gm.getOrCreateId('alpha');
    gm.getOrCreateId('beta');
    const snap = gm.snapshot();

    // Mutate the original
    gm.getOrCreateId('gamma');
    expect(gm.has('gamma')).toBe(true);

    // Restore
    gm.restore(snap);
    expect(gm.has('gamma')).toBe(false);
    expect(gm.has('alpha')).toBe(true);
    expect(gm.has('beta')).toBe(true);
    expect(gm.getOrCreateId('alpha')).toBe(1);
  });
});
