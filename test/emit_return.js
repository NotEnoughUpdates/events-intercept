const chai = require("chai"),
	assert = chai.assert.equal,
	eventsIntercept = require("../dist/events-intercept"),
	events = require("events");

describe("patched event emitters", () => {
	describe("with no intercepts", () => {
		it("returns true if an event had handlers", () => {
			const ee = new events.EventEmitter();
			eventsIntercept.patch(ee);

			ee.on("foo", () => {});

			assert(ee.emit("foo"), true, "emit('foo') is true");
		});

		it("returns false if an event had no handlers", () => {
			const ee = new events.EventEmitter();
			eventsIntercept.patch(ee);
			ee.on("foo", () => {});

			assert(ee.emit("bar"), false, "emit('bar') is false");
		});
	});

	describe("with the event intercepted", () => {
		it("returns true if an event had handlers", () => {
			const ee = new events.EventEmitter();
			eventsIntercept.patch(ee);

			let intercepted = false;
			let handled = false;

			ee.on("foo", () => {
				handled = true;
			});
			ee.intercept("foo", (next) => {
				intercepted = true;
				return next();
			});

			assert(ee.emit("foo"), true, "emit('foo') returns true");
			assert(intercepted, true, "interceptor was invoked");
			assert(handled, true, "handler was invoked");
		});

		it("returns false if an event had no handlers", () => {
			const ee = new events.EventEmitter();
			eventsIntercept.patch(ee);

			let intercepted = false;

			ee.intercept("bar", (next) => {
				intercepted = true;
				return next();
			});

			assert(ee.emit("bar"), false, "emit('bar') returns false");
			assert(intercepted, true, "interceptor was called");
		});
	});
});

describe("events-intercept event emitters", () => {
	it("returns true if an event had handlers", () => {
		const ee = new eventsIntercept.EventEmitter();
		ee.on("foo", () => {});

		assert(ee.emit("foo"), true, "emit('foo') is true");
	});

	it("returns false if an event had no handlers", () => {
		const ee = new eventsIntercept.EventEmitter();
		eventsIntercept.patch(ee);
		ee.on("foo", () => {});

		assert(ee.emit("bar"), false, "emit('bar') is false");
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

			assert(ee.emit("foo"), true, "emit('foo') returns true");
			assert(intercepted, true, "interceptor was invoked");
			assert(handled, true, "handler was invoked");
		});
	});
});
