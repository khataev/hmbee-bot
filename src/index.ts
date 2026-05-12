import { Command } from 'commander';
import { TochkaAdapter } from './adapters/tochka.js';
import type { SourceAdapter } from './adapters/types.js';
import { loadEnv, validateTochkaEnv } from './env.js';
import { writeOutput } from './output.js';
import { loadSyncFiles } from './preview/loader.js';
import { normalizeTochkaRecord } from './preview/tochka.js';

loadEnv();

const program = new Command();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

program
  .name('hmbee-bot')
  .description('HM Bee Bot CLI for source synchronization and Honey Money integration')
  .version('0.1.0');

program
  .command('list')
  .description('List supported data sources')
  .action(() => {
    console.log('Supported data sources:');
    console.log('- tochka');
  });

program
  .command('sync')
  .description('Synchronize data from a source')
  .argument('<source>', 'Source name (e.g., tochka)')
  .requiredOption('--from <date>', 'From date (YYYY-MM-DD)')
  .requiredOption('--to <date>', 'To date (YYYY-MM-DD)')
  .option('--format <type>', 'Output format (adapted|raw)', 'adapted')
  .option('--quiet', 'Suppress informational output')
  .option('--stdout', 'Write output to stdout instead of file')
  .action(async (source, options) => {
    const isQuiet = options.quiet;
    const writeToStdout = options.stdout;
    let adapter: SourceAdapter;
    if (source === 'tochka') {
      try {
        validateTochkaEnv();
        adapter = new TochkaAdapter();
      } catch (error: unknown) {
        console.error(getErrorMessage(error));
        process.exit(1);
      }
    } else {
      console.error(`Unsupported source: ${source}`);
      process.exit(1);
    }

    if (!isQuiet) console.log(`Syncing from ${source}...`);
    try {
      const result = await adapter.sync({ from: options.from, to: options.to });

      const outputData = options.format === 'raw' ? result.raw : result.records;
      const outputPath = writeToStdout ? undefined : `sync/${source}/${options.from}_${options.to}.json`;
      writeOutput(outputData, outputPath);

      if (!isQuiet) console.log(`✓ Sync complete. Fetched ${result.records.length} records.`);
    } catch (error: unknown) {
      console.error(`Sync failed: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Process synchronized data for a source')
  .argument('<source>', 'Source name (e.g., tochka)')
  .option('--preview', 'Preview normalized records without writing to Honey Money')
  .option('--quiet', 'Suppress informational output')
  .action(async (source, options) => {
    const isQuiet = options.quiet;

    if (source !== 'tochka') {
      console.error(`Unsupported source: ${source}`);
      process.exit(1);
    }

    if (!options.preview) {
      console.error('Only --preview mode is supported currently.');
      process.exit(1);
    }

    try {
      const records = await loadSyncFiles(source);
      if (!isQuiet) {
        console.error(`Applying ${source} with preview...`);
        console.error(`Loaded ${records.length} records from sync/${source}`);
      }

      const previewRecords = records.map((r) => normalizeTochkaRecord(r));
      writeOutput(previewRecords);

      if (!isQuiet) console.error(`✓ Preview complete. Processed ${previewRecords.length} records.`);
    } catch (error: unknown) {
      console.error(`Apply failed: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
