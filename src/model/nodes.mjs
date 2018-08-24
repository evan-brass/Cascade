import defaultCompare from "./defaultCompare.mjs";

// TODO: Detect Circular Dependencies?  How do we do that when the graph keeps changing.

export class Node {
	constructor(graph) {
		// Dependencies will be a list of names that the Node accesses in the order that it accesses them.  There will likely be repetition in this list, but I suspect that we'll be able to detect deviations in property use more quickly by knowing how the function accessed properties previously.
		this.graph = graph;
		this.dependencies = [];
		this.dependents = new Set();
	}
	addDependents() {

	}
	trace() {
		const deps = this.dependencies;
		let index = 0;
		let added = [];
		let removed;

		return {
			addDependency(name) {
				const prev = deps[index];
				if (prev !== name) {
					// Here we make sure that the the added nodes are actually new.
					this.graph[name].dependents.add(this);
					deps.splice(index, 0, name);
				}
				++index;
			},
			end() {
				removed = deps.splice(index, deps.length - index)
					.filter(name => !deps.includes(name));

				// Handle the properties that have been removed.
				for (let name of added) {
					this.graph[name].dependents.add(this);
				}

				for (let name of removed) {
					this.graph[name].dependents.delete(this);
				}
			}
		};
	}
}
export class DataNode extends Node {
	constructor(graph, name) {
		super(graph);

		this.name = name;
	}
	value(vm) {
		return data[name];
	}
	// Data nodes can't be revalidated, because they 
}
export class ComputedNode extends Node {
	constructor(graph, computedDefinition) {
		super(graph);

		this.def = computedDefinition;
		this.cached = undefined;
		this.compare = this.def.compare || defaultCompare;
		this.func = this.def.func || function (vm) {
			throw new Error('Default computing function called.');
		};
		this.setter = this.def.set || function (vm, newVal) {

		};
	}
	revalidate(vm) {
		let newVal = this.func(vm);
		if (!this.compare(newVal, this.cached)) {
			this.addDependents();
		}
	}
	value(vm) {
		if (this.cached !== undefined) {
			return this.cached;
		} else {
			this.revalidate(vm);

			return this.cached;
		}
	}
}
class WatcherNode extends Node {
	constructor(graph, watchFunc) {
		super(graph);

		this.watchFunc = watchFunc;
	}
	revalidate(vm) {
		this.graph.stack.push(this);

		this

		this.graph.stack.pop();
		this.graph.propagationTasks.delete(this);
	}
	// Watcher Nodes can't have a value
}