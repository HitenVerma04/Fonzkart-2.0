exports.redirect = (url) => { const e = new Error('NEXT_REDIRECT'); e.digest = 'NEXT_REDIRECT'; e.url = url; throw e; };
exports.permanentRedirect = exports.redirect;
exports.notFound = () => { const e = new Error('NEXT_NOT_FOUND'); e.digest = 'NEXT_NOT_FOUND'; throw e; };
exports.useRouter = () => ({ push() {}, replace() {}, refresh() {}, back() {} });
exports.usePathname = () => '/';
exports.useSearchParams = () => new URLSearchParams();
