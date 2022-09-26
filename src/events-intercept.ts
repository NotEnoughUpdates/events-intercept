import { EventEmitter } from "node:events";

/* HACK: methods are overloaded to remove the "symbol" type from the "eventName" 
parameter so that typescript doesn't complain when using a symbol to index an 
object. This doesn't affect the call signature of the method */

export class EventInterceptor extends EventEmitter {
	public static defaultMaxInterceptors = 10;

	private _maxInterceptors = EventInterceptor.defaultMaxInterceptors;
	private _interceptors: Record<string, Interceptors> = {};

	public constructor() {
		super();
		fixListeners(this);
	}

	public override emit(eventName: string | symbol, ...args: any[]): boolean;
	public override emit(eventName: string, ...args: any[]): boolean {
		let completed: number;

		const next = (err: Error | any, ...args1: any[]): boolean => {
			if (err) {
				this.emit("error", err);
				return false; // @tanzanite/events-intercept
			} else if (completed === interceptor.length) {
				return super.emit(eventName, ...args1);
			} else {
				completed += 1;
				return interceptor[completed - 1].call(this, ...args1, next);
			}
		};

		const interceptor = this._interceptors[eventName.toString()];

		if (!interceptor) {
			//Just pass through
			return super.emit(eventName, ...args);
		} else {
			completed = 0;
			return next.call(this, null, ...args);
		}
	}

	public override listeners(eventName: string | symbol): Function[] {
		const superListeners = super.listeners(eventName);
		const tempSuperListeners = superListeners.slice();
		if (eventName === "newListener" || eventName === "removeListener") {
			const fakeFunctionIndex = superListeners.indexOf(fakeFunction);
			if (fakeFunctionIndex !== -1) {
				tempSuperListeners.splice(fakeFunctionIndex, 1);
			}
			return tempSuperListeners;
		}
		return superListeners;
	}

	public intercept(eventName: string | symbol, interceptor: Interceptor): this;
	public intercept(eventName: string, interceptor: Interceptor): this {
		if (typeof interceptor !== "function") {
			throw new TypeError("interceptor must be a function");
		}

		this.emit("newInterceptor", eventName, interceptor);

		if (!this._interceptors[eventName]) {
			this._interceptors[eventName] = [interceptor];
		} else {
			this._interceptors[eventName].push(interceptor);
		}

		// Check for listener leak
		if (!this._interceptors[eventName].warned) {
			const m = this._maxInterceptors;

			if (m > 0 && this._interceptors[eventName].length > m) {
				this._interceptors[eventName].warned = true;
				process.emitWarning(
					`possible @tanzanite/events-intercept EventEmitter memory leak detected. ${this._interceptors[eventName].length} interceptors added. Use emitter.setMaxInterceptors(...) to increase limit.`
				);
			}
		}

		return this;
	}

	public interceptors(eventName: string | symbol): Interceptors;
	public interceptors(eventName: string): Interceptors {
		return !this._interceptors || !this._interceptors[eventName]
			? []
			: this._interceptors[eventName as string].slice();
	}

	public removeInterceptor(
		eventName: string | symbol,
		interceptor: Interceptor
	): this;
	public removeInterceptor(eventName: string, interceptor: Interceptor): this {
		if (typeof interceptor !== "function") {
			throw new TypeError("interceptor must be a function");
		}

		if (!this._interceptors || !this._interceptors[eventName]) return this;

		const list = this._interceptors[eventName];
		const length = list.length;
		let position = -1;

		for (let i = length - 1; i >= 0; i--) {
			if (list[i] === interceptor) {
				position = i;
				break;
			}
		}

		if (position < 0) return this;

		if (length === 1) {
			delete this._interceptors[eventName];
		} else {
			list.splice(position, 1);
		}

		this.emit("removeInterceptor", eventName, interceptor);

		return this;
	}

	public removeAllInterceptors(eventName?: string | symbol): this;
	public removeAllInterceptors(eventName?: string): this {
		if (
			!this._interceptors ||
			Object.getOwnPropertyNames(this._interceptors).length === 0
		) {
			return this;
		}

		if (eventName === undefined) {
			for (const key in this._interceptors) {
				if (
					this._interceptors.hasOwnProperty(key) &&
					key !== "removeInterceptor"
				) {
					this.removeAllInterceptors(key);
				}
			}
			this.removeAllInterceptors("removeInterceptor");
			this._interceptors = {};
		} else if (this._interceptors[eventName]) {
			const theseInterceptors = this._interceptors[eventName];
			const { length } = theseInterceptors;

			// LIFO order
			for (let i = length - 1; i >= 0; i--) {
				this.removeInterceptor(eventName, theseInterceptors[i]);
			}

			delete this._interceptors[eventName];
		}

		return this;
	}

	public setMaxInterceptors(n: number): this {
		if (typeof n !== "number" || n < 0 || isNaN(n)) {
			throw new TypeError("n must be a positive number");
		}
		this._maxInterceptors = n;
		return this;
	}
}

function fakeFunction() {}

function fixListeners(emitter: EventEmitter): void {
	emitter.on("newListener", fakeFunction);
	emitter.on("removeListener", fakeFunction);
}

export function monkeyPatch<E extends EventEmitter>(
	emitter: E
): E & PatchedElements {
	for (const prop of props) {
		Object.defineProperty(
			emitter,
			prop,
			Object.getOwnPropertyDescriptor(EventInterceptor.prototype, prop)!
		);
	}

	(emitter as any)._maxInterceptors ??= EventInterceptor.defaultMaxInterceptors;
	(emitter as any)._interceptors ??= {};

	fixListeners(emitter);
	return emitter as E & PatchedElements;
}

const props = [
	"emit",
	"listeners",
	"intercept",
	"interceptors",
	"removeInterceptor",
	"removeAllInterceptors",
	"setMaxInterceptors"
] as const;

export type PatchedElements = Pick<EventInterceptor, typeof props[number]>;

export type EventInterceptorResolvable =
	| (EventEmitter & PatchedElements)
	| EventInterceptor;

export interface Interceptors extends Array<Interceptor> {
	warned?: boolean;
}

export type Interceptor = (...args: any[]) => any;

// aliases
export { EventInterceptor as EventEmitter };
export { monkeyPatch as patch };
