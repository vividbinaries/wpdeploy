#!/usr/bin/env node

import consola from 'consola'
import dotenv from 'dotenv'
import fs from 'fs-extra'
import { NodeSSH } from 'node-ssh'
import { tmpdir } from 'os'
import { resolve } from 'path'
import pc from 'picocolors'

/*
|--------------------------------------------------------------------------
| Init
|--------------------------------------------------------------------------
|
*/
dotenv.config()

const source = new NodeSSH()
const target = new NodeSSH()
const sourceWp = process.env.SOURCE_WP
const targetWp = process.env.TARGET_WP
const time = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .replace('T', '-')
  .replace(/:/g, '-')
  .slice(0, -5)

/*
|--------------------------------------------------------------------------
| Connect
|--------------------------------------------------------------------------
|
*/
consola.info(`Connecting to source server ${pc.cyan(process.env.SOURCE_HOST)}...`)

await source.connect({
  host: process.env.SOURCE_HOST,
  port: +process.env.SOURCE_PORT!,
  username: process.env.SOURCE_USER,
  privateKey: process.env.SOURCE_PRIVATE_KEY,
  readyTimeout: 10000,
  keepaliveInterval: 10000,
})

consola.success('Connected!')
console.log()
consola.info(`Connecting to target server ${pc.cyan(process.env.TARGET_HOST)}...`)

await target.connect({
  host: process.env.TARGET_HOST,
  port: +process.env.TARGET_PORT!,
  username: process.env.TARGET_USER,
  privateKey: process.env.TARGET_PRIVATE_KEY,
  readyTimeout: 10000,
  keepaliveInterval: 10000,
})

consola.success('Connected!')
console.clear()

/*
|--------------------------------------------------------------------------
| Prompt
|--------------------------------------------------------------------------
|
*/
const deploy = (await consola.prompt('Deploy:', {
  type: 'select',
  options: [
    { label: 'Theme', value: 'theme' },
    { label: 'Theme and Plugins', value: 'themePlugins' },
  ],
})) as unknown as 'theme' | 'themePlugins'

console.clear()

/*
|--------------------------------------------------------------------------
| Prepare theme
|--------------------------------------------------------------------------
|
*/
consola.info('Preparing theme...')

const firstItem = await source.execCommand('ls -AU | head -1', { cwd: `${sourceWp}/wp-content/themes` })
const themeName = firstItem.stdout.split('.')[0]

await source.execCommand(`rm ${sourceWp}/wp-content/themes/${themeName}.zip`)
await target.execCommand(`rm ${targetWp}/wp-content/themes/${themeName}.zip`)

await Promise.all([
  source.execCommand(`zip ${themeName}.zip -r ${themeName}`, { cwd: `${sourceWp}/wp-content/themes` }),
  target.execCommand(`zip ${themeName}.zip -r ${themeName}`, { cwd: `${targetWp}/wp-content/themes` }),
])

fs.ensureDirSync(resolve(process.cwd(), 'backup', 'theme'))
fs.ensureDirSync(resolve(process.cwd(), 'backup', 'plugins'))
fs.ensureDirSync(resolve(tmpdir(), 'vbwpdeploy'))

await Promise.all([
  source.getFile(
    resolve(tmpdir(), 'vbwpdeploy', `${themeName}-${time}.zip`),
    `${sourceWp}/wp-content/themes/${themeName}.zip`,
  ),
  target.getFile(
    resolve(process.cwd(), 'backup', 'theme', `${themeName}-${time}.zip`),
    `${targetWp}/wp-content/themes/${themeName}.zip`,
  ),
])

consola.success('Created', pc.cyan(`wp-content/themes/${themeName}.zip`))

/*
|--------------------------------------------------------------------------
| Prepare plugins
|--------------------------------------------------------------------------
|
*/
if (deploy === 'themePlugins') {
  console.log()
  consola.info('Preparing plugins...')

  await source.execCommand(`rm ${sourceWp}/wp-content/plugins.zip`)
  await target.execCommand(`rm ${targetWp}/wp-content/plugins.zip`)

  await Promise.all([
    source.execCommand('zip plugins.zip -r plugins', { cwd: `${sourceWp}/wp-content` }),
    target.execCommand('zip plugins.zip -r plugins', { cwd: `${targetWp}/wp-content` }),
  ])

  await Promise.all([
    source.getFile(resolve(tmpdir(), 'vbwpdeploy', `plugins-${time}.zip`), `${sourceWp}/wp-content/plugins.zip`),
    target.getFile(
      resolve(process.cwd(), 'backup', 'plugins', `plugins-${time}.zip`),
      `${targetWp}/wp-content/plugins.zip`,
    ),
  ])

  consola.success('Created', pc.cyan('wp-content/plugins.zip'))
}

console.log()

/*
|--------------------------------------------------------------------------
| Deploy
|--------------------------------------------------------------------------
|
*/
consola.info('Deploying...')

await target.putFile(
  resolve(tmpdir(), 'vbwpdeploy', `${themeName}-${time}.zip`),
  `${targetWp}/wp-content/themes/${themeName}.zip`,
)

if (deploy === 'themePlugins') {
  await target.putFile(resolve(tmpdir(), 'vbwpdeploy', `plugins-${time}.zip`), `${targetWp}/wp-content/plugins.zip`)
}

await target.execCommand(`touch ${targetWp}/.maintenance`)

await target.execCommand(`rm -r ${targetWp}/wp-content/themes/${themeName}`)

if (deploy === 'themePlugins') {
  await target.execCommand(`rm -r ${targetWp}/wp-content/plugins`)
}

await target.execCommand(`unzip ${themeName}.zip`, { cwd: `${targetWp}/wp-content/themes` })

if (deploy === 'themePlugins') {
  await target.execCommand('unzip plugins.zip', { cwd: `${targetWp}/wp-content` })
}

await target.execCommand(`chown www-data:www-data -R ${targetWp}/wp-content/*`)
await target.execCommand('find . -type d -exec chmod 755 {} ;', { cwd: `${targetWp}/wp-content` })
await target.execCommand('find . -type f -exec chmod 644 {} ;', { cwd: `${targetWp}/wp-content` })

consola.success('Done!')
console.log()

/*
|--------------------------------------------------------------------------
| Clean up
|--------------------------------------------------------------------------
|
*/
consola.info('Cleaning up...')

await target.execCommand(`rm ${targetWp}/.maintenance`)
await target.execCommand(`rm ${targetWp}/wp-content/themes/${themeName}.zip`)
await target.execCommand(`rm ${targetWp}/wp-content/plugins.zip`)
await source.execCommand(`rm ${sourceWp}/wp-content/themes/${themeName}.zip`)
await source.execCommand(`rm ${sourceWp}/wp-content/plugins.zip`)

fs.removeSync(resolve(tmpdir(), 'vbwpdeploy', `${themeName}-${time}.zip`))
fs.removeSync(resolve(tmpdir(), 'vbwpdeploy', `plugins-${time}.zip`))

consola.success('All done!')
console.log()

source.dispose()
target.dispose()
