"use strict";

import Model from "../../src/model/model.js";
import { MalformedGraph, InvalidDefinition, IncompatibleDefinition } from "../../src/model/errors.js";
import { ShapeDef, RectangleDef, SquareDef, CircleDef } from "../common/model_definitions.js";

const assert = chai.assert;

describe("Model", function () {
	describe("Graph Errors", function () {

		it("Throws for circular dependencies", function () {
			assert.throws(function () {
				const circular = Model({
					'regular': {
						type: Number,
						value: 5
					},
					'x': {
						type: Number,
						value: (y) => { }
					},
					'y': {
						type: Number,
						value: (x) => { }
					}
				});
			}, MalformedGraph);
		});
	});
	describe("Invalid Definitions", function () {
		it("Throws for non-existant dependencies", function () {
			assert.throws(function () {
				const circularDeps = Model({
					'regular': {
						type: Number,
						value: 5
					},
					'y': {
						type: Number,
						value(nonExistent) { }
					}
				});
			}, InvalidDefinition);
		});
		it("Throws for computed property without a type", function () {
			assert.throws(function () {
				const circular = Model({
					'x': {
						type: Number,
						value: 3
					},
					'computed': {
						value(x) { }
					}
				});
			}, InvalidDefinition);
		});
		it("Throws for fundamental property without a type", function () {
			assert.throws(function () {
				const circular = Model({
					'x': {
						value: 3
					},
					'computed': {
						type: Number,
						value(x) { }
					}
				});
			}, InvalidDefinition);
		});
	});
	describe('Basic Model: Square', function () {
		let Regular;

		before('Create Model', function () {
			Regular = Model({
				'side': {
					type: Number,
					value: 0
				},
				'area': {
					type: Number,
					value(side) {
						return Math.pow(side, 2);
					}
				},
			});
		});
		describe('Constructor/Model', function () {
			it('Has a propertyDefinitions property/getter', function () {
				assert.property(Regular, 'propertyDefinitions');
			});
		});
		describe('Instance', function () {
			let sqr;
			beforeEach('Create the instance', function () {
				sqr = new Regular();
			});
			it('Has a side property', function () {
				assert.property(sqr, 'side');
			});
			it('Has an area property', function () {
				assert.property(sqr, 'area');
			});
			it('Initial side is 0', function () {
				assert.strictEqual(sqr.side, 0);
			});
			it("Setting side (fundamental) changes instance's value", function () {
				sqr.side = 3;
				assert.strictEqual(sqr.side, 3);
			});
		});
		describe('Propagation', function () {
			let sqr;
			beforeEach('Create the instance', function () {
				sqr = new Regular();
			});
			it('Use function for side (fundamental) is called with 5 when side is set to 5', function () {
				let called = false;
				sqr.use(['side'], (side) => {
					if (side == 5) {
						called = true;
					}
				});
				sqr.side = 5;
				assert.strictEqual(called, true);
			});
			it("Use function for area (computed) is called with 25 when side is set to 5", function () {
				let called = false;
				sqr.use(['area'], (area) => {
					if (area == 25) {
						called = true;
					}
				});
				sqr.side = 5;
				assert.strictEqual(called, true);
			});
		});
	});
	describe('Inheritence', function () {
		let Shape;
		before('Construct the base Model for our inheritence tests', function () {
			Shape = Model(ShapeDef);
		});
		describe('Errors', function () {
			it('Throw IncompatibleDefinition for Shape with wrong overriding type (area = Object)', function () {
				assert.throws(() => {
					let invalid = Model({
						'area': {
							type: Object,
							value: {}
						}
					}, Shape)
				}, IncompatibleDefinition);
			});
		});
		describe('Rectangle', function () {
			let Rectangle;
			let inst;
			before('Construct Rectangle Model', function () {
				Rectangle = Model(RectangleDef, Shape);
			});
			beforeEach('Create a brand new instance', function () {
				inst = new Rectangle();
			});
			it('Use function for area should return 30 after width and height have been set to 5 and 6', function () {
				let called = false;
				inst.width = 5;
				inst.height = 6;
				inst.use(['area'], function(area) {
					assert.strictEqual(area, 30);
					called = true;
				});
				assert.strictEqual(called, true);
			});
			describe('Square', function () {
				let Square;
				let inst;
				before('Construct Square Model', function () {
					Square = Model(SquareDef, Rectangle);
				});
				beforeEach('Create a brand new instance', function () {
					inst = new Square();
				});
			});
		});
		describe('Circle', function () {
			let Circle;
			let inst;
			before('Construct the Circle Model', function () {
				Circle = Model(CircleDef, Shape);
			});
			beforeEach('Create a new instance of a Circle for each test', function () {
				inst = new Circle();
			});
		});
	});
});