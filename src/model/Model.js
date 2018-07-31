"use strict";

import parameterList from "../common/parameterList.js";
import { dedupeBaseClass } from "./baseclass.js";
import { InternalError, InvalidDefinition, IncompatibleDefinition, MalformedGraph, UseError } from "./errors.js";
import defaultCompare from "./defaultCompare.js";

// TODO: Need a way of declaring what properties you need on linked/collected models to reduce network requests.
// Figure out how to handle linked models
// TODO: Need a way of declaring what constructors are available (ex. Rectangle(width, height), Circle(Radius),...)
// TODO: Parse dependencies directly from the functions.  (Using something like: (new String(func)).match(...))
// MAYBE: Asyncronous computed properties?  In a way, they already work, you just get a promise at the end rather than some asyncronous propagation.  Is that ok?

// TODO: Patch should return a boolean determining if the value changed because patch update the value in place and compare might not be able to determine what changed.
// MAYBE: Have a better way of telling dependents what has changed rather than just that something has changed.
// TODO: Need userCount to be instance level not model level.

function revalidateFunc(node) {
	// Figure out how to check if our cached value is different from the new value
	let equals = node.compare || defaultCompare(node.type);
	let instanceData;
	
	function propagate(func) {
		return function (...pars) {
			func.call(this, ...pars);

			this._propagateUpdates();
		}
	}
	function checkCached(func) {
		return function (...pars) {
			let oldVal = node.cachedValue;

			let newVal = func.call(this, ...pars);

			// Has the property's value actually changed?
			if (!equals(newVal, oldVal)) {
				// Update the cache
				node.cachedValue = newVal;

				// Add our dependents
				this._addDependents(node.dependents);
			}
		}
	}

	// Determine what revalidation function to choose.
	if (node.dependencies.length != 0) {
		// Computed Property:
		if (node.patch !== undefined) {
			// If a definition has a patch then it should be called everytime except the first.
			return checkCached(function () {
				let oldVal = node.cachedValue;

				let inputs = node.dependencies.map(name => this[name]);
				if (oldVal === undefined) {
					// Cal func if we've never computed this property before.
					newVal = node.value.apply(this, inputs);
				} else {
					// Otherwise patch the previous value given the new information.
					// While func should be a pure function, patch is not necessarily.  For that reason we can store (locally in a closure of the patch function) the previous values that func/patch was given or do whatever we want.  Just be careful/considerate.
					// MAYBE: Would .call(this, oldval, ...inputs) be better than the concat?
					newVal = node.patch(oldVal, ...inputs);
				}
				return newVal;
			});
		} else {
			return checkCached(function () {
				let inputs = node.dependencies.map(name => this[name]);
				return node.value.apply(this, inputs);
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
			// Computed property or empty as default for a simple property
			def.dependencies = parameterList(def.value);
		} else {
			def.dependencies = [];
		}
	}
}

function nodeFromDefinition(definition) {
	// These properties are the ones that we want to reflect from the definition.
	const EXPOSED = ['name', 'type', 'value', 'compare', 'patch', 'dependencies'];

	let node = {
		_def: definition,
		depth: -1,
		dependents: []
	};
	for (let name of EXPOSED) {
		Object.defineProperty(node, name,  {
			get: function () {
				return definition[name];
			}
		});
	}
	return node;
}

export default function (newPropertyDefinitions, base = Object) {
	let Model;
	let propertyDefinitions;
	let nodes;
	function constructBaseClass(next) {
		return function () {
			// This is the class of the model we're creating.
			// MAYBE: Does this really need to be a static getter?
			Model = dedupeBaseClass(base);

			next();

			Object.defineProperty(Model, 'propertyDefinitions', {
				get: () => propertyDefinitions
			});
		};
	}
	function defineConstructors(next = function () { }) {
		return function () {
			if ('constructors' in newPropertyDefinitions) {
				// Save the constructors property for later
				const constructors = newPropertyDefinitions.constructors;
				delete newPropertyDefinitions.constructors;

				next();

				// Convert from names to proxies
				Model.prototype.constructorDefinitions = constructors.map(constr => {
					return constr.map(name => {
						if (!(name in nodes)) {
							throw new Error(`In a constructor definition: the property ${name} is not defined`);
						}
						return nodes[name];
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
							throw new Error(`At least two constructor definitions have the same format (number of parameters and parameter types) and are thus ambiguous`);
						}
					}
				}
			} else {
				Model.prototype.constructorDefinitions = [[]];
				next();
			}
		}
	}
	function addPropertyDefinitions(next = function () { }) {
		return function () {
			// Include property definitions from the base class
			propertyDefinitions = Object.assign({}, base.propertyDefinitions);

			for (let name in newPropertyDefinitions) {
				const oldProp = propertyDefinitions[name];
				const prop = newPropertyDefinitions[name];

				// Set the name of the property.
				prop.name = name;

				// Make sure that the property definition that the type and kind of any overriding definitions match that of the existing definition.
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

				// Add the property to our property definitions
				propertyDefinitions[name] = prop;
			}

			next();
		}
	}
	function createGraph(next = function () { }) {
		return function () {
			let workDeps = new Map();
			for (let name in propertyDefinitions) {
				const def = propertyDefinitions[name];
				// Copy our dependencies so that we can cross them off later
				workDeps.set(def, Array.from(def.dependencies));
			}

			// Create the nodes of our dependency graph.
			nodes = {};
			Model.prototype.nodes = nodes;
			for (let name in propertyDefinitions) {
				nodes[name] = nodeFromDefinition(propertyDefinitions[name]);
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
					let node = nodes[name];
					let def = node._def;

					// Is this property one whos dependencies (if any) have already been added
					if (workDeps.get(def).length == 0) {
						// Add the definition to the layer
						layer.add(node);

						let setter;
						if (depth == 0) {
							// This is a fundamental property (has no dependencies)
							setter = revalidateFunc(node);
						} else {
							// MAYBE: Allow setters for computed properties?
							node.revalidate = revalidateFunc(node);
						}

						// Actually define the property
						Object.defineProperty(Model.prototype, name, {
							get: function () {
								return node.cachedValue;
							},
							set: setter
						});

						node.dependents = [];
						node.depth = depth;

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

			next();
		};
	}

	constructBaseClass(
		defineConstructors(
			addPropertyDefinitions(
				createGraph())))
		();

	// Return the model we've constructed
	return Model;
}