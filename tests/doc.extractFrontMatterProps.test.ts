import NRDoc from '../src/doc';

describe('extractFrontMatterProps', () => {
  it('extrait les propriétés avant ***', () => {
    const doc = new NRDoc({} as any, {} as any, {} as any);
    const content = `
Source: Wikipedia
Auteur : Jean Dupont
MOC: Projet X

***

# Titre
Contenu de la note
    `.trim();

    const props = doc.extractFrontMatterProps(content);
    expect(props['Source']).toBe('Wikipedia');
    expect(props['Auteur']).toBe('Jean Dupont');
    expect(props['MOC']).toBe('Projet X');
    expect(Object.keys(props).length).toBe(3);
  });
});
