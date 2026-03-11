// ============================================================
// Elements — SVG element generation helpers
// ============================================================

import type { SerializedParticle, SerializedConnection } from '@particle-engine/core';

/**
 * Escape special XML characters in text content.
 */
export function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Render a particle as an SVG element (circle or square).
 */
export function renderParticle(
	particle: SerializedParticle,
	pixelX: number,
	pixelY: number,
	radius: number,
	shape: 'circle' | 'square',
): string {
	const effectiveRadius = radius * particle.size;
	const opacityAttr = particle.opacity < 1.0 ? ` opacity="${particle.opacity}"` : '';

	if (shape === 'square') {
		const side = effectiveRadius * 2;
		return `<rect x="${pixelX - effectiveRadius}" y="${pixelY - effectiveRadius}" ` +
			`width="${side}" height="${side}" fill="${particle.color}"${opacityAttr}/>`;
	}

	return `<circle cx="${pixelX}" cy="${pixelY}" r="${effectiveRadius}" ` +
		`fill="${particle.color}"${opacityAttr}/>`;
}

/**
 * Render a grid dot (for inactive particle positions).
 */
export function renderGridDot(
	pixelX: number,
	pixelY: number,
	radius: number,
	color: string,
): string {
	return `<circle cx="${pixelX}" cy="${pixelY}" r="${radius}" fill="${color}"/>`;
}

/**
 * Compute the control point for a quadratic bezier curve.
 * The curve value determines how far the control point is displaced
 * perpendicular to the line between the two endpoints.
 */
function computeControlPoint(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	curve: number,
): { cx: number; cy: number } {
	const midX = (x1 + x2) / 2;
	const midY = (y1 + y2) / 2;

	// Perpendicular direction
	const dx = x2 - x1;
	const dy = y2 - y1;

	// Perpendicular offset (rotated 90 degrees)
	const cx = midX - dy * curve;
	const cy = midY + dx * curve;

	return { cx, cy };
}

/**
 * Render a connection as an SVG line or path element.
 */
export function renderConnection(
	conn: SerializedConnection,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	hasArrowDefs: boolean,
): string {
	const strokeAttrs = buildStrokeAttributes(conn);
	const markerAttr = conn.directed ? ` marker-end="url(#arrowhead-${escapeXml(conn.id)})"` : '';

	let element: string;

	if (conn.curve !== 0) {
		// Quadratic bezier path
		const cp = computeControlPoint(fromX, fromY, toX, toY, conn.curve);
		element = `<path d="M ${fromX} ${fromY} Q ${cp.cx} ${cp.cy} ${toX} ${toY}" ` +
			`fill="none"${strokeAttrs}${markerAttr}/>`;
	} else {
		// Straight line
		element = `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}"` +
			`${strokeAttrs}${markerAttr}/>`;
	}

	// Add label if present
	if (conn.label) {
		const labelX = (fromX + toX) / 2;
		const labelY = (fromY + toY) / 2;

		if (conn.curve !== 0) {
			const cp = computeControlPoint(fromX, fromY, toX, toY, conn.curve);
			// For curved connections, place label at the midpoint of the curve
			// which is at t=0.5: B(0.5) = 0.25*P0 + 0.5*CP + 0.25*P1
			const curvedLabelX = 0.25 * fromX + 0.5 * cp.cx + 0.25 * toX;
			const curvedLabelY = 0.25 * fromY + 0.5 * cp.cy + 0.25 * toY;
			element += `\n<text x="${curvedLabelX}" y="${curvedLabelY}" ` +
				`text-anchor="middle" dominant-baseline="central" ` +
				`fill="${conn.color}" font-size="12">${escapeXml(conn.label)}</text>`;
		} else {
			element += `\n<text x="${labelX}" y="${labelY}" ` +
				`text-anchor="middle" dominant-baseline="central" ` +
				`fill="${conn.color}" font-size="12">${escapeXml(conn.label)}</text>`;
		}
	}

	return element;
}

/**
 * Build stroke-related SVG attributes for a connection.
 */
function buildStrokeAttributes(conn: SerializedConnection): string {
	let attrs = ` stroke="${conn.color}" stroke-width="${conn.width}"`;

	if (conn.opacity < 1.0) {
		attrs += ` stroke-opacity="${conn.opacity}"`;
	}

	if (conn.style === 'dashed') {
		attrs += ` stroke-dasharray="8,4"`;
	} else if (conn.style === 'dotted') {
		attrs += ` stroke-dasharray="2,4"`;
	}

	return attrs;
}

/**
 * Generate an SVG arrowhead marker definition for a directed connection.
 */
export function renderArrowMarker(conn: SerializedConnection): string {
	return `<marker id="arrowhead-${escapeXml(conn.id)}" markerWidth="10" markerHeight="7" ` +
		`refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">` +
		`<polygon points="0 0, 10 3.5, 0 7" fill="${conn.color}"/>` +
		`</marker>`;
}
