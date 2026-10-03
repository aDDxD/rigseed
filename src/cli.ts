#!/usr/bin/env node
import { Command } from 'commander';
import { metadata } from './config/package.js';
import { CancelledError } from './config/wizard.js';
import { run, type Options } from './commands/run.js';
const cli = new Command().name('rigseed').addHelpCommand(false).description('Reproducible Codex CLI configuration').version(metadata.version);
for (const name of ['setup', 'init', 'doctor', 'update', 'diff', 'uninstall']) {
  const cmd = cli.command(name).description({ setup: 'Configure global Codex', init: 'Bootstrap the current Git project', doctor: 'Check actual installed configuration', update: 'Update registered global and current project targets', diff: 'Show managed differences without writing', uninstall: 'Remove only owned configuration' }[name]!);
  if (['setup', 'init', 'update', 'uninstall'].includes(name)) cmd.option('--dry-run', 'Preview without modifying configuration').option('-y, --yes', 'Apply without prompting; never override conflicts');
  if (['setup', 'init', 'update'].includes(name)) cmd.option('--config <path>', 'Read model choices from a declarative JSON file');
  if (['setup', 'init'].includes(name)) cmd.option('--interactive', 'Choose models and reasoning in a terminal');
  if (name === 'init') cmd.option('--portable', 'Include project-local config and agents');
  if (['setup', 'init'].includes(name)) cmd.option('--preset <name>', 'Preset (only default is available)', 'default');
  if (['doctor', 'update', 'diff', 'uninstall'].includes(name)) cmd.option('--global', 'Only global target').option('--project', 'Only current project target');
  cmd.action(async (options: Options) => run(name, options));
}
try { await cli.parseAsync(); }
catch (error) {
  if (error instanceof CancelledError) console.log(error.message);
  else { console.error(`✗ ${(error as Error).message}`); process.exitCode = 1; }
}
