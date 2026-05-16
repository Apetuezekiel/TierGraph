import { describe, expect, it } from 'vitest';
import { AccessDeniedError, InvalidOverrideError } from './errors.js';

describe('AccessDeniedError', () => {
	it('is instanceof AccessDeniedError', () => {
		const err = new AccessDeniedError('export', 'free', ['pro', 'enterprise']);
		expect(err).toBeInstanceOf(AccessDeniedError);
		expect(err).toBeInstanceOf(Error);
	});

	it('sets name, feature, plan, requiredPlans', () => {
		const err = new AccessDeniedError('export', 'free', ['pro', 'enterprise']);
		expect(err.name).toBe('AccessDeniedError');
		expect(err.feature).toBe('export');
		expect(err.plan).toBe('free');
		expect(err.requiredPlans).toEqual(['pro', 'enterprise']);
	});

	it('message references feature and plan', () => {
		const err = new AccessDeniedError('export', 'free', []);
		expect(err.message).toMatch(/export/);
		expect(err.message).toMatch(/free/);
	});

	it('toJSON returns JSON-serializable shape', () => {
		const err = new AccessDeniedError('export', 'free', ['pro']);
		const json = err.toJSON();
		expect(json.name).toBe('AccessDeniedError');
		expect(json.feature).toBe('export');
		expect(json.plan).toBe('free');
		expect(json.requiredPlans).toEqual(['pro']);
		expect(JSON.parse(JSON.stringify(json))).toEqual(json);
	});

	it('instanceof survives JSON round-trip of the object (not the error class)', () => {
		const err = new AccessDeniedError('export', 'free', ['pro']);
		const plain = err.toJSON();
		expect(plain.name).toBe('AccessDeniedError');
	});
});

describe('InvalidOverrideError', () => {
	it('is instanceof InvalidOverrideError', () => {
		const err = new InvalidOverrideError('unknown_feature', 'magic');
		expect(err).toBeInstanceOf(InvalidOverrideError);
		expect(err).toBeInstanceOf(Error);
	});

	it('sets name, reason, feature for unknown_feature', () => {
		const err = new InvalidOverrideError('unknown_feature', 'magic');
		expect(err.name).toBe('InvalidOverrideError');
		expect(err.reason).toBe('unknown_feature');
		expect(err.feature).toBe('magic');
	});

	it('sets name, reason, feature for grant_revoke_conflict', () => {
		const err = new InvalidOverrideError('grant_revoke_conflict', 'write');
		expect(err.reason).toBe('grant_revoke_conflict');
		expect(err.feature).toBe('write');
	});

	it('message varies by reason', () => {
		const unk = new InvalidOverrideError('unknown_feature', 'magic');
		const conflict = new InvalidOverrideError('grant_revoke_conflict', 'write');
		expect(unk.message).not.toBe(conflict.message);
		expect(unk.message).toMatch(/magic/);
		expect(conflict.message).toMatch(/write/);
	});

	it('toJSON returns JSON-serializable shape', () => {
		const err = new InvalidOverrideError('grant_revoke_conflict', 'write');
		const json = err.toJSON();
		expect(json.name).toBe('InvalidOverrideError');
		expect(json.reason).toBe('grant_revoke_conflict');
		expect(json.feature).toBe('write');
		expect(JSON.parse(JSON.stringify(json))).toEqual(json);
	});
});
