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

  it("extrait les propriétés du front matter avec liens et tags", () => {
    const doc = new NRDoc({} as any, {} as any, {} as any);
    const content = `
# Metadata
Auteur : [[Morgan Housel]]
Source : La Psychologie De lArgent
Category: #books
***
## First note

Le vrai succès, c'est de sortir d'une course effrénée pour moduler ses activités pour avoir l'esprit tranquille.

## Second Note

Charlie Munger l'a bien dit : « La première règle de la composition est de ne jamais l'interrompre inutilement.
    `.trim();

    const props = doc.extractFrontMatterProps(content);
    expect(props["Auteur"]).toBe("[[Morgan Housel]]");
    expect(props["Source"]).toBe("La Psychologie De lArgent");
    expect(props["Category"]).toBe("#books");
    expect(Object.keys(props).length).toBe(3);
  });
});
