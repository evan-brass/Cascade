"use strict";

import parameterList from "../common/parameterList.js";
import { dedupeBaseClass, propagationSym } from "./baseclass.js";
import { InternalError, InvalidDefinition, IncompatibleDefinition, MalformedGraph, UseError } from "./errors.js";
import defaultCompare from "./defaultCompare.js";

// TODO: Need a way of declaring what properties you need on linked/collected models to reduce network requests.
// Figure out how to handle linked models
// TODO: Need a way of declaring what constructors are available (ex. Rectangle(width, height), Circle(Radius),...)
// TODO: Parse dependencies directly from the functions.  (Using something like: (new String(func)).match(...))
// MAYBE: Asyncronous computed properties?  In a way, they already work, you just get a promise at the end rather than some asyncronous propagation.  Is that ok?

function revalidateFunc(proxy) {
	// Figure out how to check if our cached value is different from the new value
	let equals = proxy.compare || defaultCompare(proxy.type);
	
	function propagate(func) {
		return function (...pars) {
			func.call(this, ...pars);

			this._propagateUpdates();
		}
	}
	function checkCached(func) {
		return function (...pars) {
			let oldVal = proxy.cachedValue;

			let newVal = func.call(this, ...pars);

			// Has the property's value actually changed?
			if (!equals(newVal, oldVal)) {
				// Update the cache
				proxy.cachedValue = newVal;

				// Add our dependents
				this._addDependents(proxy.dependents);
			}
		}
	}

	// Determine what revalidation function to choose.
	if (proxy.dependencies.length != 0) {
		// Computed Property:
		if (proxy.patch !== undefined) {
			// If a definition has a patch then it should be called everytime except the first.
			return checkCached(function () {
				let oldVal = proxy.cachedValue;

				let inputs = proxy.dependencies.map(name => this[name]);
				if (oldVal === undefined) {
					// Cal func if we've never computed this property before.
					newVal = proxy.value.apply(this, inputs);
				} else {
					// Otherwise patch the previous value given the new information.
					// While func should be a pure function, patch is not necessarily.  For that reason we can store (locally in a closure of the patch function) the previous values that func/patch was given or do whatever we want.  Just be careful/considerate.
					// MAYBE: Would .call(this, oldval, ...inputs) be better than the concat?
					newVal = proxy.patch.apply(this, [oldVal].concat(inputs));
				}
				return newVal;
			});
		} else {
			return checkCached(function () {
				let inputs = proxy.dependencies.map(name => this[name]);
				return proxy.value.apply(this, inputs);
			});
		}
	} else {
		// Simple Property:
		return propagate(checkCached((newVal) => newVal));
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
	if (def.value === undefined) {
		throw new InvalidDefinition('A default value or value computing function must be defined on the definition');
	}

	if (def.dependencies === undefined) {
		if (def.value instanceof Function) {
			// Computed property or computed default for a simple property
			def.dependencies = parameterList(def.value);
		} else {
			def.dependencies = [];
		}
	}
}

function proxyFromDef(def) {
	let localData = {
		_def: def,
		userCount: 0,
		depth: -1,
		dependents: []
	};
	return new Proxy(def, {
		get: function (target, prop) {
			if (localData[prop] !== undefined) {
				return localData[prop];
			} else {
				return target[prop];
			}
		},
		set: function (target, prop, value) {
			localData[prop] = value;
			return true;
		}
	});
}

export default function (newPropertyDefinitions, base = Object) {
	// Fundamental (depth 0) properties have their properties calculated at constructor call time.  That means that it's not a good spot for things that need DOM access.

	// TODO: Need to break this into multiple files/sections.  It's unwieldy.

	let propertyDefinitions = Object.assign({}, base.propertyDefinitions);

	// This is the class of the model we're creating.
	const Model = dedupeBaseClass(base);
	Object.defineProperty(Model, 'propertyDefinitions', {
		get: () => propertyDefinitions
	});

	// Save the constructors property for later
	const constructors = newPropertyDefinitions.constructors || [];
	delete newPropertyDefinitions.constructors;

	// Include property definitions from the base class
	let workDeps = new Map();
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
		workDeps.set(prop, Array.from(prop.dependencies));

		// Add the property to our property definitions
		propertyDefinitions[name] = prop;
	}

	// Create the proxies
	const proxies = {};
	Model.prototype.proxies = proxies;
	for (let name in propertyDefinitions) {
		proxies[name] = proxyFromDef(propertyDefinitions[name]);
	}

	// Construct the dependency graph
	let propWorkingSet = Object.keys(propertyDefinitions);

	// Define the layers:
	const layers = [];
	Model.prototype.layers = layers;

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
			let proxy = proxies[name];
			let def = proxy._def;

			// Is this property one whos dependencies (if any) have already been added
			if (workDeps.get(def).length == 0) {
				// Add the definition to the layer
				layer.add(proxy);

				let setter;
				if (depth == 0) {
					// This is a fundamental property (has no dependencies)
					setter = revalidateFunc(proxy);
				} else {
					// MAYBE: Allow setters for computed properties?
					proxy.revalidate = revalidateFunc(proxy);
				}

				// Actually define the property
				Object.defineProperty(Model.prototype, name, {
					get: function () {
						return proxy.cachedValue;
					},
					set: setter
				});

				proxy.dependents = [];
				proxy.depth = depth;

				// Remove this property from our working set
				propWorkingSet.splice(i, 1);

				// Splicing will shift everything down (in index position) so we should continue with the same index
			} else {
				++i;
			}
		}

		// Remove the properties that we added in this pass from the dependencies of other properties and add those properties as dependents
		let olds = Array.from(layer.values());
		for (let key of propWorkingSet) {
			const prop = proxies[key];
			let workingDependencies = workDeps.get(prop._def)
			let i = 0; 
			while (workingDependencies.length > 0 && i < olds.length) {
				let old = olds[i];
				// If the property had the added property as a dependency...
				let index = workingDependencies.indexOf(old.name);
				if (index != -1) {
					// ...add the property as a dependent of the added property and...
					old.dependents.push(prop);
					// ...remove the added property
					workingDependencies.splice(index, 1);
				}
				++i;
			}
		}

		// Check for circular dependencies (if a full pass of the working prop list finds no properties that can be inserted into the graph then something is wrong, almost certainly a circular dependency).
		if (layer.size == 0) {
			throw new MalformedGraph(propWorkingSet);
		}

		++depth;
	}

	// Apply the constructors
	if (constructors) {
		// Convert from names to proxies
		Model.prototype.constructorDefinitions = constructors.map(constr => {
			constr.map(name => {
				if (!(name in proxies)) {
					throw new Error(`In a constructor definition: the property ${name} is not defined`);
				}
				return proxies[name]
			});
		});

		// Verify that all the constructors have unique signatures (types)
		let workingSet = Array.from(Model.prototype.constructorDefinitions);
		while (workingSet.length != 0) {
			let test = workingSet.shift();
			otherLoop:
			for (let other of workingSet) {
				if (test.length == other.length) {
					for (let i = 0; i < test.length; ++i) {
						if (test[i].type != other[i].type) {
							continue otherLoop;
						}
					}
					function format(ar) {
						return ar.map(p => `${p.name}(${p.type})`).join(', ');
					}
					throw new Error(`At least two constructor definitions have the same format (number of parameters and parameter types): ${format(test)} and ${format(other)}`);
				}
			}
		}
	} else {
		Model.prototype.constructorDefinitions = [];
	}

	// Return the model we've constructed
	return Model;
}