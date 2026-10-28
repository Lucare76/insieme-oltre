import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { storySeoCopy } = require(path.join(process.env.STORY_SEO_TEST_BUILD, 'storySeo.js'));

test('CMS story subject is preserved in descriptive metadata without adding a diagnosis', () => {
 const result = storySeoCopy({ name: 'Vincenzo', storyTitle: 'La determinazione di costruire la propria strada', cardSubtitle: 'Un altro sottotitolo' });
 assert.equal(result.title, 'Vincenzo: La determinazione di costruire la propria strada | Insieme Oltre');
 assert.match(result.description, /Vincenzo/);
 assert.doesNotMatch(result.description, /diagnosi|sindrome|genitori/i);
});
test('Missing story heading falls back to the real card subtitle', () => {
 const result = storySeoCopy({ name: 'Davide', storyTitle: '   ', cardSubtitle: 'Un amore in più per tutti noi.' });
 assert.equal(result.title, 'Davide: Un amore in più per tutti noi | Insieme Oltre');
 assert.doesNotMatch(result.description, /\.\./);
});
test('Empty subjects retain useful name-based metadata', () => {
 const result = storySeoCopy({ name: 'Persona', storyTitle: '', cardSubtitle: '' });
 assert.equal(result.title, 'La storia di Persona | Insieme Oltre');
 assert.match(result.description, /Ischia/);
});
test('Formatting markers and whitespace are removed from metadata only', () => {
 const result = storySeoCopy({ name: '  Nome  ', storyTitle: '**La mia storia**\n insieme.', cardSubtitle: '' });
 assert.equal(result.title, 'Nome: La mia storia insieme | Insieme Oltre');
});
