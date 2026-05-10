import MD from 'markdown-it'
import minimatch from 'minimatch'

import {commentPlugin} from '../plugins/comment'
import {highlightPlugin} from '../plugins/highlight'
import {linkPlugin} from '../plugins/link'
import {tagPlugin} from '../plugins/tag'
import {
  combineFileLines,
  extractTextFromTodoLine,
  getAllLinesFromFile,
  getAllTagsFromMetadata,
  getFileFromPath,
  getFileLabelFromName,
  getFrontmatterTags,
  getIndentationSpacesFromTodoLine,
  getTagMeta,
  retrieveTag,
  lineIsValidTodo,
  mapLinkMeta,
  parsePriority,
  PRIORITY_EMOJI,
  appendTagToText,
  removeTagFromText,
  setLineTo,
  stripTrailingPriority,
  stripPriorityFromText,
  stripTrailingDoneDate,
  todoLineIsChecked,
} from './helpers'

import type {
  App,
  LinkCache,
  MetadataCache,
  TagCache,
  TFile,
  Vault,
} from 'obsidian'
import {Modal, TextComponent} from 'obsidian'
import * as Obsidian from 'obsidian'
import type {TodoItem, TagMeta, FileInfo} from 'src/_types'
import type {Priority} from 'src/_types'

/**
 * Finds all of the {@link TodoItem todos} in the {@link TFile files} that have been updated since the last re-render.
 *
 * @param files The files to search for todos.
 * @param todoTags The tag(s) that should be present on todos in order to be displayed by this plugin.
 * @param cache The Obsidian {@link MetadataCache} object.
 * @param vault The Obsidian {@link Vault} object.
 * @param includeFiles The pattern of files to include in the search for todos.
 * @param showChecked Whether the user wants to show completed todos in the plugin's UI.
 * @param lastRerender Timestamp of the last time we re-rendered the checklist.
 * @returns A map containing each {@link TFile file} that was updated, and the {@link TodoItem todos} in that file.
 * If there are no todos in a file, that file will still be present in the map, but the value for its entry will be an
 * empty array. This is required to account for the case where a file that previously had todos no longer has any.
 */
export const parseTodos = async (
  files: TFile[],
  todoTags: string[],
  cache: MetadataCache,
  vault: Vault,
  includeFiles: string,
  showChecked: boolean,
  showAllTodos: boolean,
  lastRerender: number,
): Promise<Map<TFile, TodoItem[]>> => {
  const includePattern = includeFiles.trim()
    ? includeFiles.trim().split('\n')
    : ['**/*']
  const filesWithCache = await Promise.all(
    files
      .filter(file => {
        if (file.stat.mtime < lastRerender) return false
        if (!includePattern.some(p => minimatch(file.path, p))) return false
        if (todoTags.length === 1 && todoTags[0] === '*') return true
        const fileCache = cache.getFileCache(file)
        const allTags = getAllTagsFromMetadata(fileCache)
        const tagsOnPage = allTags.filter(tag =>
          todoTags.includes(retrieveTag(getTagMeta(tag)).toLowerCase()),
        )
        return tagsOnPage.length > 0
      })
      .map<Promise<FileInfo>>(async file => {
        const fileCache = cache.getFileCache(file)
        const tagsOnPage =
          fileCache?.tags?.filter(e =>
            todoTags.includes(retrieveTag(getTagMeta(e.tag)).toLowerCase()),
          ) ?? []
        const frontMatterTags = getFrontmatterTags(fileCache, todoTags)
        const hasFrontMatterTag = frontMatterTags.length > 0
        const parseEntireFile =
          todoTags[0] === '*' || hasFrontMatterTag || showAllTodos
        const content = await vault.cachedRead(file)
        return {
          content,
          cache: fileCache,
          validTags: tagsOnPage.map(e => ({
            ...e,
            tag: e.tag.toLowerCase(),
          })),
          file,
          parseEntireFile,
          frontmatterTag: todoTags.length ? frontMatterTags[0] : undefined,
        }
      }),
  )

  const todosForUpdatedFiles = new Map<TFile, TodoItem[]>()
  for (const fileInfo of filesWithCache) {
    let todos = findAllTodosInFile(fileInfo)
    if (!showChecked) {
      todos = todos.filter(todo => !todo.checked)
    }
    todosForUpdatedFiles.set(fileInfo.file, todos)
  }

  return todosForUpdatedFiles
}

export const toggleTodoItem = async (item: TodoItem, app: App) => {
  return setTodoItemChecked(item, !item.checked, app)
}

export const setTodoItemChecked = async (
  item: TodoItem,
  checked: boolean,
  app: App,
  expectedOriginalText = item.originalText,
): Promise<boolean> => {
  const file = getFileFromPath(app.vault, item.filePath)
  if (!file) return false
  const currentFileContents = await app.vault.read(file)
  const currentFileLines = getAllLinesFromFile(currentFileContents)
  if (!currentFileLines[item.line].includes(expectedOriginalText)) return false
  const newData = setTodoStatusAtLineTo(
    currentFileLines,
    item.line,
    checked,
  )
  await app.vault.modify(file, newData)
  item.checked = checked
  return true
}

export const setTodoItemPriority = async (
  item: TodoItem,
  priority: Priority,
  app: App,
  expectedOriginalText = item.originalText,
): Promise<boolean> => {
  const file = getFileFromPath(app.vault, item.filePath)
  if (!file) return false
  const currentFileContents = await app.vault.read(file)
  const currentFileLines = getAllLinesFromFile(currentFileContents)
  const targetLine = currentFileLines[item.line]
  if (!targetLine || !targetLine.includes(expectedOriginalText)) return false
  const updated = setTodoPriorityAtLine(currentFileLines, item.line, priority)
  await app.vault.modify(file, updated)
  item.priority = priority
  return true
}

export const setTodoItemText = async (
  item: TodoItem,
  text: string,
  app: App,
  expectedOriginalText = item.originalText,
): Promise<boolean> => {
  const file = getFileFromPath(app.vault, item.filePath)
  if (!file) return false
  const currentFileContents = await app.vault.read(file)
  const currentFileLines = getAllLinesFromFile(currentFileContents)
  const targetLine = currentFileLines[item.line]
  if (!targetLine || !targetLine.includes(expectedOriginalText)) return false
  const updated = setTodoTextAtLine(currentFileLines, item.line, text.trim())
  await app.vault.modify(file, updated)
  item.todoText = text.trim()
  item.originalText = text.trim()
  item.priority = parsePriority(text)
  return true
}

export const setTodoItemTag = async (
  item: TodoItem,
  tag: string,
  app: App,
  expectedOriginalText = item.originalText,
): Promise<boolean> => {
  const file = getFileFromPath(app.vault, item.filePath)
  if (!file) return false
  const currentFileContents = await app.vault.read(file)
  const currentFileLines = getAllLinesFromFile(currentFileContents)
  const targetLine = currentFileLines[item.line]
  if (!targetLine || !targetLine.includes(expectedOriginalText)) return false
  const updated = setTodoTagAtLine(currentFileLines, item.line, tag)
  await app.vault.modify(file, updated)
  const nextText = appendTagToText(item.originalText, tag)
  item.todoText = nextText
  item.originalText = nextText
  item.priority = parsePriority(nextText)
  return true
}

export const hideTodoItem = async (
  item: TodoItem,
  app: App,
  expectedOriginalText = item.originalText,
): Promise<boolean> => {
  const file = getFileFromPath(app.vault, item.filePath)
  if (!file) return false
  const currentFileContents = await app.vault.read(file)
  const currentFileLines = getAllLinesFromFile(currentFileContents)
  const targetLine = currentFileLines[item.line]
  if (!targetLine || !targetLine.includes(expectedOriginalText)) return false
  const updated = hideTodoAtLine(currentFileLines, item.line)
  await app.vault.modify(file, updated)
  return true
}

export const moveTodoItemToToday = async (
  item: TodoItem,
  app: App,
  expectedOriginalText = item.originalText,
): Promise<{filePath: string; displayDateTs: number} | false> => {
  const sourceFile = getFileFromPath(app.vault, item.filePath)
  if (!sourceFile) return false
  const sourceContents = await app.vault.read(sourceFile)
  const sourceLines = getAllLinesFromFile(sourceContents)
  const sourceLine = sourceLines[item.line]
  if (!sourceLine || !sourceLine.includes(expectedOriginalText)) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayPath = `${formatLocalDate(today)}.md`
  let todayFile = getFileFromPath(app.vault, todayPath)
  if (!todayFile) todayFile = await app.vault.create(todayPath, '')

  sourceLines[item.line] = moveTodoAtLineToBullet(
    sourceLine,
    getFileLabelFromName(todayFile.name) ?? todayFile.name,
  )
  await app.vault.modify(sourceFile, combineFileLines(sourceLines))
  await app.vault.append(todayFile, `${sourceLine}\n`)

  return {filePath: todayPath, displayDateTs: today.getTime()}
}

export const createTodoInTodayNote = async (app: App, text: string) => {
  const todoText = text.trim()
  if (!todoText) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayPath = `${formatLocalDate(today)}.md`
  const todoLine = `- [ ] ${todoText}`
  const todayFile = getFileFromPath(app.vault, todayPath)

  if (!todayFile) {
    await app.vault.create(todayPath, `${todoLine}\n`)
    return {filePath: todayPath, displayDateTs: today.getTime()}
  }

  const existing = await app.vault.read(todayFile)
  const separator = existing.length && !existing.endsWith('\n') ? '\n' : ''
  await app.vault.modify(todayFile, `${existing}${separator}${todoLine}\n`)
  return {filePath: todayPath, displayDateTs: today.getTime()}
}

type CreateTodoSuggestion =
  | {type: 'link'; value: string; display: string; hint: string}
  | {type: 'tag'; value: string; display: string; hint: string}

class CreateTodoInputSuggest extends (Obsidian as any).AbstractInputSuggest<CreateTodoSuggestion> {
  private files: string[]
  private tags: string[]

  constructor(
    app: App,
    private inputEl: HTMLInputElement,
    files: TFile[],
    tags: string[],
  ) {
    super(app, inputEl)
    this.files = files
      .map(file => app.metadataCache.fileToLinktext(file, ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    this.tags = tags
  }

  protected getSuggestions(query: string) {
    const cursor = this.inputEl.selectionStart ?? query.length
    const beforeCursor = query.slice(0, cursor)
    const match = beforeCursor.match(/(?:^|\s)(\[\[[^\s\[]*|\#[^\s#]*)$/)
    if (!match) return []
    const token = match[1]
    if (token.startsWith('[[')) {
      const needle = token.slice(2).toLowerCase()
      return this.files
        .filter(file => file.toLowerCase().includes(needle))
        .slice(0, 10)
        .map(file => ({
          type: 'link' as const,
          value: file,
          display: `[[${file}]]`,
          hint: 'Note',
        }))
    }
    const needle = token.slice(1).toLowerCase()
    return this.tags
      .filter(tag => tag.toLowerCase().includes(needle))
      .slice(0, 10)
      .map(tag => ({
        type: 'tag' as const,
        value: tag,
        display: `#${tag}`,
        hint: 'Tag',
      }))
  }

  renderSuggestion(value: CreateTodoSuggestion, el: HTMLElement) {
    const row = el.createDiv({cls: 'create-todo-suggestion'})
    row.createSpan({text: value.display, cls: 'create-todo-suggestion-value'})
    row.createSpan({text: value.hint, cls: 'create-todo-suggestion-hint'})
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.justifyContent = 'space-between'
    row.style.gap = '12px'
  }

  selectSuggestion(value: CreateTodoSuggestion, evt: MouseEvent | KeyboardEvent) {
    const cursor = this.inputEl.selectionStart ?? this.inputEl.value.length
    const beforeCursor = this.inputEl.value.slice(0, cursor)
    const afterCursor = this.inputEl.value.slice(cursor)
    const match = beforeCursor.match(/(?:^|\s)(\[\[[^\s\[]*|\#[^\s#]*)$/)
    const start = match ? cursor - match[1].length : cursor
    const inserted = value.type === 'link' ? `[[${value.value}]]` : `#${value.value}`
    const trailingSpace = value.type === 'tag' ? ' ' : ''
    this.setValue(`${this.inputEl.value.slice(0, start)}${inserted}${trailingSpace}${afterCursor}`)
    const caret = start + inserted.length + trailingSpace.length
    queueMicrotask(() => {
      this.inputEl.setSelectionRange(caret, caret)
      this.inputEl.focus()
    })
    this.close()
  }
}

export class CreateTodoModal extends Modal {
  private inputComponent: TextComponent | null = null
  private suggest: CreateTodoInputSuggest | null = null
  private createButton: HTMLButtonElement | null = null

  constructor(
    app: App,
    private onCreate: (text: string) => Promise<void>,
  ) {
    super(app)
  }

  onOpen() {
    this.titleEl.setText('Create todo')
    const wrapper = this.contentEl.createDiv({cls: 'create-todo-modal'})
    const inputWrap = wrapper.createDiv({cls: 'create-todo-input-wrap'})
    this.inputComponent = new TextComponent(inputWrap)
    this.inputComponent.setPlaceholder('Todo text')
    this.inputComponent.inputEl.addClass('create-todo-input')
    wrapper.style.display = 'flex'
    wrapper.style.flexDirection = 'column'
    wrapper.style.gap = '10px'
    inputWrap.style.padding = '8px 10px'
    inputWrap.style.border = '1px solid var(--background-modifier-border)'
    inputWrap.style.borderRadius = '8px'
    inputWrap.style.background = 'var(--background-primary)'
    this.inputComponent.inputEl.style.width = '100%'
    this.inputComponent.inputEl.style.border = 'none'
    this.inputComponent.inputEl.style.background = 'transparent'
    this.inputComponent.inputEl.style.boxShadow = 'none'
    this.inputComponent.inputEl.style.padding = '0'
    const actions = wrapper.createDiv({cls: 'create-todo-actions'})
    actions.style.display = 'flex'
    actions.style.gap = '8px'
    actions.style.justifyContent = 'flex-end'
    this.createButton = actions.createEl('button', {
      text: 'Create',
      cls: 'create-todo-create',
    })
    const cancelButton = actions.createEl('button', {
      text: 'Cancel',
      cls: 'create-todo-cancel',
    })
    this.createButton.style.alignSelf = 'flex-end'
    this.createButton.style.padding = '0 14px'
    this.createButton.style.height = '30px'
    this.createButton.style.borderRadius = '8px'
    this.createButton.style.border = '1px solid var(--background-modifier-border)'
    this.createButton.style.background = 'var(--interactive-accent)'
    this.createButton.style.color = 'var(--text-on-accent)'
    this.createButton.style.boxShadow = 'none'
    cancelButton.style.padding = '0 14px'
    cancelButton.style.height = '30px'
    cancelButton.style.borderRadius = '8px'
    cancelButton.style.border = '1px solid var(--background-modifier-border)'
    cancelButton.style.background = 'var(--background-primary)'
    cancelButton.style.boxShadow = 'none'
    const hint = wrapper.createDiv({cls: 'create-todo-hint'})
    hint.setText('Type [[ for notes or # for tags.')
    hint.style.color = 'var(--text-faint)'
    hint.style.fontSize = '12px'

    this.suggest = new CreateTodoInputSuggest(
      this.app,
      this.inputComponent.inputEl,
      this.app.vault.getMarkdownFiles(),
      this.collectTags(),
    )
    this.suggest.onSelect((value, evt) => {
      // selection is handled in selectSuggestion
    })

    const submit = async () => {
      const text = this.inputComponent?.getValue() ?? ''
      if (!text.trim()) return
      await this.onCreate(text)
      this.close()
    }

    this.inputComponent.inputEl.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault()
        void submit()
      }
      if (ev.key === 'Escape') {
        ev.preventDefault()
        this.close()
      }
    })
    this.inputComponent.onChange(() => {
      if (this.createButton) this.createButton.disabled = !this.inputComponent?.getValue().trim()
    })
    this.createButton.disabled = true
    this.createButton.addEventListener('click', () => void submit())
    cancelButton.addEventListener('click', () => this.close())
    queueMicrotask(() => this.inputComponent?.inputEl.focus())
  }

  onClose() {
    this.suggest?.close()
    this.contentEl.empty()
    this.inputComponent = null
    this.suggest = null
    this.createButton = null
  }

  private collectTags() {
    const tags = new Set<string>()
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file)
      if (!cache) continue
      for (const tag of getAllTagsFromMetadata(cache)) {
        const normalized = tag.replace(/^#/, '').trim()
        if (normalized) tags.add(normalized)
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  }
}

const findAllTodosInFile = (file: FileInfo): TodoItem[] => {
  if (!file.parseEntireFile)
    return file.validTags.flatMap(tag => findAllTodosFromTagBlock(file, tag))

  if (!file.content) return []
  const fileLines = getAllLinesFromFile(file.content)
  const links = []
  if (file.cache?.links) {
    links.push(...file.cache.links)
  }
  if (file.cache?.embeds) {
    links.push(...file.cache.embeds)
  }
  const tagMeta = file.frontmatterTag
    ? getTagMeta(file.frontmatterTag)
    : undefined

  const todos: TodoItem[] = []
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i]
    if (line.length === 0) continue
    if (lineIsValidTodo(line)) {
      todos.push(formTodo(line, file, links, i, tagMeta))
    }
  }

  return todos
}

const findAllTodosFromTagBlock = (file: FileInfo, tag: TagCache) => {
  const fileContents = file.content
  const links = []
  if (file.cache?.links) {
    links.push(...file.cache.links)
  }
  if (file.cache?.embeds) {
    links.push(...file.cache.embeds)
  }
  if (!fileContents) return []
  const fileLines = getAllLinesFromFile(fileContents)
  const tagMeta = getTagMeta(tag.tag)
  const tagLine = fileLines[tag.position.start.line]
  if (lineIsValidTodo(tagLine)) {
    return [formTodo(tagLine, file, links, tag.position.start.line, tagMeta)]
  }

  const todos: TodoItem[] = []
  for (let i = tag.position.start.line; i < fileLines.length; i++) {
    const line = fileLines[i]
    if (i === tag.position.start.line + 1 && line.length === 0) continue
    if (line.length === 0) break
    if (lineIsValidTodo(line)) {
      todos.push(formTodo(line, file, links, i, tagMeta))
    }
  }

  return todos
}

const formTodo = (
  line: string,
  file: FileInfo,
  links: LinkCache[],
  lineNum: number,
  tagMeta?: TagMeta,
): TodoItem => {
  const relevantLinks = links
    .filter(link => link.position.start.line === lineNum)
    .map(link => ({filePath: link.link, linkName: link.displayText}))
  const linkMap = mapLinkMeta(relevantLinks)
  const rawText = extractTextFromTodoLine(line)
  const spacesIndented = getIndentationSpacesFromTodoLine(line)
  const tagStripped = removeTagFromText(rawText, tagMeta?.main)
  const todoText = rawText
  const displayDateTs = getDateTsFromFileName(file.file.name) ?? file.file.stat.ctime
  const md = new MD()
    .use(commentPlugin)
    .use(linkPlugin(linkMap))
    .use(tagPlugin)
    .use(highlightPlugin)
  return {
    mainTag: tagMeta?.main,
    subTag: tagMeta?.sub,
    checked: todoLineIsChecked(line),
    priority: parsePriority(rawText),
    filePath: file.file.path,
    fileName: file.file.name,
    fileLabel: getFileLabelFromName(file.file.name),
    fileCreatedTs: file.file.stat.ctime,
    fileModifiedTs: file.file.stat.mtime,
    displayDateTs,
    rawHTML: md.render(tagStripped),
    todoText,
    line: lineNum,
    spacesIndented,
    fileInfo: file,
    originalText: rawText,
  }
}

const getDateTsFromFileName = (fileName: string): number | undefined => {
  const fileLabel = getFileLabelFromName(fileName) ?? fileName
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:\s|$)/.exec(fileLabel)
  if (!match) return undefined
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  )
    return undefined
  return date.getTime()
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const setTodoPriorityAtLine = (
  fileLines: string[],
  line: number,
  priority: Priority,
) => {
  const target = fileLines[line]
  const match = target.match(/^((\s|\>)*([\-\*]|[0-9]+\.)\s\[[^\]]+\]\s{1,4})(.*)$/)
  if (!match) return combineFileLines(fileLines)

  const prefix = match[1]
  const body = match[4]
  const withoutPriority = stripPriorityFromText(body)
  const priorityStr = priority === 'none' ? '' : ` ${PRIORITY_EMOJI[priority]}`
  fileLines[line] = `${prefix}${withoutPriority}${priorityStr}`.trimEnd()
  return combineFileLines(fileLines)
}

const setTodoTextAtLine = (fileLines: string[], line: number, text: string) => {
  const target = fileLines[line]
  const match = target.match(/^((\s|\>)*([\-\*]|[0-9]+\.)\s\[[^\]]+\]\s{1,4})(.*)$/)
  if (!match) return combineFileLines(fileLines)

  const prefix = match[1]
  fileLines[line] = `${prefix}${text}`.trimEnd()
  return combineFileLines(fileLines)
}

const setTodoTagAtLine = (fileLines: string[], line: number, tag: string) => {
  const target = fileLines[line]
  const match = target.match(/^((\s|\>)*([\-\*]|[0-9]+\.)\s\[[^\]]+\]\s{1,4})(.*)$/)
  if (!match) return combineFileLines(fileLines)

  const prefix = match[1]
  const nextText = appendTagToText(match[4], tag)
  fileLines[line] = `${prefix}${nextText}`.trimEnd()
  return combineFileLines(fileLines)
}

const moveTodoAtLineToBullet = (line: string, movedToLabel: string) => {
  const match = line.match(/^((\s|\>)*([\-\*]|[0-9]+\.)\s)\[[^\]]+\]\s{1,4}(.*)$/)
  if (!match) return line

  const prefix = match[1]
  const body = stripTrailingDoneDate(stripPriorityFromText(match[4]).trimEnd())
  const movedText = `(moved to note -> [[${movedToLabel}]])`
  return `${prefix}${body ? `${body} ` : ''}${movedText}`.trimEnd()
}

const hideTodoAtLine = (fileLines: string[], line: number) => {
  const target = fileLines[line]
  const match = target.match(/^((\s|\>)*([\-\*]|[0-9]+\.)\s)\[[^\]]+\]\s{1,4}(.*)$/)
  if (!match) return combineFileLines(fileLines)

  const prefix = match[1]
  const body = match[4]
  fileLines[line] = `${prefix}${body}`.trimEnd()
  return combineFileLines(fileLines)
}


/** Returns [start, end] inclusive indices of the checklist block containing the given line. */
const getChecklistBlockBounds = (
  fileLines: string[],
  line: number,
): [number, number] => {
  if (!lineIsValidTodo(fileLines[line])) return [line, line]
  let start = line
  let end = line
  while (start > 0 && lineIsValidTodo(fileLines[start - 1])) start--
  while (end < fileLines.length - 1 && lineIsValidTodo(fileLines[end + 1]))
    end++
  return [start, end]
}

const setTodoStatusAtLineTo = (
  fileLines: string[],
  line: number,
  setTo: boolean,
): string => {
  const newLineContent = setLineTo(fileLines[line], setTo)
  fileLines[line] = newLineContent

  if (setTo) {
    const [, blockEnd] = getChecklistBlockBounds(fileLines, line)
    if (line < blockEnd) {
      fileLines.splice(line, 1)
      fileLines.splice(blockEnd - 1, 0, newLineContent)
    }
  }

  return combineFileLines(fileLines)
}
