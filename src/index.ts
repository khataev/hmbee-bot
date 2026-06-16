import { statSync } from 'node:fs';
import { Command } from 'commander';
import { TochkaAdapter } from 'src/adapters/tochka.js';
import type { SourceAdapter } from 'src/adapters/types.js';
import { filterApplyRecords, parseOnlyIdsOption, type ReadyApplyRecord } from 'src/apply/index.js';
import { loadSyncFiles } from 'src/apply/preview/loader.js';
import { normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { HoneyMoneyTransaction, PreviewRecord } from 'src/apply/preview/types.js';
import { createAccountRegistry, loadConfig } from 'src/config.js';
import { loadEnv, validateHoneyMoneyEnv, validateTochkaEnv } from 'src/env.js';
import { CACHE_PATH, trimEntries, writeCache } from 'src/hmbee/cache.js';
import { HoneyMoneyClient } from 'src/hmbee/client.js';
import { buildPlannedCandidateIndex } from 'src/hmbee/plannedIndex.js';
import { applyMatchPass } from 'src/hmbee/plannedMatcher.js';
import { applySkipPass, buildMatchIndex, loadCache } from 'src/hmbee/skipIndex.js';
import { writeOutput } from 'src/output.js';

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
  .option('--verbose', 'Print informational output')
  .option('--stdout', 'Write output to stdout instead of file')
  .option('--update-hmbee-cache', 'After source sync, also fetch and write the Honey Money transaction cache')
  .action(async (source, options) => {
    const isVerbose = options.verbose;
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

    if (isVerbose) console.log(`Syncing from ${source}...`);
    try {
      const result = await adapter.sync({ from: options.from, to: options.to });

      const outputData = options.format === 'raw' ? result.raw : result.records;
      const outputPath = writeToStdout ? undefined : `sync/${source}/${options.from}_${options.to}.json`;
      writeOutput(outputData, outputPath);

      if (isVerbose) console.log(`✓ Sync complete. Fetched ${result.records.length} records.`);
    } catch (error: unknown) {
      console.error(`Sync failed: ${getErrorMessage(error)}`);
      process.exit(1);
    }

    if (options.updateHmbeeCache) {
      if (isVerbose) console.log('Updating Honey Money cache...');
      try {
        const hmEnv = validateHoneyMoneyEnv();
        const client = new HoneyMoneyClient(hmEnv);
        const all = await client.getAllTransactions();
        const trimmed = trimEntries(all, options.from);
        writeCache(trimmed);
        if (isVerbose) console.log(`✓ Honey Money cache updated. ${trimmed.length} records written to cache.`);
      } catch (error: unknown) {
        console.error(`Honey Money cache update failed: ${getErrorMessage(error)}`);
        process.exit(1);
      }
    }
  });

program
  .command('apply')
  .description('Process synchronized data for a source')
  .argument('<source>', 'Source name (e.g., tochka)')
  .option('--preview', 'Preview normalized records without writing to Honey Money')
  .option('--only-errors', 'When combined with --preview, show only records with identified=false or save=false')
  .option('--only-id <ids>', 'Only save the specified comma-separated source transaction ids')
  .option('--verbose', 'Print informational output')
  .action(async (source, options) => {
    const isVerbose = options.verbose;

    if (source !== 'tochka') {
      console.error(`Unsupported source: ${source}`);
      process.exit(1);
    }

    try {
      const config = loadConfig();
      const tochkaConfig = config.sources.tochka;
      if (!tochkaConfig) {
        console.error("Source 'tochka' is not configured in sources.json");
        process.exit(1);
      }
      const accountRegistry = createAccountRegistry(config);
      const records = loadSyncFiles(source);
      const normalized = records.map((record) =>
        normalizeTochkaRecord(record, {
          accountMappings: tochkaConfig.accountMappings,
          typeCodeRules: tochkaConfig.typeCodes,
          accountRegistry,
          categoryMapping: config.hmbee.categoryMapping
        })
      );

      const cacheEntries = loadCache();
      let cacheMtime: string;
      try {
        cacheMtime = statSync(CACHE_PATH).mtime.toISOString().slice(0, 10);
      } catch {
        cacheMtime = 'unknown';
      }
      const skipIndex = buildMatchIndex(cacheEntries);
      const afterSkip = applySkipPass(normalized, skipIndex);
      const plannedIndex = buildPlannedCandidateIndex(cacheEntries);
      const previewRecords = applyMatchPass(afterSkip, plannedIndex);

      if (isVerbose) {
        const skippedCount = previewRecords.filter((r) => r.reason === 'Внесена вручную').length;
        if (skippedCount > 0) {
          console.error(`Skipped ${skippedCount} records already entered in Honey Money (cache date: ${cacheMtime}).`);
        }
      }

      if (options.preview) {
        if (isVerbose) {
          console.error(`Applying ${source} with preview...`);
          console.error(`Loaded ${records.length} records from sync/${source}`);
        }

        const outputRecords = options.onlyErrors
          ? previewRecords.filter((r) => !r.identified || !r.save)
          : previewRecords;

        writeOutput(outputRecords);

        if (isVerbose) {
          if (options.onlyErrors) {
            console.error(
              `✓ Preview complete. Processed ${previewRecords.length} records. Showing ${outputRecords.length} error records.`
            );
          } else {
            console.error(`✓ Preview complete. Processed ${previewRecords.length} records.`);
          }
        }
        return;
      }

      const readyRecords = previewRecords.filter(isReadyForApply);
      const onlyIds = parseOnlyIdsOption(options.onlyId);
      const selectedRecords = filterApplyRecords(readyRecords, onlyIds);
      const createDrafts = selectedRecords.filter((r) => r.hmbee.id === null);
      const deferredConfirmCount = selectedRecords.length - createDrafts.length;
      const missingAccountMappings = createDrafts.filter((record) => record.hmbee.account_id === null);

      if (missingAccountMappings.length > 0) {
        const missingAccounts = [...new Set(missingAccountMappings.map((record) => record.normalized.account))].join(
          ', '
        );
        throw new Error(`Missing Honey Money account mapping for Tochka accounts: ${missingAccounts}`);
      }

      const hmEnv = validateHoneyMoneyEnv();
      const client = new HoneyMoneyClient(hmEnv);

      if (isVerbose) {
        console.error(`Applying ${source} to Honey Money...`);
        console.error(`Loaded ${records.length} records from sync/${source}`);
        console.error(`Sending ${createDrafts.length} create drafts.`);
        if (deferredConfirmCount > 0) {
          console.error(`Deferred ${deferredConfirmCount} planned transaction confirmations (not yet supported).`);
        }
      }

      const createdTransactions = [] as Array<
        HoneyMoneyTransaction & { sourceTransactionId: string; honeyMoneyTransactionId: number }
      >;

      for (const record of createDrafts) {
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

      if (isVerbose) {
        const skippedCount = previewRecords.length - createDrafts.length;
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
