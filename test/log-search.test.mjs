// Run from the repository root: node --test test/log-search.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLog } from '../src-frontend/src/utils/logSearch.js';

test('plain search is literal and case insensitive by default', () => {
    const rows = searchLog('Error [sshd]\nerror sshd\nERROR [sshd]', '[sshd]');
    assert.deepEqual(rows.map((row) => row.matches), [[[6, 12]], [], [[6, 12]]]);
    assert.deepEqual(searchLog('ERROR\nerror', 'error', false, true).map((row) => row.matches.length), [0, 1]);
});

test('regex searches each line and finds multiple occurrences', () => {
    const rows = searchLog('Failed from 192.0.2.1 and 192.0.2.2\nAccepted login', '192\\.0\\.2\\.\\d+', true);
    assert.equal(rows[0].matches.length, 2);
    assert.equal(rows[1].matches.length, 0);
    assert.equal(rows[0].text.slice(...rows[0].matches[0]), '192.0.2.1');
});

test('anchors and zero-width matches complete and identify matching lines', () => {
    assert.deepEqual(searchLog('ERROR test\nOK\nERROR again', '^ERROR', true).map((row) => row.matches.length), [1, 0, 1]);
    assert.deepEqual(searchLog('a\nb', '^', true).map((row) => row.matches), [[[0, 0]], [[0, 0]]]);
});

test('invalid patterns throw while empty searches preserve raw content', () => {
    assert.throws(() => searchLog('test', '[', true), SyntaxError);
    assert.deepEqual(searchLog('', 'anything'), []);
    const rows = searchLog('one\n\n<script>alert(1)</script>\n', '');
    assert.equal(rows.map((row) => row.text).join('\n'), 'one\n\n<script>alert(1)</script>\n');
    assert.ok(rows.every((row) => row.matches.length === 0));
});

test('literal escaping covers regex metacharacters and repeated matches', () => {
    const literal = '.*+?^${}()|[]\\';
    const rows = searchLog(`${literal} ${literal}`, literal);
    assert.deepEqual(rows[0].matches, [[0, literal.length], [literal.length + 1, literal.length * 2 + 1]]);
});
