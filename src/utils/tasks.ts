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
  removeTagFromText,
  setLineTo,
  stripTrailingPriority,
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
    rawHTML: md.render(tagStripped),
    todoText,
    line: lineNum,
    spacesIndented,
    fileInfo: file,
    originalText: rawText,
  }
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
  const withoutPriority = stripTrailingPriority(body)
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
