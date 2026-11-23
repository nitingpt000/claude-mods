// The rules Security Watch rates tool calls by. Pure: no engine, so the tests check
// them directly. A call that matches nothing is safe and isn't logged.
//
// risky:  can destroy work, leak a secret, or run code fetched from the internet.
// review: reaches the network, installs or publishes something, touches secrets or
//         files outside the project, or changes how tools and shells start.

export type Level = 'risky' | 'review'
export type Verdict = { level: Level; reason: string; label: string }

type Input = Record<string, unknown>

const str = (input: Input, key: string): string | undefined => {
  const v = input[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

// Hide anything that looks like a credential before it reaches the panel.
export function redact(s: string): string {
  return s
    .replace(/\b(sk-[A-Za-z0-9_-]{6,}|sk_live_[A-Za-z0-9]{6,}|gh[pousr]_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{12,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,})/g, '••••')
    .replace(/(bearer|token|authorization)(\s*[:=]?\s*)("?)[^\s"']{8,}/gi, '$1$2$3••••')
    .replace(/((?:password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*)("?)[^\s"']+/gi, '$1$2••••')
}

export function clip(s: string, max = 72): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.slice(-3).join('/') || p
}

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

export function isOutside(path: string, cwd: string | undefined): boolean {
  if (cwd === undefined || cwd === '') return false
  const p = norm(path)
  // A relative path is inside the project.
  if (!/^([a-z]:\/|\/|~)/.test(p)) return false
  const root = norm(cwd)
  return p !== root && !p.startsWith(`${root}/`)
}

// ---------- commands ----------

type Rule = { test: RegExp; level: Level; reason: string }

const COMMAND_RULES: Rule[] = [
  // Destroying work.
  { test: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\s+--force|-rf|-fr)\b/i, level: 'risky', reason: 'deletes files recursively and forcibly' },
  { test: /\bremove-item\b(?=.*-recurse)(?=.*-force)/i, level: 'risky', reason: 'deletes files recursively and forcibly' },
  { test: /\b(rd|rmdir)\s+\/s\b|\bdel\s+\/[sfq]/i, level: 'risky', reason: 'deletes files recursively' },
  { test: /\bgit\s+push\b.*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/i, level: 'risky', reason: 'force-pushes, rewriting remote history' },
  { test: /\bgit\s+reset\s+--hard\b/i, level: 'risky', reason: 'throws away uncommitted work' },
  { test: /\bgit\s+clean\s+-[a-z]*f/i, level: 'risky', reason: 'deletes untracked files' },
  { test: /\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/i, level: 'risky', reason: 'discards all local changes' },
  { test: /\bgit\s+branch\s+-D\b/, level: 'risky', reason: 'deletes a branch without checking it is merged' },
  { test: /\b(mkfs|diskpart|format\s+[a-z]:)|\bdd\s+if=/i, level: 'risky', reason: 'can wipe a disk' },
  { test: /\bdrop\s+(table|database|schema)\b|\btruncate\s+table\b/i, level: 'risky', reason: 'deletes database data' },
  // Running code from the internet.
  { test: /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|python3?|node|iex|invoke-expression)\b/i, level: 'risky', reason: 'runs a script downloaded from the internet' },
  { test: /\b(iex|invoke-expression)\b.*\b(downloadstring|iwr|irm|invoke-webrequest|invoke-restmethod)\b/i, level: 'risky', reason: 'runs a script downloaded from the internet' },
  // Weakening the machine.
  { test: /\bsudo\b|\brunas\b|start-process\b.*-verb\s+runas/i, level: 'risky', reason: 'runs with administrator rights' },
  { test: /\bchmod\s+(-R\s+)?(0?777|a\+rwx)\b/i, level: 'risky', reason: 'makes files writable by everyone' },
  { test: /set-mppreference\b.*-disable|\bnetsh\s+advfirewall\s+set\b.*off|\bset-executionpolicy\s+(bypass|unrestricted)/i, level: 'risky', reason: 'turns off a security protection' },
  { test: /\breg\s+(add|delete)\b|\b(set|new|remove)-itemproperty\b.*hk(lm|cu):/i, level: 'risky', reason: 'changes the Windows registry' },
  // Publishing.
  { test: /\b(npm|pnpm|yarn)\s+publish\b|\btwine\s+upload\b|\bcargo\s+publish\b|\bgem\s+push\b/i, level: 'risky', reason: 'publishes a package for everyone' },
  // Secrets on the command line.
  { test: /\b(cat|type|get-content|gc|less|more|head|tail)\b[^|;&]*(\.env\b|id_rsa|id_ed25519|\.pem\b|\.key\b|credentials|\.npmrc|\.netrc)/i, level: 'review', reason: 'prints a file that usually holds secrets' },
  { test: /^\s*(printenv|env|set|gci\s+env:|get-childitem\s+env:)\s*$/i, level: 'review', reason: 'prints every environment variable, secrets included' },
  // Network and packages.
  { test: /\bgit\s+push\b/i, level: 'review', reason: 'pushes to a remote' },
  { test: /\bgh\s+(repo\s+(create|delete|edit)|release\s+create|pr\s+(create|merge)|secret|gist\s+create)\b/i, level: 'review', reason: 'changes something on GitHub' },
  { test: /\b(npm|pnpm|yarn|bun)\s+(i|install|add)\b|\bnpx\s+\S|\bpip3?\s+install\b|\buv\s+(add|pip\s+install)\b|\bcargo\s+install\b|\bgo\s+install\b|\b(winget|choco|scoop|brew|apt(-get)?)\s+install\b/i, level: 'review', reason: 'installs a package' },
  { test: /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod|ssh|scp|sftp|rsync|ftp|nc|ncat|telnet)\b/i, level: 'review', reason: 'reaches the network' },
  { test: /\bdocker\s+(run|pull|push|exec|system\s+prune)\b/i, level: 'review', reason: 'runs or moves a container' },
  { test: /--no-verify\b/i, level: 'review', reason: 'skips git hooks' },
  { test: /\b(kill|pkill|killall|taskkill|stop-process)\b/i, level: 'review', reason: 'stops a running process' },
]

export function rateCommand(command: string): Verdict | undefined {
  for (const rule of COMMAND_RULES) {
    if (rule.test.test(command)) return { level: rule.level, reason: rule.reason, label: clip(redact(command)) }
  }
  return undefined
}

// ---------- files ----------

const SECRET_FILE = /(^|\/)(\.env(\.[^/]*)?|id_rsa|id_ed25519|id_ecdsa|[^/]*\.pem|[^/]*\.key|[^/]*\.p12|[^/]*\.pfx|credentials(\.json)?|\.npmrc|\.netrc|\.pypirc|service[-_]account[^/]*\.json)$|(^|\/)\.(ssh|aws|gnupg)\//i
const STARTUP_FILE = /(^|\/)(\.bashrc|\.zshrc|\.profile|\.bash_profile|microsoft\.powershell_profile\.ps1|profile\.ps1)$|(^|\/)\.git\/hooks\/|(^|\/)\.claude\/settings(\.local)?\.json$|(^|\/)\.husky\//i
const CI_FILE = /(^|\/)\.github\/workflows\/|(^|\/)\.gitlab-ci\.yml$|(^|\/)azure-pipelines\.yml$/i

// What a secret looks like inside written text. Only the kind is reported, never the value.
const SECRET_TEXT: [RegExp, string][] = [
  [/-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----/, 'a private key'],
  [/\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/, 'an API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/, 'a GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'a Google API key'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/\bsk_live_[A-Za-z0-9]{20,}/, 'a Stripe live key'],
]

export function secretIn(text: string): string | undefined {
  for (const [re, kind] of SECRET_TEXT) if (re.test(text)) return kind
  return undefined
}

const WRITES = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const READS = new Set(['Read', 'NotebookRead'])

export function rateFile(tool: string, input: Input, cwd: string | undefined): Verdict | undefined {
  const path = str(input, 'file_path') ?? str(input, 'notebook_path')
  if (path === undefined) return undefined
  const p = path.replace(/\\/g, '/')
  const label = shortPath(path)
  if (WRITES.has(tool)) {
    const written = [str(input, 'content'), str(input, 'new_string'), str(input, 'new_source')]
      .concat(Array.isArray(input.edits) ? (input.edits as Input[]).map(e => str(e, 'new_string')) : [])
      .filter((s): s is string => s !== undefined)
      .join('\n')
    const kind = secretIn(written)
    if (kind !== undefined) return { level: 'risky', reason: `writes what looks like ${kind}`, label }
    if (SECRET_FILE.test(p)) return { level: 'risky', reason: 'changes a file that holds secrets', label }
    if (STARTUP_FILE.test(p)) return { level: 'risky', reason: 'changes what runs when a shell, git or Claude Code starts', label }
    if (CI_FILE.test(p)) return { level: 'review', reason: 'changes a CI workflow', label }
    if (isOutside(path, cwd)) return { level: 'review', reason: 'writes outside the project folder', label }
    return undefined
  }
  if (READS.has(tool)) {
    if (SECRET_FILE.test(p)) return { level: 'review', reason: 'reads a file that usually holds secrets', label }
    if (isOutside(path, cwd)) return { level: 'review', reason: 'reads outside the project folder', label }
  }
  return undefined
}

// ---------- everything else ----------

const COMMAND_TOOLS = new Set(['Bash', 'PowerShell'])
const OUTWARD = /(^|_)(send|post|publish|delete|trash|share|forward|reply|upload|create|update|transfer|pay|merge|deploy|invite|remove)(_|$)/i

export function rate(tool: string, input: Input, cwd: string | undefined): Verdict | undefined {
  if (COMMAND_TOOLS.has(tool)) {
    const command = str(input, 'command')
    return command === undefined ? undefined : rateCommand(command)
  }
  if (WRITES.has(tool) || READS.has(tool)) return rateFile(tool, input, cwd)
  if (tool === 'WebFetch') {
    const url = str(input, 'url') ?? ''
    if (/^http:\/\//i.test(url)) return { level: 'review', reason: 'fetches a page over plain http', label: clip(redact(url)) }
    return undefined
  }
  // Connector tools that act on the outside world: sending, publishing, deleting.
  if (tool.startsWith('mcp__')) {
    const [, server = '', name = tool] = tool.split('__')
    if (OUTWARD.test(name)) {
      const where = /^[0-9a-f-]{20,}$/.test(server) ? 'a connector' : server
      return { level: 'review', reason: `acts through ${where}: ${name.replace(/[_-]+/g, ' ')}`, label: name }
    }
  }
  return undefined
}
