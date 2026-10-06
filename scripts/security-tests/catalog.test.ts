// Model pictures and duplicate removal match models within the same brand only: "iPhone 14" and "Realme 14" both
// reduce to the name key "14" once brand words are dropped (live site: iPhone 14 / 14 Pro showed Realme pictures).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateModels, resolveModelImage } from '@/lib/catalog2026';

describe('catalog: no cross-brand matching', () => {
    test('a model keeps its own photo instead of another brand\'s look-alike', () => {
        assert.equal(resolveModelImage('apple', 'iPhone 14', '/models/apple/APPLE_IPHONE_14.png'), '/models/apple/APPLE_IPHONE_14.png');
        assert.equal(resolveModelImage('apple', 'iPhone 14 Pro', '/models/apple/Apple_iPhone_14_Pro.png'), '/models/apple/Apple_iPhone_14_Pro.png');
        assert.equal(resolveModelImage('poco', 'C75 5G', '/models/poco/Poco_C75.png'), '/models/poco/Poco_C75.png');
        assert.equal(resolveModelImage('xiaomi', '14', '/models/xiaomi/Xiaomi_14.png'), '/models/xiaomi/Xiaomi_14.png');
    });

    test('the same brand still gets its built-in picture; Redmi and POCO count as Xiaomi', () => {
        assert.equal(resolveModelImage('realme', 'Realme 14 Pro', ''), '/models/realme/Realme_14_Pro_5G.png');
        // A built-in POCO model filed under "xiaomi" still gets its POCO picture.
        const pocoF8 = resolveModelImage('poco', 'POCO F8 5G', '');
        assert.match(pocoF8, /^\/models\/poco\//);
        assert.equal(resolveModelImage('xiaomi', 'POCO F8 5G', ''), pocoF8);
    });

    test('duplicate removal never hides another brand\'s model', () => {
        const listed = deduplicateModels([
            { id: 'a', brandId: 'apple', name: 'iPhone 14 Pro', img: '/a.png', priority: 100 },
            { id: 'r', brandId: 'realme', name: 'Realme 14 Pro 5G', img: '/r.png', priority: 10 },
            { id: 'r2', brandId: 'realme', name: 'Realme 14 Pro', img: '/r2.png', priority: 100 },
        ]);
        assert.deepEqual(listed.map(m => m.id).sort(), ['a', 'r']); // the two Realme rows are one model
    });
});
