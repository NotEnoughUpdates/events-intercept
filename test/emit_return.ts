import assert from "node:assert/strict";
import events from "node:events";
import { describe, it } from "node:test";
import * as eventsIntercept from "../src/events-intercept.js";

describe("patched event emitters", () => {
	describe("with no intercepts", () => {
		it("returns true if an event had handlers", () => {
			const ee = new events.EventEmitter();
			eventsIntercept.patch(ee);

			ee.on("foo", () => {});

			assert.equal(ee.emit("foo"), true, "emit('foo') isn't true");
		});

		it("returns false if an event had no handlers", () => {
			const ee = new events.EventEmitter();
			eventsIntercept.patch(ee);
			ee.on("foo", () => {});

			assert.equal(ee.emit("bar"), false, "emit('bar') isn't false");
		});
	});

	describe("with the event intercepted", () => {
		it("returns true if an event had handlers", () => {
			const ee = eventsIntercept.patch(new events.EventEmitter());

			let intercepted = false;
			let handled = false;

			ee.on("foo", () => {
				handled = true;
			});

			ee.intercept("foo", (next) => {
				intercepted = true;
				return next();
			});

			assert.equal(ee.emit("foo"), true, "emit('foo') doesn't return true");
			assert.equal(intercepted, true, "interceptor wasn't invoked");
			assert.equal(handled, true, "handler wasn't invoked");
		});

		it("returns false if an event had no handlers", () => {
			const ee = eventsIntercept.patch(new events.EventEmitter());

			let intercepted = false;

			ee.intercept("bar", (next) => {
				intercepted = true;
				return next();
			});

			assert.equal(ee.emit("bar"), false, "emit('bar') doesn't return false");
			assert.equal(intercepted, true, "interceptor wasn't called");
		});
	});
});

describe("events-intercept event emitters", () => {
	it("returns true if an event had handlers", () => {
		const ee = new eventsIntercept.EventEmitter();
		ee.on("foo", () => {});

		assert.equal(ee.emit("foo"), true, "emit('foo') isn't true");
	});

	it("returns false if an event had no handlers", () => {
		const ee = new eventsIntercept.EventEmitter();
		eventsIntercept.patch(ee);
		ee.on("foo", () => {});

		assert.equal(ee.emit("bar"), false, "emit('bar') isn't false");
	});

	describe("with the event intercepted", () => {
		it("returns true if an event had handlers", () => {
			const ee = new eventsIntercept.EventEmitter();

			let intercepted = false;
			let handled = false;

			ee.on("foo", () => {
				handled = true;
			});
			ee.intercept("foo", (next) => {
				intercepted = true;
				return next();
			});

			assert.equal(ee.emit("foo"), true, "emit('foo') doesn't return true");
			assert.equal(intercepted, true, "interceptor wasn't invoked");
			assert.equal(handled, true, "handler wasn't invoked");
		});
	});
});
