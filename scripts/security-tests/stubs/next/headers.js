// Cookie store backed by globalThis.__jar (a Map of name -> { value, opts }) that the tests switch per actor.
exports.cookies = async () => {
  const jar = globalThis.__jar;
  return {
    get: (name) => (jar.has(name) ? { name, value: jar.get(name).value } : undefined),
    set: (name, value, opts = {}) => { jar.set(name, { value, opts }); },
    delete: (name) => { jar.delete(name); },
  };
};
exports.headers = async () => new Headers();
