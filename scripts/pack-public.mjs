import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const dest = resolve(process.argv[2] || '.')
const staging = await mkdtemp(join(tmpdir(), 'dsh-feishu-pack-'))
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const local = manifest.name
manifest.name = '@hayschan/dsh-feishu-mentions'
delete manifest.private
manifest.publishConfig = { access: 'public' }
delete manifest.scripts
try {
  for (const path of [...manifest.files, 'README.md', 'LICENSE']) {
    await cp(path, join(staging, path), { recursive: true })
  }
  for (const path of ['client.js', 'cordis.patch.yml']) {
    const file = join(staging, path)
    const content = await readFile(file, 'utf8')
    if (!content.includes(local)) throw new Error('Missing development package ID in ' + path)
    await writeFile(file, content.replaceAll(local, manifest.name))
  }
  await writeFile(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  await mkdir(dest, { recursive: true })
  execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', dest], { cwd: staging, stdio: 'inherit' })
} finally {
  await rm(staging, { recursive: true, force: true })
}
