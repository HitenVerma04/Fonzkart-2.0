// Enough of React for modules to load on the server; nothing is ever rendered.
const noop = () => {};
module.exports = {
  createElement: () => null, Fragment: 'Fragment', Children: { map: () => [], toArray: () => [], only: (c) => c },
  forwardRef: (render) => render, memo: (component) => component, lazy: (f) => f, cache: (f) => f,
  createContext: (value) => ({ Provider: 'Provider', Consumer: 'Consumer', _currentValue: value }),
  useState: (v) => [typeof v === 'function' ? v() : v, noop], useReducer: (r, v) => [v, noop],
  useEffect: noop, useLayoutEffect: noop, useRef: (v) => ({ current: v }), useMemo: (f) => f(),
  useCallback: (f) => f, useContext: (c) => (c ? c._currentValue : undefined), useId: () => 'id',
  useTransition: () => [false, (f) => f()], startTransition: (f) => f(),
};
