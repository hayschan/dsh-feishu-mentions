import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rename, rm, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const dest = resolve(process.argv[2] || '.')
const version = JSON.parse(await readFile('package.json', 'utf8')).version
execFileSync(process.execPath, ['scripts/pack-public.mjs', dest], { stdio: 'inherit' })
const archive = join(dest, 'dsh-feishu-mentions-' + version + '.tgz')
await rename(join(dest, 'hayschan-dsh-feishu-mentions-' + version + '.tgz'), archive)
const dir = await mkdtemp(join(tmpdir(), 'dsh-feishu-test-'))
try {
  execFileSync('tar', ['-xzf', archive, '-C', dir])
  const cwd = join(dir, 'package')
  const name = '@hayschan/dsh-feishu-mentions'
  assert.equal(JSON.parse(await readFile(join(cwd, 'package.json'))).name, name)
  assert.ok((await readFile(join(cwd, 'cordis.patch.yml'), 'utf8')).includes(name))
  assert.ok((await readFile(join(cwd, 'client.js'), 'utf8')).startsWith("window.__ModuleLoader__.load({\n  id: '" + name + "'"))
  await copyFile('test.mjs', join(cwd, 'test.mjs'))
  execFileSync(process.execPath, ['--test', 'test.mjs'], { cwd, stdio: 'inherit' })
} finally {
  await rm(dir, { recursive: true, force: true })
}
