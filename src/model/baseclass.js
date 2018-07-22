"use strict";

export const propagationSym = Symbol("Cascade: Property update propagation list");

function constructorFunc(self, parameters) {
	constructorLoop:
	for (let constructor of self.constructorDefinitions) {
		let found = true;
		if (constructor.length == parameters.length) {
			for (let i = 0; i < constructor.length; ++i) {
				if (!(parameters[i] instanceof constructor[i].type)) {
					found = false
					continue constructorLoop;
				}
			}
			for (let i = 0; i < constructor.length; ++i) {
				let prop = constructor[i];
				self[prop.name] = new (prop.type)(parameter[i]);
			}
			return;
		}
	}
}

export function dedupeBaseClass(base) {
	if (base.propertyDefinitions !== undefined) {
		// The main BaseModel must already be in the prototype chain
		return class SubModel extends base {
			constructor(...parameters) {
				super();

				this.fence();
				constructorFunc(this, parameters);
				this.unfence();
			}
		};
	} else {
		// The BaseModel isn't in the prototype chain yet
		return class BaseModel extends base {
			constructor(...parameters) {
				super();

				this.fence();

				// Allow extending a model into a new model.  Not sure if this is useful yet.
				if (!this[propagationSym]) {
					this[propagationSym] = [];
				}

				// MAYBE: Replace with module level symbols?
				this.users = new Map();

				// Update the values for all of our fundamental properties
				for (let prop of this.layers[0]) {
					// Put our default value into the cache
					prop.cachedValue = prop.value instanceof Function ?
						prop.value.call(this) :
						prop.value;
				}

				constructorFunc(this, parameters);
				this.unfence();
			}
			// Insert a *sorted* dependents array into our propagation 
			_addDependents(dependents) {
				const propagation = this[propagationSym];
				let i = 0;

				dependency:
				for (let dep of dependents) {
					// Make sure that the dependent has at least one user
					if (dep.value === undefined /* User */ || dep.userCount) {
						while (i < propagation.length) {
							if (propagation[i] === dep) {
								break dependency;
							}
							if (propagation[i].depth > dep.depth) {
								--i;
								break;
							}
							++i;
						}
						if (i == propagation.length) {
							propagation.push(dep);
						} else {
							propagation.splice(i, 0, dep);
						}
					}
				}
			}

			// Consume the propagation list while items are still being added to it.
			*_propagationIterator(propagation) {
				while (propagation.length != 0) {
					let toUpdate = propagation.shift();
					yield toUpdate;
				}
			}

			// Exhaust the propagation list
			_propagateUpdates() {
				// If we're fenced then cancel propagating updates.
				if (this.fenced) {
					return;
				}
				const propagation = this[propagationSym];

				for (let prop of this._propagationIterator(propagation)) {
					if (prop.value) {
						// Computed Property:
						prop.revalidate.call(this);
					} else {
						// User:
						prop.func.call(undefined, prop.dependencies.map(name => this[name]));
					}
				}
			}
			fence() {
				this.fenced = true;
			}
			unfence() {
				this.fenced = false;

				// Propagate the updates since we fenced
				this._propagateUpdates();
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
					let workingDeps = deps.map(name => this.proxies[name]);
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
						const dependency = this.proxies[name];
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

				userDef.path.forEach(proxy => {
					let prev = proxy.userCount;

					// If this property didn't have a userCount before then it's user count should have been 0
					if (prev === undefined) {
						prev = 0;
					}
					// If the previous userCount is 0 then we need to revalidate the property because it likely hasn't been updated.
					if (prev === 0 && proxy.dependencies.length != 0) {
						proxy.revalidate.call(this);
					}

					proxy.userCount = prev + 1;
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