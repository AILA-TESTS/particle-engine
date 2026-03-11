// ============================================================
// GroupManager — Bidirectional mapping between group names and uint16 IDs
// ============================================================

/**
 * Manages the mapping between human-readable group names (strings)
 * and compact uint16 IDs stored in the particle typed arrays.
 *
 * Group ID 0 is reserved for "ungrouped" (empty string name).
 */
export class GroupManager {
  private nameToId: Map<string, number> = new Map();
  private idToName: Map<number, string> = new Map();
  private nextId: number = 1; // 0 is reserved for ungrouped

  constructor() {
    // ID 0 = ungrouped (empty string)
    this.nameToId.set('', 0);
    this.idToName.set(0, '');
  }

  /**
   * Get (or create) the uint16 ID for a group name.
   * Returns 0 for empty string.
   */
  getOrCreateId(name: string): number {
    if (name === '') return 0;

    const existing = this.nameToId.get(name);
    if (existing !== undefined) return existing;

    const id = this.nextId++;
    if (id > 65535) {
      throw new Error('Group ID overflow: cannot have more than 65535 groups');
    }
    this.nameToId.set(name, id);
    this.idToName.set(id, name);
    return id;
  }

  /**
   * Get the name for a group ID. Returns '' for ID 0.
   */
  getName(id: number): string {
    return this.idToName.get(id) ?? '';
  }

  /**
   * Get the ID for a group name. Returns undefined if not registered.
   */
  getId(name: string): number | undefined {
    return this.nameToId.get(name);
  }

  /**
   * Get all registered group names (excluding the empty/ungrouped name).
   */
  getGroupNames(): string[] {
    const names: string[] = [];
    for (const [name] of this.nameToId) {
      if (name !== '') names.push(name);
    }
    return names;
  }

  /**
   * Check if a group name is registered.
   */
  has(name: string): boolean {
    return this.nameToId.has(name);
  }

  /**
   * Create a snapshot of the current state for undo/restore.
   */
  snapshot(): { nameToId: Map<string, number>; idToName: Map<number, string>; nextId: number } {
    return {
      nameToId: new Map(this.nameToId),
      idToName: new Map(this.idToName),
      nextId: this.nextId,
    };
  }

  /**
   * Restore state from a snapshot.
   */
  restore(snap: { nameToId: Map<string, number>; idToName: Map<number, string>; nextId: number }): void {
    this.nameToId = new Map(snap.nameToId);
    this.idToName = new Map(snap.idToName);
    this.nextId = snap.nextId;
  }
}
