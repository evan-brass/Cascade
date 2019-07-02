import { parameterList } from "./common.js";

const propagationSym = Symbol("Cascade: Property update propagation list");

// TODO: Need a way of declaring what properties you need on linked/collected models to reduce network requests.
// TODO: Need a way of declaring what constructors are available (ex. Rectangle(width, height), Circle(Radius),...)
// TODO: Parse dependencies directly from the functions.  (Using something like: (new String(func)).match(...))
// MAYBE: Asyncronous computed properties?  In a way, they already work, you just get a promise at the end rather than some asyncronous propagation.  Is that ok?

// Errors:
export class CascadeError extends Error {
	constructor(message) {
		super('Cascade - ' + message);
	}
}
export class InternalError extends CascadeError {
	constructor(message) {
		super(`Internal Error: ${message}. You're welcome to report this.`);
	}
}
export class InvalidDefinition extends CascadeError {
	constructor(message) {
		super(`Invalid Definition: ${message}.`);
	}
}
export class IncompatibleDefinition extends CascadeError {
	constructor(message) {
		super(`Incompatible Definition: ${message}.`);
	}
}
export class MalformedGraph extends CascadeError {
	constructor(problemDefinitionNames) {
		super(`Malformed Graph: Cascade attempted to create an empty layer of the dependency graph.  This usually indicates either a circular dependency or misspelled depency.  It would be located in one of these definitions: ${problemDefinitionNames.join(', ')}.`);
	}
}
export class UseError extends CascadeError {
	constructor(message) {
		super(`Use Error: ${message}.`);
	}
}

// Has some basic comparison functions which we can use to check if a property's value has changed.
function compareFunction(def) {
	if (def.compare) {
		return def.compare;
	} else if (def.type == Date) {
		return (A, B) => (A.getTime() == B.getTime());
	} else if (def.type == Array || def.type == HTMLCollection) {
		// Arrays are practically the same as collections.  They propagate a change when what's in them changes.
		return function (A, B) {
			if (A.length == B.length) {
				for (let i = 0; i < A.length; ++i) {
					if (A[i] != B[i]) {
						return false;
					}
				}
				return true;
			}
			return false;
		};
	} else {
		return (A, B) => A == B;
	}
	// MAYBE: Handle other datatypes
}

// Insert a *sorted* dependents array into our propagation 
function addDependents(dependents) {
	const propagation = this[propagationSym];
	let i = 0;

	dependency:
	for (let dep of dependents) {
		// Make sure that the dependent has at least one user
		if (dep.value === undefined /* User */ || this._userCount.get(dep)) {
			while (i < propagation.length) {
				if (propagation[i] === dep) {
					break dependency;
				}
				if (this.depths.get(propagation[i]) > this.depths.get(dep)) {
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
function* propagationIterator(propagation) {
	while (propagation.length != 0) {
		let toUpdate = propagation.shift();
		yield toUpdate;
	}
}

// Exhaust the propagation list
function propagateUpdates() {
	// If we're fenced then cancel propagating updates.
	if (this.fenced) {
		return;
	}
	const propagation = this[propagationSym];

	for (let prop of propagationIterator.call(this, propagation)) {
		if (prop.value) {
			// Computed Property:
			prop.revalidate.call(this);
		} else {
			// User:
			prop.func.call(undefined, prop.dependencies.map(name => this[name]));
		}
	}
}

// 
function revalidateFunc(def) {

	// Figure out how to check if our cached value is different from the new value
	let equals = compareFunction(def);
	
	function propagate(func) {
		return function (...pars) {
			func.call(this, ...pars);

			propagateUpdates.call(this);
		}
	}
	function checkCached(func) {
		return function (...pars) {
			let oldVal = this._cache.get(def);

			let newVal = func.call(this, ...pars);

			// Has the property's value actually changed?
			if (!equals(newVal, oldVal)) {
				// Update the cache
				this._cache.set(def, newVal);

				// Add our dependents
				addDependents.call(this, def.dependents);
			}
		}
	}

	// Determine what revalidation function to choose.
	if (def.dependencies.length != 0) {
		// Computed Property:
		if (def.patch !== undefined) {
			return checkCached(function () {
				let oldVal = this._cache.get(def);

				let inputs = def.dependencies.map(name => this[name]);
				if (oldVal === undefined) {
					// Cal func if we've never computed this property before.
					newVal = def.value.apply(this, inputs);
				} else {
					// Otherwise patch the previous value given the new information.
					// While func should be a pure function, patch is not necessarily.  For that reason we can store (locally in a closure of the patch function) the previous values that func/patch was given or do whatever we want.  Just be careful/considerate.
					// MAYBE: Would .call(this, oldval, ...inputs) be better than the concat?
					newVal = def.patch.apply(this, [oldVal].concat(inputs));
				}
				return newVal;
			});
		} else {
			return checkCached(function () {
				let inputs = def.dependencies.map(name => this[name]);
				return def.value.apply(this, inputs);
			});
		}
	} else {
		// Simple Property:
		return propagate(checkCached(newVal => newVal));
	}
}


export default function (newPropertyDefinitions, base = Object) {
	// Fundamental (depth 0) properties have their properties calculated at constructor call time.  That means that it's not a good spot for things that need DOM access.

	// TODO: Need to break this into multiple files/sections.  It's unwieldy.

	let propertyDefinitions;

	// Class that we will be extending
	class Model extends base {
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
		static get propertyDefinitions() {
			return propertyDefinitions;
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
	}

	function definitionDependencies(def) {
		// Handle errors
		if (def === undefined) {
			throw new InvalidDefinition('Property Definition missing');
		}
		if (def.type === undefined) {
			throw new InvalidDefinition('Currently, definitions must have a type specified, even on simple properties');
		}
		if (def.value === undefined && !(def.func instanceof Function)) {
			throw new InvalidDefinition('A default value or value computing function must be defined on the definition');
		}

		if (def.value instanceof Function) {
			// Computed property or computed default for a simple property
			def.dependencies = parameterList(def.value);
		} else {
			def.dependencies = [];
		}
	}

	// Include property definitions from the base class
	propertyDefinitions = Object.assign({}, base.propertyDefinitions);
	for (let name in newPropertyDefinitions) {
		const oldProp = propertyDefinitions[name];
		const prop = newPropertyDefinitions[name];

		// Set the name of the property.
		prop.name = name;

		// Make sure that the property definition that we're overriding has the same format (type and kind) as the new definition
		if (oldProp !== undefined && oldProp.type !== prop.type) {
			throw new IncompatibleDefinition(`The definition for ${name} doesn't match the definition on the base-model`);
		}

		// Add the definition's dependencies
		definitionDependencies(prop);

		// Make sure that all of the dependencies exist in the property definitions
		for (let dep of prop.dependencies) {
			if (propertyDefinitions[dep] === undefined && newPropertyDefinitions[dep] === undefined) {
				throw new InvalidDefinition(`There is no property definition for ${dep}. Check if it is mistyped`);
			}
		}


		// Copy our dependencies so that we can cross them off later
		prop.workDeps = Array.from(prop.dependencies);

		// Add the property to our property definitions
		propertyDefinitions[name] = prop;
	}

	// Construct the dependency graph
	let propWorkingSet = Object.keys(propertyDefinitions);

	// Define the layers:
	Model.prototype.layers = [];
	const layers = Model.prototype.layers;
	Model.prototype.depths = new Map();
	const depths = Model.prototype.depths;

	// Depth helps sort the updating of properties removing double updates
	let depth = 0;
	while (propWorkingSet.length > 0) {

		// Create a new layer
		const layer = new Set();
		layers[depth] = layer;

		// Find all the properties where its dependencies are already defined
		for (let i = 0; i < propWorkingSet.length;) {
			let name = propWorkingSet[i];
			// Shortcut directly to the property definition
			let def = propertyDefinitions[name];

			// Is this property one whos dependencies (if any) have already been added
			if (def.workDeps.length == 0) {

				// Add the definition to the layer
				layer.add(def);

				let setter;
				if (depth == 0) {
					setter = revalidateFunc(def);
				} else {
					// MAYBE: Allow setters for computed properties?
					def.revalidate = revalidateFunc(def);
				}

				// Actually define the property
				Object.defineProperty(Model.prototype, name, {
					get: function () {
						return this._cache.get(def);
					},
					set: setter
				});

				def.dependents = [];
				depths.set(def, depth);

				// Remove this property from our working set
				propWorkingSet.splice(i, 1);

				// Splicing will shift everything down (in index position) so we should continue with the same index
			} else {
				++i;
			}
		}

		// Remove the properties that we added in this pass from the dependencies of other properties and add those properties as dependents
		for (let key of propWorkingSet) {
			const prop = propertyDefinitions[key];
			if (prop.dependencies) {
				for (let old of layer) {
					// If the property had the added property as a dependency...
					let index = prop.workDeps.indexOf(old.name);
					if (index != -1) {
						// ...add the property as a dependent of the added property and...
						old.dependents.push(propertyDefinitions[key]);
						// ...remove the added property
						propertyDefinitions[key].workDeps.splice(index, 1);
					}
				}
			}
		}

		// Check for circular dependencies (if a full pass of the working prop list finds no properties that can be inserted into the graph then something is wrong).
		if (layer.size == 0) {
			throw new MalformedGraph(propWorkingSet);
		}

		++depth;
	}

	// Return the model we've constructed
	return Model;
}