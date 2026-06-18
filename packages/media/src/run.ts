import { spawn } from 'node:child_process'

export interface RunResult {
  stdout: string
  stderr: string
}

export interface RunOptions {
  /** Hard timeout; the process is SIGKILLed if exceeded. */
  timeoutMs: number
  /** Called for each complete stdout line (used to parse ffmpeg `-progress`). */
  onStdoutLine?: (line: string) => void
}

/**
 * Runs a binary with array args (no shell → no injection, architecture §18),
 * capturing stdout/stderr with a hard timeout + kill (§16).
 */
export function run(bin: string, args: string[], opts: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, opts.timeoutMs)

    let lineBuf = ''
    child.stdout.on('data', (d) => {
      const text = d.toString()
      stdout += text
      if (!opts.onStdoutLine) return
      lineBuf += text
      let idx: number
      while ((idx = lineBuf.indexOf('\n')) !== -1) {
        opts.onStdoutLine(lineBuf.slice(0, idx))
        lineBuf = lineBuf.slice(idx + 1)
      }
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new Error(`${bin} timed out after ${opts.timeoutMs}ms`))
        return
      }
      if (code !== 0) {
        reject(new Error(`${bin} exited with code ${code}: ${stderr.slice(0, 500)}`))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}
