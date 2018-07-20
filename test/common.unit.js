import { parameterList } from "../src/common.js";

const assert = chai.assert;

describe('Common', function () {
	describe('parameterList', function () {
		it('Should throw for non function', function () {
			assert.throws(function () {
				parameterList({});
			}, Error);
		});
		describe('function keyword', function () {
			describe('3 parameters - different spacing', function () {
				let funcs = [
					function (param1, param2, param3) { console.log(param1, param2, param3); },
					function(param1, param2, param3)    { console.log(param1, param2, param3); },
					function    (param1, param2, param3) { console.log(param1, param2, param3); },
					function (param1, param2, param3){ console.log(param1, param2, param3); },
					function named(param1, param2, param3) { console.log(param1, param2, param3); }
				];
				funcs.forEach(func => {
					it(func.toString(), function () {
						assert.sameOrderedMembers(
							['param1', 'param2', 'param3'],
							parameterList(func)
						);
					});
				});
			});
			describe('no parameters', function () {
				let funcs = [
					function () { console.log(''); },
					function named() { console.log(''); }
				];
				funcs.forEach(func => {
					it(func.toString(), function () {
						assert.sameOrderedMembers(
							[],
							parameterList(func)
						);
					});
				});
			});
		});
		describe('arrow functions', function () {
			let funcs = [
				(param1, param2, param3) => { console.log(param1, param2, param3); },
				(x) => 2 * x,
				  (x)    => 2 * x,
				x => 2 * x,
				() => { console.log(''); }
			];
			let correct = [
				['param1', 'param2', 'param3'],
				['x'],
				['x'],
				['x'],
				[]
			];
			funcs.forEach((func, idx) => {
				it(func.toString(), function () {
					assert.sameOrderedMembers(
						correct[idx],
						parameterList(func)
					);
				});
			});
		});
		describe('Object Method', function () {
			let funcs = [
				({ func(param1, param2, param3) { console.log(param1, param2, param3); } }).func,
				({ func() { console.log(''); } }).func
			];
			let correct = [
				['param1', 'param2', 'param3'],
				[]
			];
			funcs.forEach((func, idx) => {
				it(func.toString(), function () {
					assert.sameOrderedMembers(
						correct[idx],
						parameterList(func)
					);
				});
			});
		});
		describe('new Function', function () {
			let funcs = [
				new Function('param1', 'param2', 'param3', 'console.log(param1, param2, param3)'),
				new Function('console.log("")')
			];
			let correct = [
				['param1', 'param2', 'param3'],
				[]
			];
			funcs.forEach((func, idx) => {
				it(func.toString(), function () {
					assert.sameOrderedMembers(
						correct[idx],
						parameterList(func)
					);
				});
			});
		});
	});
});