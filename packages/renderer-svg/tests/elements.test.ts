import { describe, it, expect } from 'vitest';
import {
	renderParticle,
	renderConnection,
	renderGridDot,
	renderArrowMarker,
	escapeXml,
} from '../src/elements.js';
import type { SerializedParticle, SerializedConnection } from '@particle-engine/core';

const makeParticle = (overrides: Partial<SerializedParticle> = {}): SerializedParticle => ({
	r: 0,
	c: 0,
	color: '#FFFFFF',
	opacity: 1.0,
	size: 1.0,
	layer: 0,
	group: '',
	...overrides,
});

const makeConnection = (overrides: Partial<SerializedConnection> = {}): SerializedConnection => ({
	id: 'conn-1',
	from: [0, 0],
	to: [1, 1],
	color: '#FFFFFF',
	width: 1,
	opacity: 1.0,
	style: 'solid',
	curve: 0,
	directed: false,
	group: '',
	layer: 0,
	label: '',
	...overrides,
});

describe('escapeXml', () => {
	it('escapes ampersand', () => {
		expect(escapeXml('a&b')).toBe('a&amp;b');
	});

	it('escapes less than', () => {
		expect(escapeXml('a<b')).toBe('a&lt;b');
	});

	it('escapes greater than', () => {
		expect(escapeXml('a>b')).toBe('a&gt;b');
	});

	it('escapes double quotes', () => {
		expect(escapeXml('a"b')).toBe('a&quot;b');
	});

	it('escapes single quotes', () => {
		expect(escapeXml("a'b")).toBe('a&apos;b');
	});

	it('escapes multiple special characters', () => {
		expect(escapeXml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
	});

	it('returns unchanged string without special chars', () => {
		expect(escapeXml('hello world')).toBe('hello world');
	});
});

describe('renderParticle', () => {
	it('renders a circle by default', () => {
		const p = makeParticle({ color: '#FF0000' });
		const svg = renderParticle(p, 100, 200, 5, 'circle');

		expect(svg).toContain('<circle');
		expect(svg).toContain('cx="100"');
		expect(svg).toContain('cy="200"');
		expect(svg).toContain('r="5"');
		expect(svg).toContain('fill="#FF0000"');
	});

	it('renders a square when shape is square', () => {
		const p = makeParticle({ color: '#00FF00' });
		const svg = renderParticle(p, 50, 50, 5, 'square');

		expect(svg).toContain('<rect');
		expect(svg).toContain('x="45"'); // 50-5
		expect(svg).toContain('y="45"');
		expect(svg).toContain('width="10"');
		expect(svg).toContain('height="10"');
		expect(svg).toContain('fill="#00FF00"');
	});

	it('applies size multiplier to radius', () => {
		const p = makeParticle({ size: 2.0 });
		const svg = renderParticle(p, 50, 50, 5, 'circle');

		expect(svg).toContain('r="10"'); // 5 * 2.0
	});

	it('includes opacity when less than 1.0', () => {
		const p = makeParticle({ opacity: 0.5 });
		const svg = renderParticle(p, 50, 50, 5, 'circle');

		expect(svg).toContain('opacity="0.5"');
	});

	it('omits opacity when 1.0', () => {
		const p = makeParticle({ opacity: 1.0 });
		const svg = renderParticle(p, 50, 50, 5, 'circle');

		expect(svg).not.toContain('opacity');
	});

	it('applies size multiplier to square', () => {
		const p = makeParticle({ size: 1.5 });
		const svg = renderParticle(p, 50, 50, 10, 'square');

		// effectiveRadius = 10 * 1.5 = 15
		expect(svg).toContain('x="35"'); // 50-15
		expect(svg).toContain('y="35"');
		expect(svg).toContain('width="30"'); // 15*2
		expect(svg).toContain('height="30"');
	});
});

describe('renderGridDot', () => {
	it('renders a small circle', () => {
		const svg = renderGridDot(100, 200, 1, '#333333');

		expect(svg).toContain('<circle');
		expect(svg).toContain('cx="100"');
		expect(svg).toContain('cy="200"');
		expect(svg).toContain('r="1"');
		expect(svg).toContain('fill="#333333"');
	});
});

describe('renderConnection', () => {
	it('renders a straight solid line', () => {
		const conn = makeConnection();
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('<line');
		expect(svg).toContain('x1="0"');
		expect(svg).toContain('y1="0"');
		expect(svg).toContain('x2="100"');
		expect(svg).toContain('y2="100"');
		expect(svg).toContain('stroke="#FFFFFF"');
		expect(svg).toContain('stroke-width="1"');
	});

	it('renders a dashed line', () => {
		const conn = makeConnection({ style: 'dashed' });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('stroke-dasharray="8,4"');
	});

	it('renders a dotted line', () => {
		const conn = makeConnection({ style: 'dotted' });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('stroke-dasharray="2,4"');
	});

	it('renders a curved connection as a path', () => {
		const conn = makeConnection({ curve: 0.5 });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('<path');
		expect(svg).toContain('d="M 0 0 Q');
		expect(svg).toContain('fill="none"');
	});

	it('includes stroke-opacity when less than 1.0', () => {
		const conn = makeConnection({ opacity: 0.7 });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('stroke-opacity="0.7"');
	});

	it('omits stroke-opacity when 1.0', () => {
		const conn = makeConnection({ opacity: 1.0 });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).not.toContain('stroke-opacity');
	});

	it('adds marker-end for directed connections', () => {
		const conn = makeConnection({ directed: true, id: 'c1' });
		const svg = renderConnection(conn, 0, 0, 100, 100, true);

		expect(svg).toContain('marker-end="url(#arrowhead-c1)"');
	});

	it('renders a label on a straight line', () => {
		const conn = makeConnection({ label: 'Hello' });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('<text');
		expect(svg).toContain('x="50"');
		expect(svg).toContain('y="50"');
		expect(svg).toContain('Hello');
	});

	it('escapes special characters in labels', () => {
		const conn = makeConnection({ label: 'a < b & c' });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('a &lt; b &amp; c');
	});

	it('renders a label on a curved connection', () => {
		const conn = makeConnection({ label: 'Curve', curve: 0.5 });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('<text');
		expect(svg).toContain('Curve');
	});

	it('renders straight line with no dasharray for solid style', () => {
		const conn = makeConnection({ style: 'solid' });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).not.toContain('stroke-dasharray');
	});

	it('uses custom width', () => {
		const conn = makeConnection({ width: 3 });
		const svg = renderConnection(conn, 0, 0, 100, 100, false);

		expect(svg).toContain('stroke-width="3"');
	});
});

describe('renderArrowMarker', () => {
	it('generates a marker definition', () => {
		const conn = makeConnection({ id: 'test-conn', color: '#FF0000' });
		const svg = renderArrowMarker(conn);

		expect(svg).toContain('<marker');
		expect(svg).toContain('id="arrowhead-test-conn"');
		expect(svg).toContain('orient="auto"');
		expect(svg).toContain('<polygon');
		expect(svg).toContain('fill="#FF0000"');
	});

	it('escapes special characters in connection id', () => {
		const conn = makeConnection({ id: 'a&b' });
		const svg = renderArrowMarker(conn);

		expect(svg).toContain('id="arrowhead-a&amp;b"');
	});
});
