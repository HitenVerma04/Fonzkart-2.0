// Every icon is a component that renders nothing.
module.exports = new Proxy({}, { get: (_, name) => (name === '__esModule' ? false : function Icon() { return null; }) });
