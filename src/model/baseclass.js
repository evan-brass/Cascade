"use strict";

export const propagationSym = Symbol("Cascade: Property update propagation list");

export function dedupeBaseClass(base) {
	if (base.propertyDefinitions !== undefined) {
		// The main BaseModel must already be in the prototype chain
		return class SubModel extends base {
			constructor() {
				super();
			}
		};
	} else {
		// The BaseModel isn't in the prototype chain yet
		return class BaseModel extends base {
			constructor() {
				super();

				// Allow extending a model into a new model.  Not sure if this is useful yet.
				if (!this[propagationSym]) {
					this[propagationSym] = [];
				}

				// MAYBE: Replace with module level symbols?
				this._cache = new Map();
				this._userCount = new Map();
				this.users = new Map();

				// Update the values for all of our fundamental properties
				for (let prop of this.layers[0]) {
					// Put our default value into the cache
					this._cache.set(prop, prop.value instanceof Function ?
						prop.value.call(this) :
						prop.value);
				}
			}
			fence() {
				this.fenced = true;
			}
			unfence() {
				this.fenced = false;

				// Propagate the updates since we fenced
				propagateUpdates.call(this)
			}
			use(deps, func) {
				// TODO: reduce repetition
				let userDef = this.users.get(func)
				if (userDef !== undefined) {
					userDef.path.forEach(def => {
						let prev = this._userCount.get(def);

						// If this property didn't have a userCount before then it's user count should have been 0
						if (prev === undefined) {
							prev = 0;
						}
						// If the previous userCount is 0 then we need to revalidate the property because it likely hasn't been updated.
						if (prev === 0 && def.dependencies != 0) {
							def.revalidate.call(this);
						}

						this._userCount.set(def, prev + 1);
					});
				} else {
					// TODO: Check if we've already been called with this func (If so, we just need to increment the userCounts
					let userObj = {
						func: func,
						dependencies: deps,
						path: new Set()
					};

					this.users.set(func, userObj);

					// Multiple changes ahead = need to fence
					this.fence();

					// WorkingDeps should also probably be a Set, I just don't know how to iterate over a Set and add items to it.
					let workingDeps = deps.map(name => propertyDefinitions[name]);
					const path = userObj.path;
					while (workingDeps.length != 0) {
						// MAYBE: Might not need to do a FIFO loop here which is probably slower.  I think a LIFO loop would be fine with push and pop.
						const workingDef = workingDeps.shift();
						path.add(workingDef);
						workingDeps.concat(workingDef.dependencies);
					}

					// Actually increment the _userCount
					this.activate(func);

					// All clear (Update everything we need before adding ourself, that way we're not updated as part of their propagations, only future ones.)
					this.unfence();

					// MAYBE: Also allow dots for computed properties?  Propabably not.  Computed properties should be computed exclusively from fundamental properties.
					// TODO: Allow for dependencies on linked objects using a kind of dot notation.  "link.property" or "link.link.property" etc.
					// Add this user as a dependent on all of its dependencies
					for (let name of deps) {
						const dependency = propertyDefinitions[name];
						let dotIndex = name.indexOf('.');
						// Add the userObject as a dependent on the dependency
						dependency.dependents.push(userObj);
					}

					// Actually call the function
					return func.apply(null, deps.map(name => this[name]));
				}
			}
			activate(func) {
				let userDef = this.users.get(func);

				if (userDef.active) {
					return;
				}

				if (userDef === undefined) {
					throw new UseError("Unable to activate a function which is not a user of this model");
				}

				userDef.path.forEach(def => {
					let prev = this._userCount.get(def);

					// If this property didn't have a userCount before then it's user count should have been 0
					if (prev === undefined) {
						prev = 0;
					}
					// If the previous userCount is 0 then we need to revalidate the property because it likely hasn't been updated.
					if (prev === 0 && def.dependencies.length != 0) {
						def.revalidate.call(this);
					}

					this._userCount.set(def, prev + 1);
				});

				userDef.active = true;
			}
			deactivate(func) {
				let userDef = this.users.get(func);

				if (!userDef.active) {
					return;
				}

				if (userDef === undefined) {
					throw new UseError("Unable to deactivate a function which is not a user of this model");
				}

				userDef.path.forEach(def => {
					let prev = this._userCount.get(def);

					if (prev === undefined) {
						throw new InternalError("User Count Is Undefined");
					}
					if (prev == 0) {
						throw new InternalError("User Count Is Zero");
					}

					this._userCount.set(def, prev - 1);
				});

				userDef.active = false;
			}
		};
	}
}