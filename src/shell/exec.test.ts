import { createMockActionContext } from '@backstage/plugin-scaffolder-node-test-utils';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { shellExec } from './exec';

describe('shell:exec', () => {
    const action = shellExec();
    let workspacePath: string;

    beforeEach(() => {
        workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-exec-'));
    });

    afterEach(() => {
        fs.rmSync(workspacePath, { recursive: true, force: true });
    });

    const run = (input: { command: string; args?: string[]; cwd?: string }) => {
        const ctx = createMockActionContext({ input, workspacePath });
        return { ctx, result: action.handler(ctx as any) };
    };

    it('runs the command in the workspace and outputs stdout and exit code', async () => {
        const { ctx, result } = run({ command: 'pwd' });
        await result;

        expect(ctx.output).toHaveBeenCalledWith('stdout', `${fs.realpathSync(workspacePath)}\n`);
        expect(ctx.output).toHaveBeenCalledWith('exitCode', 0);
    });

    it('supports shell syntax when no args are given', async () => {
        const { ctx, result } = run({ command: 'echo hello | tr a-z A-Z && echo done' });
        await result;

        expect(ctx.output).toHaveBeenCalledWith('stdout', 'HELLO\ndone\n');
    });

    it('passes args literally instead of through the shell', async () => {
        const { ctx, result } = run({
            command: 'printf',
            args: ['%s|', 'two words', 'x; touch pwned', '$(touch pwned2)'],
        });
        await result;

        expect(ctx.output).toHaveBeenCalledWith('stdout', 'two words|x; touch pwned|$(touch pwned2)|');
        expect(fs.existsSync(path.join(workspacePath, 'pwned'))).toBe(false);
        expect(fs.existsSync(path.join(workspacePath, 'pwned2'))).toBe(false);
    });

    it('captures EXEC_SHELL_OUTPUT_VALUE from the middle of the output', async () => {
        const { ctx, result } = run({
            command: 'echo before; echo "EXEC_SHELL_OUTPUT_VALUE= https://x.test/a=b "; echo after',
        });
        await result;

        expect(ctx.output).toHaveBeenCalledWith('value', 'https://x.test/a=b');
    });

    it('does not output value when the marker is absent or only appears mid-line', async () => {
        const { ctx, result } = run({ command: 'echo "not EXEC_SHELL_OUTPUT_VALUE=x"' });
        await result;

        expect(ctx.output).not.toHaveBeenCalledWith('value', expect.anything());
    });

    it('fails on a non-zero exit code', async () => {
        const { ctx, result } = run({ command: 'echo boom >&2; exit 3' });

        await expect(result).rejects.toThrow('Command exited with code 3');
        expect(ctx.output).not.toHaveBeenCalled();
    });

    it('fails when the process is killed by a signal', async () => {
        const { ctx, result } = run({ command: 'kill -9 $$' });

        await expect(result).rejects.toThrow('Command was killed by signal SIGKILL');
        expect(ctx.output).not.toHaveBeenCalled();
    });

    it('fails when the command does not exist', async () => {
        const { result } = run({ command: 'definitely-not-a-command-xyz', args: [] });

        await expect(result).rejects.toThrow(/ENOENT/);
    });

    it('resolves a relative cwd against the workspace', async () => {
        fs.mkdirSync(path.join(workspacePath, 'app'));
        const { ctx, result } = run({ command: 'pwd', cwd: './app' });
        await result;

        expect(ctx.output).toHaveBeenCalledWith('stdout', `${fs.realpathSync(path.join(workspacePath, 'app'))}\n`);
    });

    it('keeps an absolute cwd as is', async () => {
        const { ctx, result } = run({ command: 'pwd', cwd: os.tmpdir() });
        await result;

        expect(ctx.output).toHaveBeenCalledWith('stdout', `${fs.realpathSync(os.tmpdir())}\n`);
    });
});
