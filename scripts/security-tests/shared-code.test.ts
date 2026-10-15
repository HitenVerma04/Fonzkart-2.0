// Code the website and the phone apps share as copies (the apps cannot import from the website's folders). If one
// side changes without the other, the website and the apps would show the same order differently.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');

describe('shared code: the apps use the website\'s own order logic', () => {
    test('mobile/packages/core/src/orderStatus.ts is lib/order-status.ts (after its 3-line header)', () => {
        const copy = read('mobile/packages/core/src/orderStatus.ts').split('\n').slice(3).join('\n');
        assert.equal(copy, read('lib/order-status.ts'), 'copy lib/order-status.ts to the apps again');
    });
});
