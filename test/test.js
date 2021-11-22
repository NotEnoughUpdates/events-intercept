//@ts-check

const { patch } = require("../dist/events-intercept");
const events = require("events");

const emitter = patch(new events.EventEmitter());

emitter
	.on("aaaa", (arg) => console.log(arg))
	.intercept("aaaa", (arg, done) => done(null, "intercepted " + arg))
	.emit("aaaa", "myData");
