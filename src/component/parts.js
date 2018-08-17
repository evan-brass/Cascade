"use strict";

import parameterList from "../common/parameterList.js";

export function Part(instance) {
	return {
		Link(links, func, alternate) {
			let values = [];
			values.length = links.length;

			let dependencies = (func.dependencies || parameterList(func)).slice(links.length - 1);

			let sections = links.map(str => str.split('.'));
			groups = {};
			for (let i = 0; i < sections.length; ++i) {
				const sect = sections[i];
				const name = sect[0];
				if (name in groups) {
					groups[name].push(i);
				} else {
					groups[name] = [i];
				}
			}
			for (let name in groups) {
				let prev;
				function sub(next) {
					if (prev != null) {
						// TODO: Unuse sub from the previous link
					}
					prev = next;
					// TODO: Use sub on the new link

				}
				instance.use([name], sub);
			}

			let newFunc = function (...pars) {
				func(...values, ...pars);
			}
			newFunc.dependencies = dependencies;

			return newFunc;
		}
	}
}

function completePart(func) {

}



export function createParts(expressions) {

}