// JSX is captured as plain data so tests can read the props a page passes to each component.
const el = (type, props, key) => ({ $$el: true, type, props: props || {}, key: key === undefined ? null : key });
exports.jsx = el; exports.jsxs = el; exports.Fragment = 'Fragment';
