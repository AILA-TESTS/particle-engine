/** Grid configuration */
export interface GridConfig {
	rows: number;
	cols: number;
	spacing: number;
}

/** Properties that can be set on a particle */
export interface ParticleProps {
	color: string;
	opacity: number;
	size: number;
	layer: number;
	group: string;
	label: string;
}

/** Full particle data returned by queries */
export interface ParticleData {
	row: number;
	col: number;
	active: boolean;
	color: string;
	opacity: number;
	size: number;
	layer: number;
	group: string;
	label: string;
}

/** A connection between two particles */
export interface Connection {
	id: string;
	from: [number, number];
	to: [number, number];
	color: string;
	width: number;
	opacity: number;
	style: "solid" | "dashed" | "dotted";
	curve: number;
	directed: boolean;
	group: string;
	layer: number;
	label: string;
}

/** Options for getState() */
export interface GetStateOptions {
	region?: {
		rowStart: number;
		rowEnd: number;
		colStart: number;
		colEnd: number;
	};
	group?: string;
	includeInactive?: boolean;
}

/** Full state snapshot for undo/restore */
export interface StateSnapshot {
	particles: Map<string, ParticleData>;
	connections: Map<string, Connection>;
}

/** Space info (quick summary) */
export interface SpaceInfo {
	rows: number;
	cols: number;
	spacing: number;
	totalParticles: number;
	activeCount: number;
	connectionCount: number;
	groups: string[];
}

/** Default particle property values */
export const DEFAULT_PARTICLE_PROPS: ParticleProps = {
	color: "#FFFFFF",
	opacity: 1.0,
	size: 1.0,
	layer: 0,
	group: "",
	label: "",
};
