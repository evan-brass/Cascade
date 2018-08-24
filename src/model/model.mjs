import { Node, DataNode, WatcherNode } from "./nodes.mjs";

function standardizeComputed(computed) {
	for (let name in computed) {
		const val = computed[name];

		const defaults = {
			func() {
				throw new Error("Default func called.");
			},
			setter(vm, newVal) {
				throw new Error("Default setter called.");
			}
		};

		if (val instanceof Function) {
			computed[name] = Object.create(defaults);
			computed[name].func = val;
		} else {
			computed[name] = Object.assign(Object.create(defaults), val);
		}
	}
}

export default function Model(data, computedDefinitions) {
	let cache = {};

	const graph = new Map(); // Graph is a map so that watcher nodes can be accessed using a reference to thier function
	graph.stack = [];
	graph.updateTask = false;
	graph.propagationTasks = new Set();

	for (let prop in data) {
		graph.set(prop, new DataNode(prop));
	}
	for (let name in computed) {
		graph.set(name, new ComputedNode(computed[name]));
	}

	

	// Create the proxy that is the basis of our reactivity
	let m = new Proxy(data, {
		get: (object, propName) => {
			const node = graph[propName];
			if (!node) {
				throw new Error('Missing Property');
			}

			const trace = stack[stack.length - 1];
			if (trace) {
				trace.addDependency(propName);
			}

			return node.value(m);
		},
		set: (object, propName, newVal) => {
			const node = graph[propName];

			if (node instanceof DataNode) {
				// If the newVal is the same as what the old value is, then there's nothing we need to do.
				if (compare(newVal, cache[propName])) {
					return true;
				}
				// Update the dependents
				queueDependents(node);
			}




			return true;
		}
	});

	function queueDependents(node) {
		// TODO: Add the dependents to the propagationTasks
		// TODO: Make sure that a microtask is scheduled to propagate those tasks.
	}
}
// Can this handle linked models?  It would be nice if it could.
Model.watch = function (vm, func) {

};
// If the above function can handle linked models then is this even needed?
Model.multiWatcher = function(vms, func) {

};