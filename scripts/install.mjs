import fs from 'fs'
import path from 'path'
import process from 'process'

const ROOT = process.cwd()
const PLUGIN_ID = 'obsidian-checklist-plugin'
const BUILD_FILES = ['main.js', 'manifest.json', 'styles.css']

const readEnvFile = filePath => {
  if (!fs.existsSync(filePath)) return {}
  const contents = fs.readFileSync(filePath, 'utf8')
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    value = value.replace(/^['"]|['"]$/g, '')
    out[key] = value
  }
  return out
}

const resolveVaultPath = () => {
  if (process.env.OBSIDIAN_VAULT_PATH) return process.env.OBSIDIAN_VAULT_PATH

  const localEnvPath = path.join(ROOT, '.env')
  const localEnv = readEnvFile(localEnvPath)
  if (localEnv.OBSIDIAN_VAULT_PATH) return localEnv.OBSIDIAN_VAULT_PATH

  const siblingEnvPath = path.resolve(ROOT, '..', 'obsidian-graph-tools', '.env')
  const siblingEnv = readEnvFile(siblingEnvPath)
  if (siblingEnv.OBSIDIAN_VAULT_PATH) return siblingEnv.OBSIDIAN_VAULT_PATH

  return ''
}

const ensureBuildFilesExist = () => {
  const missing = BUILD_FILES.filter(file => !fs.existsSync(path.join(ROOT, file)))
  if (missing.length) {
    throw new Error(`Missing build files: ${missing.join(', ')}. Run "npm run build" first.`)
  }
}

const install = () => {
  const vaultPath = resolveVaultPath()
  if (!vaultPath) {
    throw new Error(
      'OBSIDIAN_VAULT_PATH not found. Set it in env, in .env, or in ../obsidian-graph-tools/.env.',
    )
  }

  const destinationDir = path.join(
    vaultPath,
    '.obsidian',
    'plugins',
    PLUGIN_ID,
  )
  fs.mkdirSync(destinationDir, {recursive: true})

  for (const file of BUILD_FILES) {
    fs.copyFileSync(path.join(ROOT, file), path.join(destinationDir, file))
  }

  console.log(`Installed ${PLUGIN_ID} to ${destinationDir}`)
}

ensureBuildFilesExist()
install()
