import { Command } from 'commander';
import { TochkaAdapter } from './adapters/tochka.js';
import type { SourceAdapter } from './adapters/types.js';
import { filterApplyRecords, parseOnlyIdsOption, type ReadyApplyRecord } from './apply/index.js';
import { loadSyncFiles } from './apply/preview/loader.js';
import { normalizeTochkaRecord } from './apply/preview/tochka.js';
import type { HoneyMoneyTransaction, PreviewRecord } from './apply/preview/types.js';
import { loadConfig } from './config.js';
import { loadEnv, validateHoneyMoneyEnv, validateTochkaEnv } from './env.js';
import { HoneyMoneyClient } from './hmbee/client.js';
import { writeOutput } from './output.js';

loadEnv();

const program = new Command();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isReadyForApply(record: PreviewRecord): record is ReadyApplyRecord {
  return record.identified && record.save && record.normalized !== undefined && record.hmbee !== undefined;
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
  .option('--only-id <ids>', 'Only save the specified comma-separated source transaction ids')
  .option('--quiet', 'Suppress informational output')
  .action(async (source, options) => {
    const isQuiet = options.quiet;

    if (source !== 'tochka') {
      console.error(`Unsupported source: ${source}`);
      process.exit(1);
    }

    try {
      const config = loadConfig();
      const records = loadSyncFiles(source);
      const previewRecords = records.map((record) =>
        normalizeTochkaRecord(record, {
          accountMappings: config.sources.tochka.accountMappings,
          typeCodeRules: config.sources.tochka.typeCodes
        })
      );

      if (options.preview) {
        if (!isQuiet) {
          console.error(`Applying ${source} with preview...`);
          console.error(`Loaded ${records.length} records from sync/${source}`);
        }

        writeOutput(previewRecords);

        if (!isQuiet) console.error(`✓ Preview complete. Processed ${previewRecords.length} records.`);
        return;
      }

      const readyRecords = previewRecords.filter(isReadyForApply);
      const onlyIds = parseOnlyIdsOption(options.onlyId);
      const selectedRecords = filterApplyRecords(readyRecords, onlyIds);
      const missingAccountMappings = selectedRecords.filter((record) => record.hmbee.account_id === null);

      if (missingAccountMappings.length > 0) {
        const missingAccounts = [...new Set(missingAccountMappings.map((record) => record.normalized.account))].join(
          ', '
        );
        throw new Error(`Missing Honey Money account mapping for Tochka accounts: ${missingAccounts}`);
      }

      const hmEnv = validateHoneyMoneyEnv();
      const client = new HoneyMoneyClient(hmEnv);

      if (!isQuiet) {
        console.error(`Applying ${source} to Honey Money...`);
        console.error(`Loaded ${records.length} records from sync/${source}`);
        console.error(`Sending ${selectedRecords.length} identified income/expense records.`);
      }

      const createdTransactions = [] as Array<
        HoneyMoneyTransaction & { sourceTransactionId: string; honeyMoneyTransactionId: number }
      >;

      for (const record of selectedRecords) {
        const accountId = record.hmbee.account_id;
        if (accountId === null) {
          throw new Error(`Missing Honey Money account mapping for Tochka account ${record.normalized.account}`);
        }

        const honeyMoneyTransactionId = await client.createTransaction(record.hmbee);

        createdTransactions.push({
          sourceTransactionId: record.normalized.transactionId,
          honeyMoneyTransactionId,
          ...record.hmbee
        });
      }

      writeOutput(createdTransactions);

      if (!isQuiet) {
        const skippedCount = previewRecords.length - selectedRecords.length;
        console.error(
          `✓ Apply complete. Created ${createdTransactions.length} Honey Money transactions.` +
            (skippedCount > 0 ? ` Skipped ${skippedCount} unsupported records.` : '')
        );
      }
    } catch (error: unknown) {
      console.error(`Apply failed: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
