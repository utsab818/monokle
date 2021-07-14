import {monaco} from 'react-monaco-editor';
import {v4 as uuidv4} from 'uuid';

// @ts-ignore
import {CommandsRegistry} from 'monaco-editor/esm/vs/platform/commands/common/commands';

import {
  GlyphDecorationTypes,
  InlineDecorationTypes,
  getGlyphDecorationOptions,
  getInlineDecorationOptions,
} from './editorConstants';

export function clearDecorations(editor: monaco.editor.IStandaloneCodeEditor, idsOfDecorations: string[]) {
  editor.deltaDecorations(idsOfDecorations, []);
}

export function setDecorations(
  editor: monaco.editor.IStandaloneCodeEditor,
  decorations: monaco.editor.IModelDeltaDecoration[]
) {
  const decorationIds = editor.deltaDecorations([], decorations);
  return decorationIds;
}

export function createGlyphDecoration(lineIndex: number, glyphDecorationType: GlyphDecorationTypes) {
  const glyphDecoration: monaco.editor.IModelDeltaDecoration = {
    range: new monaco.Range(lineIndex, 1, lineIndex, 1),
    options: getGlyphDecorationOptions(glyphDecorationType),
  };
  return glyphDecoration;
}

export function createInlineDecoration(range: monaco.IRange, inlineDecorationType: InlineDecorationTypes) {
  const inlineDecoration: monaco.editor.IModelDeltaDecoration = {
    range,
    options: getInlineDecorationOptions(inlineDecorationType),
  };
  return inlineDecoration;
}

export function createMarkdownString(text: string): monaco.IMarkdownString {
  return {isTrusted: true, value: text};
}

export function createCommandMarkdownLink(
  text: string,
  handler: monaco.editor.ICommandHandler
): {commandMarkdownLink: monaco.IMarkdownString; commandDisposable: monaco.IDisposable} {
  const commandId = `cmd_${uuidv4()}`;
  const commandDisposable: monaco.IDisposable = CommandsRegistry.registerCommand(commandId, handler);

  return {
    commandMarkdownLink: {
      isTrusted: true,
      value: `[${text}](command:${commandId})`,
    },
    commandDisposable,
  };
}

export function createHoverProvider(range: monaco.IRange, contents: monaco.IMarkdownString[]) {
  const hoverDisposable: monaco.IDisposable = monaco.languages.registerHoverProvider('yaml', {
    provideHover: (model: monaco.editor.ITextModel, position: monaco.Position) => {
      if (
        position.lineNumber >= range.startLineNumber &&
        position.lineNumber <= range.endLineNumber &&
        position.column >= range.startColumn &&
        position.column <= range.endColumn
      ) {
        return {
          range,
          contents,
        };
      }
      return null;
    },
  });
  return hoverDisposable;
}
