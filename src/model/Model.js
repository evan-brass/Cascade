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

function definitionDependencies(def) {
	// Handle errors
	if (def === undefined) {
		throw new InvalidDefinition('Property Definition missing');
	}
	

	if (def.dependencies === undefined) {
		if (def.value instanceof Function) {
			// Computed property or empty as default for a simple property
			def.dependencies = ;
		} else {
			def.dependencies = [];
		}
	}
}

function nodeFromDefinition(definition) {
	const node = Object.create(definition, {
		depth: {
			value: -1,
			writable: true
		},
		dependents: {
			value: [],
			writable: false
		}
	});
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

				// Convert from names to nodes
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
				const parentDefinition = propertyDefinitions[name];
				const newDefinition = newPropertyDefinitions[name];

				// Make sure that the property definition that the type and kind of any overriding definitions match that of the existing definition.
				if (parentDefinition !== undefined && parentDefinition.type !== newDefinition.type) {
					throw new IncompatibleDefinition(`The definition for ${name} doesn't match the definition on the base-model`);
				}
				
				// Check if the definition is malformed:
				if (!(newDefinition instanceof Object)) {
					throw new InvalidDefinition("A definition must be an object.  Later you may be able to use a simple initializer, but that hasn't been implemented yet");
				}
				if (newDefinition.type === undefined) {
					throw new InvalidDefinition('Currently, definitions must have a type specified, even on simple properties');
				}
				if (newDefinition.value === undefined) {
					throw new InvalidDefinition('A default value or value computing function must be defined on the definition');
				}

				// Make sure that all the fields that are optional are filled.
				const Defaults = {
					name,
					dependencies: (newDefinition.value instanceof Function) ? 
						parameterList(newDefinition.value) :
						[],
					compare: defaultCompare(newDefinition.type)
				};
				let definition = Object.assign(Defaults, newPropertyDefinitions);

				// Make sure that all of the dependencies exist in the property definitions
				for (let dep of newDefinition.dependencies) {
					if (propertyDefinitions[dep] === undefined && newPropertyDefinitions[dep] === undefined) {
						throw new InvalidDefinition(`There is no property definition for ${dep}. Check if it is mistyped`);
					}
				}

				// Add the property to our property definitions
				propertyDefinitions[name] = newDefinition;
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
					let def = Object.getPrototypeOf(node);

					// Is this property one whos dependencies (if any) have already been added
					if (workDeps.get(def).length == 0) {
						// Add the definition to the layer
						layer.add(node);

						let setter;
						if (depth == 0) {
							// This is a fundamental property (has no dependencies)
							setter = Model._setter(node);
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
					const prop = nodes[key];
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