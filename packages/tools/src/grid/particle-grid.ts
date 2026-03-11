import type {
	Connection,
	GetStateOptions,
	GridConfig,
	ParticleData,
	SpaceInfo,
	StateSnapshot,
} from "./types.js";
import { DEFAULT_PARTICLE_PROPS } from "./types.js";

/**
 * Minimal self-contained ParticleGrid implementation.
 * Will be replaced by @particle-engine/core when ready.
 */
export class ParticleGrid {
	private config: GridConfig;
	private particles: Map<string, ParticleData>;
	private connections: Map<string, Connection>;
	private nextConnectionId: number;

	constructor(config: GridConfig) {
		this.config = config;
		this.particles = new Map();
		this.connections = new Map();
		this.nextConnectionId = 1;
	}

	private key(row: number, col: number): string {
		return `${row},${col}`;
	}

	getConfig(): GridConfig {
		return { ...this.config };
	}

	isInBounds(row: number, col: number): boolean {
		return row >= 0 && row < this.config.rows && col >= 0 && col < this.config.cols;
	}

	getSpaceInfo(): SpaceInfo {
		const groups = new Set<string>();
		let activeCount = 0;
		for (const p of this.particles.values()) {
			if (p.active) {
				activeCount++;
				if (p.group) groups.add(p.group);
			}
		}
		return {
			rows: this.config.rows,
			cols: this.config.cols,
			spacing: this.config.spacing,
			totalParticles: this.config.rows * this.config.cols,
			activeCount,
			connectionCount: this.connections.size,
			groups: Array.from(groups),
		};
	}

	setParticle(
		row: number,
		col: number,
		props: Partial<{
			color: string;
			opacity: number;
			size: number;
			layer: number;
			group: string;
			label: string;
		}>,
	): void {
		const k = this.key(row, col);
		const existing = this.particles.get(k);
		if (existing) {
			this.particles.set(k, {
				...existing,
				...props,
				active: true,
			});
		} else {
			this.particles.set(k, {
				row,
				col,
				active: true,
				color: props.color ?? DEFAULT_PARTICLE_PROPS.color,
				opacity: props.opacity ?? DEFAULT_PARTICLE_PROPS.opacity,
				size: props.size ?? DEFAULT_PARTICLE_PROPS.size,
				layer: props.layer ?? DEFAULT_PARTICLE_PROPS.layer,
				group: props.group ?? DEFAULT_PARTICLE_PROPS.group,
				label: props.label ?? DEFAULT_PARTICLE_PROPS.label,
			});
		}
	}

	getParticle(row: number, col: number): ParticleData | undefined {
		return this.particles.get(this.key(row, col));
	}

	isActive(row: number, col: number): boolean {
		const p = this.particles.get(this.key(row, col));
		return p !== undefined && p.active;
	}

	clearParticle(row: number, col: number): void {
		const k = this.key(row, col);
		const p = this.particles.get(k);
		if (p) {
			// Remove connections involving this particle
			this.removeConnectionsForParticle(row, col);
			this.particles.delete(k);
		}
	}

	clearGroup(group: string): void {
		const toRemove: [number, number][] = [];
		for (const p of this.particles.values()) {
			if (p.group === group && p.active) {
				toRemove.push([p.row, p.col]);
			}
		}
		for (const [r, c] of toRemove) {
			this.clearParticle(r, c);
		}
		// Also remove connections in this group
		const connToRemove: string[] = [];
		for (const [id, conn] of this.connections) {
			if (conn.group === group) {
				connToRemove.push(id);
			}
		}
		for (const id of connToRemove) {
			this.connections.delete(id);
		}
	}

	clearAll(): void {
		this.particles.clear();
		this.connections.clear();
	}

	addConnection(
		from: [number, number],
		to: [number, number],
		props?: Partial<{
			color: string;
			width: number;
			opacity: number;
			style: "solid" | "dashed" | "dotted";
			curve: number;
			directed: boolean;
			group: string;
			label: string;
		}>,
	): Connection {
		const id = `conn_${this.nextConnectionId++}`;
		const conn: Connection = {
			id,
			from,
			to,
			color: props?.color ?? "#FFFFFF",
			width: props?.width ?? 1,
			opacity: props?.opacity ?? 1.0,
			style: props?.style ?? "solid",
			curve: props?.curve ?? 0,
			directed: props?.directed ?? false,
			group: props?.group ?? "",
			layer: 0,
			label: props?.label ?? "",
		};
		this.connections.set(id, conn);
		return conn;
	}

	getConnection(id: string): Connection | undefined {
		return this.connections.get(id);
	}

	removeConnection(id: string): boolean {
		return this.connections.delete(id);
	}

	removeConnectionsByEndpoints(from: [number, number], to: [number, number]): number {
		let count = 0;
		const toRemove: string[] = [];
		for (const [id, conn] of this.connections) {
			if (
				(conn.from[0] === from[0] &&
					conn.from[1] === from[1] &&
					conn.to[0] === to[0] &&
					conn.to[1] === to[1]) ||
				(conn.from[0] === to[0] &&
					conn.from[1] === to[1] &&
					conn.to[0] === from[0] &&
					conn.to[1] === from[1])
			) {
				toRemove.push(id);
			}
		}
		for (const id of toRemove) {
			this.connections.delete(id);
			count++;
		}
		return count;
	}

	removeConnectionsByGroup(group: string): number {
		let count = 0;
		const toRemove: string[] = [];
		for (const [id, conn] of this.connections) {
			if (conn.group === group) {
				toRemove.push(id);
			}
		}
		for (const id of toRemove) {
			this.connections.delete(id);
			count++;
		}
		return count;
	}

	private removeConnectionsForParticle(row: number, col: number): void {
		const toRemove: string[] = [];
		for (const [id, conn] of this.connections) {
			if (
				(conn.from[0] === row && conn.from[1] === col) ||
				(conn.to[0] === row && conn.to[1] === col)
			) {
				toRemove.push(id);
			}
		}
		for (const id of toRemove) {
			this.connections.delete(id);
		}
	}

	getState(options?: GetStateOptions): {
		particles: ParticleData[];
		connections: Connection[];
	} {
		const particles: ParticleData[] = [];
		const connections: Connection[] = [];

		for (const p of this.particles.values()) {
			if (!options?.includeInactive && !p.active) continue;
			if (options?.group && p.group !== options.group) continue;
			if (options?.region) {
				const { rowStart, rowEnd, colStart, colEnd } = options.region;
				if (p.row < rowStart || p.row > rowEnd || p.col < colStart || p.col > colEnd)
					continue;
			}
			particles.push({ ...p });
		}

		for (const conn of this.connections.values()) {
			if (options?.group && conn.group !== options.group) continue;
			if (options?.region) {
				const { rowStart, rowEnd, colStart, colEnd } = options.region;
				const fromInRegion =
					conn.from[0] >= rowStart &&
					conn.from[0] <= rowEnd &&
					conn.from[1] >= colStart &&
					conn.from[1] <= colEnd;
				const toInRegion =
					conn.to[0] >= rowStart &&
					conn.to[0] <= rowEnd &&
					conn.to[1] >= colStart &&
					conn.to[1] <= colEnd;
				if (!fromInRegion && !toInRegion) continue;
			}
			connections.push({ ...conn });
		}

		return { particles, connections };
	}

	getAllConnections(): Connection[] {
		return Array.from(this.connections.values()).map((c) => ({ ...c }));
	}

	snapshot(): StateSnapshot {
		const particles = new Map<string, ParticleData>();
		for (const [k, v] of this.particles) {
			particles.set(k, { ...v });
		}
		const connections = new Map<string, Connection>();
		for (const [k, v] of this.connections) {
			connections.set(k, { ...v, from: [...v.from], to: [...v.to] });
		}
		return { particles, connections };
	}

	restore(snap: StateSnapshot): void {
		this.particles = new Map<string, ParticleData>();
		for (const [k, v] of snap.particles) {
			this.particles.set(k, { ...v });
		}
		this.connections = new Map<string, Connection>();
		for (const [k, v] of snap.connections) {
			this.connections.set(k, { ...v, from: [...v.from], to: [...v.to] });
		}
		// Update nextConnectionId to avoid collisions
		let maxId = 0;
		for (const id of this.connections.keys()) {
			const m = id.match(/^conn_(\d+)$/);
			if (m) {
				const n = Number.parseInt(m[1], 10);
				if (n > maxId) maxId = n;
			}
		}
		this.nextConnectionId = maxId + 1;
	}
}
