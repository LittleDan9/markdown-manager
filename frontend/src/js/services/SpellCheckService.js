import nspell from 'nspell';

class SpellCheckService {
  constructor() {
    this.speller = null;
  }

  async init() {
    if (this.speller) return;
    try {
      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dictionary/index.aff'),
        fetch('/dictionary/index.dic')
      ]);
      const aff = await affResponse.text();
      const dic = await dicResponse.text();
      this.speller = nspell(aff, dic);
    } catch (err) {
      console.error('SpellCheckService init error', err);
    }
  }

  check(text) {
    if (!this.speller) return [];
    const results = [];
    const regex = /\b[A-Za-z']+\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      if (!this.speller.correct(word)) {
        const suggestions = this.speller.suggest(word);
        const offset = match.index;
        // compute line and column based on offset
        const upTo = text.slice(0, offset);
        const lines = upTo.split('\n');
        const lineNumber = lines.length;
        const column = lines[lines.length - 1].length + 1;
        results.push({ word, suggestions, lineNumber, column });
      }
    }
    return results;
  }
}

export default new SpellCheckService();
