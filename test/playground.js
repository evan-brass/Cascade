import Component from "../src/component/component.js";
import Model from "../src/model/model.js";
import StateModel from "../src/component/stateModel.js";

const Person = Model({
	'constructors': [
		['first', 'last', 'age'],
		[]
	],
	'first': {
		type: String,
		value: ''
	},
	'last': {
		type: String,
		value: ''
	},
	'age': {
		type: Number,
		value: -1
	}
});
const Post = Model({
	'constructors': [
		['title', 'contents'],
		['author', 'title', 'contents', 'created'],
		[]
	],
	'title': {
		type: String,
		value: 'untitled'
	},
	'author': {
		type: Person,
		value: null
	},
	'created': {
		type: Date,
		value: null
	},
	'contents': {
		type: String,
		value: ''
	}
});

let inst = new Post(new Person('Evan', 'Brass', 20), 'Title', 'This is the working?contents', new Date())
//let inst = new Post('TITLE', 'CONTENTS!');

console.log(inst.author, inst.title, inst.contents, inst.created);
window.inst = inst;

setTimeout(() => {
	inst.title = "New Title!";
}, 5000);

let Simple;
// /*
Simple = Component(function (cascade) {
	const html = cascade.html;
	return html`<article ${created =>
		(Date.now() - created.getTime() < (24 * 60 * 60 * 1000)) ? 'new' : ''}>
		<header>
			<h1>${title => title} &mdash; ${author => author.first}</h1>
		</header>
		${contents => contents}
	</article>`;
});
// */
 /*
Simple = class extends HTMLElement {
	constructor() {
		super();

		// Create a shadowDOM
		this.attachShadow({ mode: 'open' });

		// Create our fragment and link into it.
		this.shadowRoot.appendChild(template(this));
	}
};
// */

customElements.define('test-el', Simple);

let el = document.createElement('test-el');
console.log(el);

document.getElementById('playground').appendChild(el);