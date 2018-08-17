"use strict";

// MAYBE: Use a different data structure then an array for the propagation list
// TODO: Decide how views will be able to access data on linked models.

export function dedupeBaseClass(base) {
	if (base.propertyDefinitions !== undefined) {
		// The main BaseModel must already be in the prototype chain
		// MAYBE: This doesn't need to be a class decleration.  Something better?
		return class extends base {
			constructor(...parameters) {
				super(...parameters);
			}
		};
	} else {
		// The BaseModel isn't in the prototype chain yet
		return class extends base {
			constructor(...parameters) {
				super();

				// Holds the properties which still need to be updated
				this._propagationList = [];

				// Create instance data objects for all of our properties
				// MAYBE: Replace with module level symbols?
				this.instanceData = new Map();
				for (let layer of this.layers) {
					for (let prop of layer) {
						let localData = {
							userCount: 0,
							users: [],
							cachedValue: undefined
						};

						// MAYBE: Pull this up above, so it isn't run every single time.
						if (layer == this.layers[0]) {
							localData.cachedValue = prop.value instanceof Function ?
								prop.value() :
								prop.value;
						}
						this.instanceData.set(prop, localData);
					}
				}

				// Run any constructors defined for this model
				this._runConstructor(parameters);
			}
			static _setter(node) {
				return function (newValue) {
					if (!node.compare(node.cachedValue, newValue)) {
						node.cachedValue = newValue;
						this._addDependents(node);

						this._propagateUpdates()
					}
				}
			}
			_runConstructor(parameters) {
				constructorLoop:
				for (let constructor of this.constructorDefinitions) {
					// Check all the constructors
					if (constructor.length == parameters.length) {
						// See if the types of their parameters match the parameters we were passed.
						for (let i = 0; i < constructor.length; ++i) {
							// Was going to use instanceof here.  I can't remember why I switched to .constructor other than that I tried instanceof and it didn't work.
							if (!(parameters[i].constructor === constructor[i].type)) {
								continue constructorLoop;
							}
						}
						// About to set all the properties from this constructor
						this.fence();
						for (let i = 0; i < constructor.length; ++i) {
							let prop = constructor[i];
							// Run the setter for all of our parameters
							self[prop.name] = parameters[i];
						}
						// Finished.
						this.unfence();
						return;
					}
				}
				throw new Error(`Parameters didn't match any of the defined constructors`);
			}
			_revalidate(node) {
				// MAYBE: (though almost certainly) Extract the logic into higher order functions as an optimization
				// TODO: I don't like using ".call(this"  I either want revalidate to be a method on the base class or I want something else.
				// Figure out how to check if our cached value is different from the new value
				let instanceData = this.instanceData.get(node);

				let oldVal = node.cachedValue;
				// MAYBE: Offer a patch function?
				let newVal = node.value(...(node.dependencies.map(name => this[name])));

				// Has the property's value actually changed? 
				if (!node.compare(newVal, oldVal)) {
					// Update the cache 
					node.cachedValue = newVal;

					// Add our dependents 
					this._addDependents(node.dependents);
				}
			}
			// Insert a *sorted* dependents array into our propagation list
			_addDependents(node) {
				const propagation = this._propagationList;
				const nodeData = this.instanceData.get(node);

				let i = 0;
				function insert(item) {
					while (i < propagation.length) {
						if (propagation[i] === node) {
							continue dependency;
						}
						if (propagation[i].depth > node.depth) {
							--i;
							break;
						}
						++i;
					}
					if (i == propagation.length) {
						propagation.push(node);
					} else {
						propagation.splice(i, 0, node);
					}
				}
				// Add any dependent properties
				dependency:
				for (let dep of node.dependents) {
					// Make sure that the dependent has at least one user
					if (nodeData.userCount) {
						insert(dep);
					}
				}
				// Add any dependent users
				for (let user of nodeData.users) {
					insert(user);
				}
			}

			// Consume the propagation list while items are still being added to it.
			*_propagationIterator() {
				const propagation = this._propagationList;
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

				for (let obj of this._propagationIterator()) {
					if (obj.value) {
						// obj is a node
						this.revalidate(obj);
					} else {
						// obj is a user
						obj.func(...(obj.dependencies.map(name => this[name])));
					}
				}
			}
			fence() {
				++this.fenced;
			}
			unfence() {
				--this.fenced;

				// Propagate the updates since we fenced
				if (this.fenced == 0) {
					this._propagateUpdates();
				}
			}
			use(deps, func) {
				// TODO: reduce repetition
				let userDef = this.users.get(func)
				if (userDef !== undefined) {
					this.activate(func);
				} else {
					let userObj = {
						func: func,
						dependencies: deps,
						path: new Set()
					};

					this.users.set(func, userObj);

					// Multiple changes ahead = need to fence
					this.fence();

					// WorkingDeps should also probably be a Set, I just don't know how to iterate over a Set and add items to it.
					let workingDeps = deps.map(name => {
						if (name in this.nodes) {
							return this.nodes[name];
						} else {
							throw new Error(`Can't create a user that depends on a property that this model doesn't have.`);
						}
					});
					// MAYBE: We technically don't have to only increment the usercount once, the only thing we care about is that we can decrement it the same that we incremented it when we deactivate.
					const path = userObj.path;
					while (workingDeps.length != 0) {
						const node = workingDeps.pop();
						path.add(node);
						workingDeps = workingDeps.concat(node.dependencies);
					}

					// Actually increment increment the user count.
					this.activate(func);

					// Add this user into it's dependencies' user lists
					for (let name of deps) {
						this.instanceData.get(this.nodes[name]).users.push(userObj);
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

				this.fence();
				for (let property of userDef.path) {
					const instanceData = this.instanceData.get(property);
					let prev = proxy.userCount;

					// If this property didn't have a userCount before then it's user count should have been 0
					if (prev === undefined) {
						prev = 0;
					}
					// If the previous userCount is 0 then we need to revalidate the property because it likely hasn't been updated.
					if (prev === 0 && property.dependencies.length != 0) {
						property.revalidate.call(this);
					}

					instanceData.userCount = prev + 1;
				}
				this.unfence();

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

				userDef.path.forEach(prox => {
					let prev = prox.userCount;

					if (prev === undefined) {
						throw new InternalError("User Count Is Undefined");
					}
					if (prev == 0) {
						throw new InternalError("User Count Is Zero");
					}

					prox.userCount = prev - 1;
				});

				userDef.active = false;
			}
		};
	}
}