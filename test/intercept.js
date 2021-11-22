"use strict";

const chai = require("chai"),
	expect = chai.expect,
	sinon = require("sinon"),
	eventsIntercept = require("../dist/events-intercept"),
	events = require("events");

chai.use(require("sinon-chai"));
chai.config.includeStack = true;

const emitterFactories = {
	"events-intercept EventEmitter": () => {
		return new eventsIntercept.EventEmitter();
	},
	"patched classic EventEmitter": () => {
		const classicEmitter = new events.EventEmitter();
		eventsIntercept.patch(classicEmitter);
		return classicEmitter;
	}
};

for (const description in emitterFactories) {
	const emitterFactory = emitterFactories[description];

	((emitterFactory) => {
		describe(description, () => {
			it("intercepts an event with a single interceptor", (done) => {
				const emitter = emitterFactory();
				let handler, interceptor;

				handler = (arg) => {
					expect(interceptor).to.have.been.called.once;
					expect(arg).to.equal("newValue");
					done();
				};

				interceptor = sinon.spy((arg, done) => {
					expect(arg).to.equal("value");
					done(null, "newValue");
				});

				emitter.intercept("test", interceptor).on("test", handler).emit("test", "value");
			});

			it("intercepts an event with a multiple interceptors", (done) => {
				const emitter = emitterFactory();

				const handler = (arg) => {
					expect(interceptor1).to.have.been.called.once;
					expect(interceptor2).to.have.been.called.once;
					expect(interceptor3).to.have.been.called.once;
					expect(arg).to.equal("finalValue");
					done();
				};

				const interceptor1 = sinon.spy((arg, done) => {
					expect(arg).to.equal("value");
					done(null, "secondValue", "anotherValue");
				});

				const interceptor2 = sinon.spy((arg, arg2, done) => {
					expect(arg).to.equal("secondValue");
					expect(arg2).to.equal("anotherValue");
					done(null, "thirdValue");
				});

				const interceptor3 = sinon.spy((arg, done) => {
					expect(arg).to.equal("thirdValue");
					done(null, "finalValue");
				});

				emitter
					.on("test", handler)
					.intercept("test", interceptor1)
					.intercept("test", interceptor2)
					.intercept("test", interceptor3)
					.emit("test", "value");
			});

			it("warns once for 11+ interceptors (by default)", (done) => {
				const emitter = emitterFactory();
				const interceptors = [];

				for (let i = 0; i < 12; i++) {
					interceptors[i] = sinon.spy((done) => {
						done();
					});
				}

				const handler = (arg) => {
					for (let i = 0; i < 12; i++) {
						expect(interceptors[i]).to.have.been.called.once;
					}
					expect(console.error).to.have.been.called.once;
					expect(console.trace).to.have.been.called.once;
					console.error.restore();
					console.trace.restore();
					done();
				};

				sinon.stub(console, "error");
				sinon.stub(console, "trace");

				emitter.on("test", handler);
				for (i = 0; i < 12; i++) {
					emitter.intercept("test", interceptors[i]);
				}
				emitter.emit("test");
			});

			it("allows for setting the maxInterceptors", (done) => {
				const emitter = emitterFactory();
				const interceptors = [];

				for (let i = 0; i < 6; i++) {
					interceptors[i] = sinon.spy((done) => {
						done();
					});
				}

				const handler = (arg) => {
					for (i = 0; i < 6; i++) {
						expect(interceptors[i]).to.have.been.called.once;
					}
					expect(console.error).to.have.been.called.once;
					expect(console.trace).to.have.been.called.once;
					console.error.restore();
					console.trace.restore();
					done();
				};

				sinon.stub(console, "error");
				sinon.stub(console, "trace");

				emitter.setMaxInterceptors(5).on("test", handler);
				for (i = 0; i < 6; i++) {
					emitter.intercept("test", interceptors[i]);
				}
				emitter.emit("test");
			});

			it("throws for invalid maxInterceptors", () => {
				const emitter = emitterFactory();

				expect(() => {
					emitter.setMaxInterceptors("not a number");
				}).to.throw(Error);
			});

			it("triggers an error when an interceptor passes one", (done) => {
				const emitter = emitterFactory(),
					handler = sinon.spy();

				const interceptor = sinon.spy((arg, done) => {
					expect(arg).to.equal("value");
					done(new Error("test error"));
				});

				const errorHandler = (err) => {
					expect(interceptor).to.have.been.called.once;
					expect(handler).to.not.have.been.called;
					expect(err.message).to.equal("test error");
					done();
				};

				emitter.on("test", handler).intercept("test", interceptor).on("error", errorHandler).emit("test", "value");
			});

			it("allows interceptors to trigger other events", (done) => {
				const emitter = emitterFactory(),
					handler = sinon.spy();

				const interceptor = sinon.spy((arg, done) => {
					expect(arg).to.equal("value");
					this.emit("newTest", "newValue");
				});

				const newHandler = (arg) => {
					expect(arg).to.equal("newValue");
					expect(interceptor).to.have.been.called.once;
					expect(handler).to.not.have.been.called;
					done();
				};

				emitter.on("test", handler).on("newTest", newHandler).intercept("test", interceptor).emit("test", "value");
			});

			// it("can monkey patch standard EventEmitters", (done) => {
			// 	const emitter = new events.EventEmitter();

			// 	const handler = (arg) => {
			// 		expect(interceptor).to.have.been.called.once;
			// 		expect(arg).to.equal("newValue");
			// 		done();
			// 	};

			// 	const interceptor = sinon.spy((arg, done) => {
			// 		expect(arg).to.equal("value");
			// 		done(null, "newValue");
			// 	});

			// 	eventsIntercept.patch(emitter);

			// 	emitter.on("test", handler).intercept("test", interceptor).emit("test", "value");
			// });

			it("behaves as before for events without interceptors", (done) => {
				const emitter = emitterFactory();

				const handler = (arg) => {
					expect(arg).to.equal("value");
					done();
				};

				emitter.on("test", handler).emit("test", "value");
			});

			it("throws for interceptors that are not functions", () => {
				const emitter = emitterFactory();

				const interceptCall = () => {
					emitter.intercept("test", "not a function");
				};

				expect(interceptCall).to.throw(Error);
			});

			it("emits newInterceptor for new interceptors", (done) => {
				const emitter = emitterFactory(),
					interceptor = () => {};

				const newInterceptorCall = (event, _interceptor) => {
					expect(event).to.equal("test");
					expect(_interceptor).to.equal(interceptor);
					done();
				};

				emitter.on("newInterceptor", newInterceptorCall).intercept("test", interceptor);
			});

			it("lists all interceptors", () => {
				const emitter = emitterFactory(),
					interceptor1 = () => {},
					interceptor2 = () => {};

				expect(emitter.interceptors("test"), "0").to.deep.equal([]);

				emitter.intercept("test", interceptor1);
				expect(emitter.interceptors("test"), "1").to.deep.equal([interceptor1]);

				emitter.intercept("test", interceptor2);
				expect(emitter.interceptors("test"), "2").to.deep.equal([interceptor1, interceptor2]);
			});

			it("removes an interceptor", () => {
				const emitter = emitterFactory(),
					interceptor1 = () => {},
					interceptor2 = () => {},
					notAnInterceptor = () => {};

				emitter.intercept("test", interceptor1).intercept("test", interceptor2);
				expect(emitter.interceptors("test"), "2").to.deep.equal([interceptor1, interceptor2]);

				emitter.removeInterceptor("test", interceptor1);
				expect(emitter.interceptors("test"), "1").to.deep.equal([interceptor2]);

				emitter.removeInterceptor("test", notAnInterceptor);
				expect(emitter.interceptors("test"), "0").to.deep.equal([interceptor2]);

				emitter.removeInterceptor("test", interceptor2);
				expect(emitter.interceptors("test"), "0").to.deep.equal([]);
			});

			it("removes all interceptors", () => {
				const emitter = emitterFactory(),
					interceptor1 = () => {},
					interceptor2 = () => {},
					removeHandler = sinon.spy(),
					removeInterceptor = sinon.spy();

				emitter
					.intercept("removeInterceptor", removeInterceptor)
					.on("removeInterceptor", removeHandler)
					.intercept("test", interceptor1)
					.intercept("test", interceptor2)
					.removeAllInterceptors()
					.removeAllInterceptors();

				expect(removeHandler).to.have.been.called.twice;
				expect(removeInterceptor).to.have.been.called.once;
				expect(emitter.interceptors("test")).to.deep.equal([]);
			});

			it("removes specific interceptors", () => {
				const emitter = emitterFactory(),
					interceptor1 = () => {},
					interceptor2 = () => {},
					removeHandler = sinon.spy();

				emitter
					.on("removeInterceptor", removeHandler)
					.intercept("test", interceptor1)
					.intercept("anotherTest", interceptor2)
					.removeAllInterceptors("test")
					.removeAllInterceptors("notAnEvent");

				expect(removeHandler).to.have.been.called.once;
				expect(emitter.interceptors("anotherTest")).to.deep.equal([interceptor2]);
			});

			it("throws for removing interceptors that are not functions", () => {
				const emitter = emitterFactory();

				const interceptCall = () => {
					emitter.removeInterceptor("test", "not a function");
				};

				expect(interceptCall).to.throw(Error);
			});

			it("emits removeInterceptor for removed interceptors", (done) => {
				const emitter = emitterFactory(),
					interceptor = () => {};

				const removeInterceptorCall = (event, _interceptor) => {
					expect(event).to.equal("test");
					expect(_interceptor).to.equal(interceptor);
					done();
				};

				emitter
					.on("removeInterceptor", removeInterceptorCall)
					.intercept("test", interceptor)
					.removeInterceptor("test", interceptor);
			});

			it("doesn't do anything for removeInterceptor with no interceptor", () => {
				const emitter = emitterFactory(),
					interceptor = () => {},
					removeInterceptorCall = sinon.spy();

				emitter.on("removeInterceptor", removeInterceptorCall).removeInterceptor("test", interceptor);

				expect(removeInterceptorCall).to.not.have.been.called;
			});

			it("calls an interceptor even if there is no handler", (done) => {
				const emitter = emitterFactory();

				const interceptor = (arg, interceptorDone) => {
					expect(arg).to.equal("value");
					interceptorDone();
					done();
				};

				emitter.intercept("test", interceptor).emit("test", "value");
			});

			it("emits newListener and removeListener even if there are no handlers", () => {
				const emitter = emitterFactory();
				const handler = sinon.spy();

				const newListenerInterceptor = sinon.spy((event, interceptor, done) => {
					expect(event).to.equal("test");
					expect(interceptor).to.equal(handler);
					done();
				});

				const removeListenerInterceptor = sinon.spy((event, interceptor, done) => {
					expect(event).to.equal("test");
					expect(interceptor).to.equal(handler);
					done();
				});

				emitter
					.intercept("newListener", newListenerInterceptor)
					.intercept("removeListener", removeListenerInterceptor)
					.on("test", handler)
					.removeListener("test", handler);

				expect(emitter.listeners("newListener")).to.be.empty;
				expect(emitter.listeners("removeListener")).to.be.empty;
				expect(handler).to.not.have.been.called;
				expect(newListenerInterceptor).to.have.been.called.once;
				expect(removeListenerInterceptor).to.have.been.called.once;
			});

			it("emits newListener and removeListener if there are handlers", (done) => {
				const emitter = emitterFactory();
				const newListenerHandler = sinon.spy(),
					removeListenerHandler = sinon.spy(),
					handler = sinon.spy();

				const newListenerInterceptor = (event, interceptor, done) => {
					expect(event).to.equal("test");
					expect(interceptor).to.equal(handler);
					done();
				};

				const removeListenerInterceptor = (event, interceptor, done) => {
					expect(event).to.equal("test");
					expect(interceptor).to.equal(handler);
					done();
				};

				emitter
					.on("removeListener", removeListenerHandler)
					.on("newListener", newListenerHandler)
					.intercept("newListener", newListenerInterceptor)
					.intercept("removeListener", removeListenerInterceptor)
					.on("test", handler)
					.removeListener("test", handler);

				expect(handler).to.not.have.been.called;
				expect(emitter.listeners("newListener")).to.deep.equal([newListenerHandler]);
				expect(emitter.listeners("removeListener")).to.deep.equal([removeListenerHandler]);
				expect(emitter.listeners("test")).to.deep.equal([]);
				expect(newListenerHandler).to.have.been.called.once;
				expect(removeListenerHandler).to.have.been.called.once;

				done();
			});
		});
	})(emitterFactory);
}
