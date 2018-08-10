import Component from "../src/component/component.js";
import Model from "../src/model/model.js";

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

let viewResult = Component(Post, function (cascade) {
	const html = cascade.html;
	return html`<article ${created =>
		(Date.now() - created.getTime() < (24 * 60 * 60 * 1000)) ? 'new' : ''}>
		<header>
			<h1>${title => title} &mdash; ${author => author.first}</h1>
		</header>
		${contents => contents}
	</article>`;
});

console.log(viewResult);
document.getElementById('playground').appendChild(viewResult.fragment);