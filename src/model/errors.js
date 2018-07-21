"use strict";

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
		super(`Malformed Graph: Cascade attempted to create an empty layer of the dependency graph.  This usually indicates a circular dependency.  It should be located in one of these definitions: ${problemDefinitionNames.join(', ')}.`);
	}
}
export class UseError extends CascadeError {
	constructor(message) {
		super(`Use Error: ${message}.`);
	}
}