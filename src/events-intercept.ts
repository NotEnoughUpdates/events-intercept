import events from "events";

function intercept<C extends EventInterceptorResolvable>(
	this: C,
	type: string | number,
	interceptor: (...args: any[]) => any
): C {
	if (typeof interceptor !== "function") throw new TypeError("interceptor must be a function");

	this.emit("newInterceptor", type, interceptor);

	if (!this._interceptors![type]) this._interceptors![type] = [interceptor];
	else this._interceptors![type].push(interceptor);

	let m: number;

	// Check for listener leak
	if (!this._interceptors![type].warned) {
		m = typeof this._maxInterceptors !== "undefined" ? this._maxInterceptors : EventInterceptor.defaultMaxInterceptors;

		if (m > 0 && this._interceptors![type].length > m) {
			this._interceptors![type].warned = true;
			process.emitWarning(
				`possible events-intercept EventEmitter memory leak detected. ${
					this._interceptors![type].length
				} interceptors added. Use emitter.setMaxInterceptors(n) to increase limit.`
			);
		}
	}

	return this;
}

function emitFactory(superCall: typeof events.EventEmitter.prototype.emit) {
	return function (this: EventInterceptor, type: string | symbol, ...args: any[]) {
		let completed: number, interceptor: any[];

		const next = (err: Error | any, ...args1: any[]) => {
			if (err) {
				this.emit("error", err);
			} else if (completed === interceptor.length) {
				return superCall.call(this, type, ...args1);
			} else {
				completed += 1;
				return interceptor[completed - 1].call(this, ...args1, next);
			}
		};

		this._interceptors ??= {};

		interceptor = this._interceptors[type.toString()];

		if (!interceptor) {
			//Just pass through
			return superCall.call(this, type, ...args);
		} else {
			completed = 0;
			return next.call(this, null, ...args);
		}
	};
}

function interceptors(this: EventInterceptor, type: string) {
	return !this._interceptors || !this._interceptors[type] ? [] : this._interceptors[type].slice();
}

function removeInterceptor(this: EventInterceptor, type: string, interceptor: any) {
	if (typeof interceptor !== "function") {
		throw new TypeError("interceptor must be a function");
	}

	if (!this._interceptors || !this._interceptors[type]) return this;

	const list = this._interceptors[type];
	const length = list.length;
	let position = -1;

	for (let i = length - 1; i >= 0; i--) {
		if (list[i] === interceptor) {
			position = i;
			break;
		}
	}

	if (position < 0) return this;

	if (length === 1) delete this._interceptors[type];
	else list.splice(position, 1);

	this.emit("removeInterceptor", type, interceptor);

	return this;
}

function listenersFactory(superCall: typeof events.EventEmitter.prototype.listeners) {
	return function (this: EventInterceptor, type: string) {
		const superListeners = superCall.call(this, type);
		let fakeFunctionIndex;
		const tempSuperListeners = superListeners.slice();
		if (type === "newListener" || type === "removeListener") {
			fakeFunctionIndex = superListeners.indexOf(fakeFunction);
			if (fakeFunctionIndex !== -1) {
				tempSuperListeners.splice(fakeFunctionIndex, 1);
			}
			return tempSuperListeners;
		}
		return superListeners;
	};
}

function fakeFunction() {}

function fixListeners(emitter: EventInterceptorResolvable): void {
	emitter.on("newListener", fakeFunction);
	emitter.on("removeListener", fakeFunction);
}

function setMaxInterceptors(this: EventInterceptorResolvable, n: number) {
	if (typeof n !== "number" || n < 0 || isNaN(n)) {
		throw new TypeError("n must be a positive number");
	}
	this._maxInterceptors = n;
	return this;
}

function removeAllInterceptors(this: EventInterceptorResolvable, type: string) {
	let theseInterceptors, length;

	if (!this._interceptors || Object.getOwnPropertyNames(this._interceptors).length === 0) {
		return this;
	}

	if (arguments.length === 0) {
		for (const key in this._interceptors) {
			if (this._interceptors.hasOwnProperty(key) && key !== "removeInterceptor") {
				this.removeAllInterceptors(key);
			}
		}
		this.removeAllInterceptors("removeInterceptor");
		this._interceptors = {};
	} else if (this._interceptors[type.toString()]) {
		theseInterceptors = this._interceptors[type.toString()];
		length = theseInterceptors.length;

		// LIFO order
		for (let i = length - 1; i >= 0; i--) {
			this.removeInterceptor(type, theseInterceptors[i]);
		}

		delete this._interceptors[type.toString()];
	}

	return this;
}

export class EventInterceptor extends events.EventEmitter {
	public override emit = emitFactory(super.emit);
	public override listeners = listenersFactory(super.listeners);
	public intercept = intercept;
	public interceptors = interceptors;
	public removeInterceptor = removeInterceptor;
	public removeAllInterceptors = removeAllInterceptors;
	public setMaxInterceptors = setMaxInterceptors;
	declare _maxInterceptors: number | undefined;
	declare _interceptors: Record<string, any> | undefined;
	public static defaultMaxInterceptors = 10;

	public constructor() {
		super();
		fixListeners(this);
	}
}

export function monkeyPatch<C extends events.EventEmitter>(emitter: C): C & PatchedElements {
	const emitter_ = emitter as C & PatchedElements;
	const oldEmit = emitter_.emit;
	const oldListeners = emitter_.listeners;

	emitter_.emit = emitFactory(oldEmit);
	emitter_.intercept = intercept;
	emitter_.interceptors = interceptors;
	emitter_.removeInterceptor = removeInterceptor;
	emitter_.removeAllInterceptors = removeAllInterceptors;
	emitter_.setMaxInterceptors = setMaxInterceptors;
	emitter_.listeners = listenersFactory(oldListeners);
	fixListeners(emitter_);
	return emitter_;
}

export const patch = monkeyPatch;

export interface PatchedElements {
	intercept: typeof intercept;
	interceptors: typeof interceptors;
	removeInterceptor: typeof removeInterceptor;
	removeAllInterceptors: typeof removeAllInterceptors;
	setMaxInterceptors: typeof setMaxInterceptors;
	_maxInterceptors: number | undefined;
	_interceptors: Record<string, any> | undefined;
}

export type EventInterceptorResolvable = (events.EventEmitter & PatchedElements) | EventInterceptor;
