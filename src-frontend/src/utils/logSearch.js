/** Search each loaded line independently; offsets are used for safe React highlighting. */
export function searchLog(text, query, regex = false, matchCase = false) {
    const lines = text === '' ? [] : text.split('\n');
    const pattern = query && new RegExp(
        regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        matchCase ? 'g' : 'gi'
    );
    return lines.map((line, index) => {
        const matches = pattern
            ? Array.from(line.matchAll(pattern), (match) => [match.index, match.index + match[0].length])
            : [];
        return { text: line, index, matches };
    });
}
