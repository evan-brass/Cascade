"use strict";

export function parameterList(func) {
	return (new String(func))
		.match(/^(function)?\s*\w*\(([^)]*)\)/)[2]
		.split(',')
		.map(arg => arg.trim())
		.filter(parName => parName != '');
}