import { Editor, FileManager, TFile, Vault } from 'obsidian';
import { HEADING_REGEX } from './constants';
import MomentDateRegex from './moment-date-regex';
import { NotePlaceholders } from './placeholder';
import { NoteRefactorSettings } from './settings';
export type ReplaceMode = 'split' | 'replace-selection' | 'replace-headings';

export default class NRDoc {
  private settings: NoteRefactorSettings;
  private templatePlaceholders: NotePlaceholders;
  private momentRegex: MomentDateRegex;
  private vault: Vault;
  private fileManager: FileManager;
  // Ajout pour stocker les propriétés extraites
  private lastExtractedProps: Record<string, string> = {};

  constructor(
    settings: NoteRefactorSettings,
    vault: Vault,
    fileManager: FileManager
  ) {
    this.settings = settings;
    this.vault = vault;
    this.fileManager = fileManager;
    this.templatePlaceholders = new NotePlaceholders();
    this.momentRegex = new MomentDateRegex();
    this.lastExtractedProps = {};
  }
  /**
   * Extrait les propriétés front-matter (KEY: Value ou Key : Value) avant la première ligne "***".
   */
  extractFrontMatterProps(content: string): Record<string, string> {
    const props: Record<string, string> = {};
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.trim() === "***") break;
      const match = line.match(/^([\w\s]+)\s*:\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        props[key] = value;
      }
    }
    return props;
  }

  removeNoteRemainder(doc: Editor, text: string): void {
    const currentLine = doc.getCursor();
    const endPosition = doc.offsetToPos(doc.getValue().length);
    doc.replaceRange(text, currentLine, endPosition);
  }

  async replaceContent(
    fileName: string,
    filePath: string,
    doc: Editor,
    currentNote: TFile,
    content: string,
    originalContent: string,
    mode: ReplaceMode
  ): Promise<void> {
    const transclude = this.settings.transcludeByDefault ? "!" : "";
    const link = await this.markdownLink(filePath);
    const currentNoteLink = await this.markdownLink(currentNote.path);
    let contentToInsert = transclude + link;

    // Ajout : extraire les props du contenu original
    const props = this.extractFrontMatterProps(originalContent);
    
    contentToInsert = this.templatedContent(
      contentToInsert,
      this.settings.noteLinkTemplate,
      currentNote.basename,
      currentNoteLink,
      fileName,
      link,
      "",
      content,
      props
    );

    if (mode === "split") {
      this.removeNoteRemainder(doc, contentToInsert);
    } else if (mode === "replace-selection") {
      doc.replaceSelection(contentToInsert);
    } else if (mode === "replace-headings") {
      doc.setValue(doc.getValue().replace(originalContent, contentToInsert));
    }
  }

  async markdownLink(filePath: string) {
    const file = await this.vault
      .getMarkdownFiles()
      .filter((f: TFile) => f.path === filePath)[0];
    const link = await this.fileManager.generateMarkdownLink(file, "", "", "");
    return link;
  }

  /**
   * Ajoute le support des propriétés front-matter dans le template via {{prop[KEY]}}
   */
  templatedContent(
    input: string,
    template: string,
    currentNoteTitle: string,
    currentNoteLink: string,
    newNoteTitle: string,
    newNoteLink: string,
    newNotePath: string,
    newNoteContent: string,
    props?: Record<string, string>
  ): string {
    if (template === undefined || template === "") {
      return input;
    }
    let output = template;
    output = this.momentRegex.replace(output);
    output = this.templatePlaceholders.title.replace(output, currentNoteTitle);
    output = this.templatePlaceholders.link.replace(output, currentNoteLink);
    output = this.templatePlaceholders.newNoteTitle.replace(
      output,
      newNoteTitle
    );
    output = this.templatePlaceholders.newNoteLink.replace(output, newNoteLink);
    output = this.templatePlaceholders.newNoteContent.replace(
      output,
      newNoteContent
    );
    output = this.templatePlaceholders.newNotePath.replace(output, newNotePath);
    // Remplacement des {{prop[KEY]}}
    const propObj = props || this.lastExtractedProps;
    output = output.replace(
      /\{\{prop\[(.+?)\]\}\}/g,
      (_, key) => propObj[key] ?? ""
    );
    return output;
  }

  selectedContent(doc: Editor): string[] {
    const selectedText = doc.getSelection();
    const trimmedContent = selectedText.trim();
    return trimmedContent.split("\n");
  }

  noteRemainder(doc: Editor): string[] {
    doc.setCursor(doc.getCursor().line, 0);
    const currentLine = doc.getCursor();
    const endPosition = doc.offsetToPos(doc.getValue().length);
    const content = doc.getRange(currentLine, endPosition);
    const trimmedContent = content.trim();
    return trimmedContent.split("\n");
  }

  contentSplitByHeading(doc: Editor, headingLevel: number): string[][] {
    const content = doc.getValue().split("\n");
    const parentHeading = new Array(headingLevel).join("#") + " ";
    const heading = new Array(headingLevel + 1).join("#") + " ";
    const matches: string[][] = [];
    let headingMatch: string[] = [];
    content.forEach((line: string, i: number) => {
      if (line.startsWith(heading)) {
        if (headingMatch.length > 0) {
          matches.push(headingMatch);
          headingMatch = [];
          headingMatch.push(line);
        } else {
          headingMatch.push(line);
        }
      } else if (headingMatch.length > 0 && !line.startsWith(parentHeading)) {
        headingMatch.push(line);
      } else if (headingMatch.length > 0) {
        matches.push(headingMatch);
        headingMatch = [];
      }
      //Making sure the last headingMatch array is added to the matches
      if (i === content.length - 1 && headingMatch.length > 0) {
        matches.push(headingMatch);
      }
    });
    return matches;
  }

  /**
   * Amélioration : extrait les propriétés front-matter et les stocke pour le template
   */
  noteContent(
    firstLine: string,
    contentArr: string[],
    contentOnly?: boolean,
    fullContent?: string
  ): string {
    // Extraction des propriétés front-matter
    if (fullContent) {
      this.lastExtractedProps = this.extractFrontMatterProps(fullContent);
    }
    if (this.settings.includeFirstLineAsNoteHeading) {
      const headingBaseline = firstLine.replace(HEADING_REGEX, "");
      contentArr.unshift(
        `${this.settings.headingFormat} ${headingBaseline}`.trim()
      );
    } else if (!this.settings.excludeFirstLineInNote || contentOnly) {
      contentArr.unshift(firstLine);
    }
    if (this.settings.normalizeHeaderLevels) {
      contentArr = this.normalizeHeadingLevels(contentArr);
    }
    return contentArr.join("\n").trim();
  }

  normalizeHeadingLevels(contentArr: string[]): string[] {
    const minHeadingLevel = Math.min(
      ...contentArr
        .map((line) => this.headingLevel(line))
        .filter((level) => level > 0)
    );
    if (minHeadingLevel > 1) {
      contentArr.forEach((line, i) => {
        const level = this.headingLevel(line);
        if (level > 0) {
          contentArr[i] = line.substr(minHeadingLevel - 1);
        }
      });
    }
    return contentArr;
  }

  headingLevel(line: string): number {
    let headingLevel = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "#") {
        headingLevel++;
      } else if (line[i] === " ") {
        break;
      } else {
        headingLevel = 0;
        break;
      }
    }
    return headingLevel;
  }
}
