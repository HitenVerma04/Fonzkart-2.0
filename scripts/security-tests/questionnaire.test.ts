// The apps load the device questionnaire from Spring Boot (GET /api/catalog/questionnaire), which serves a copy of
// lib/data.ts → questionnaireSteps. If the questions change here, the copy must be regenerated
// (backend/tools/catalog-sync/generate.mjs), or the website and the apps would ask different questions.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { questionnaireSteps } from '@/lib/data';

describe('questionnaire: website and apps ask the same questions', () => {
    test('backend copy matches lib/data.ts (regenerate with generate.mjs if this fails)', () => {
        const file = join(process.cwd(), 'backend/src/main/resources/catalog/questionnaire.json');
        assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(JSON.stringify(questionnaireSteps)));
    });
});
