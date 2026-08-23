import { statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { TochkaAdapter } from 'src/adapters/tochka.js';
import type { SourceAdapter } from 'src/adapters/types.js';
import { dispatchTransaction, parseOnlyIdsOption, promptSend, selectRecordsForApply } from 'src/apply/index.js';
import { loadSyncFiles } from 'src/apply/preview/loader.js';
import type { TochkaSyncRecord } from 'src/apply/preview/tochka.js';
import { describeSourceRecord, normalizeTochkaRecord } from 'src/apply/preview/tochka.js';
import type { HoneyMoneyTransaction } from 'src/apply/preview/types.js';
import { createAccountRegistry, loadConfig } from 'src/config.js';
import { loadEnv, validateHoneyMoneyEnv, validateTochkaEnv } from 'src/env.js';
import { CACHE_PATH, refreshCache } from 'src/hmbee/cache.js';
import { HoneyMoneyClient } from 'src/hmbee/client.js';
import { buildPlannedCandidateIndex } from 'src/hmbee/plannedIndex.js';
import { applyMatchPass } from 'src/hmbee/plannedMatcher.js';
import { buildPreviewPlannedOutput } from 'src/hmbee/previewPlanned.js';
import { applySkipPass, buildMatchIndex, loadCache } from 'src/hmbee/skipIndex.js';
import { writeOutput } from 'src/output.js';
import { writeSyncOutput } from 'src/sync/cleanup.js';

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
  .option('--verbose', 'Print informational output')
  .option('--stdout', 'Write output to stdout instead of file')
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
      const config = loadConfig();
      const result = await adapter.sync({ from: options.from, to: options.to, timeZone: config.time_zone });

      const outputData = options.format === 'raw' ? result.raw : result.records;
      const outputPath = writeToStdout ? undefined : `sync/${source}/${options.from}_${options.to}.json`;
      writeSyncOutput(source, outputData, outputPath);

      if (isVerbose) console.log(`✓ Sync complete. Fetched ${result.records.length} records.`);
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
  .option(
    '--preview-planned',
    'Preview only plan-relevant records (matched and candidates) plus the source unmatched plans'
  )
  .option('--only-errors', 'When combined with --preview, show only records with identified=false or save=false')
  .option('--only-id <ids>', 'Only save the specified comma-separated source transaction ids')
  .option('--one-by-one', 'Ask for confirmation before each send (inert in preview modes)')
  .option('--verbose', 'Print informational output')
  .option(
    '--skip-hmbee-cache-update',
    'Skip refreshing the Honey Money cache before the skip pass (offline/test runs on the existing cache)'
  )
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
      const { records, from: syncFrom } = loadSyncFiles(source);
      const normalized = records
        .map((record) =>
          normalizeTochkaRecord(record, {
            accountMappings: tochkaConfig.accountMappings,
            typeCodeRules: tochkaConfig.typeCodes,
            accountRegistry,
            categoryMapping: config.hmbee.categoryMapping,
            timeZone: config.time_zone
          })
        )
        .sort((a, b) => (a.normalized?.date ?? '').localeCompare(b.normalized?.date ?? ''));

      if (!options.skipHmbeeCacheUpdate) {
        try {
          const hmEnv = validateHoneyMoneyEnv();
          const client = new HoneyMoneyClient(hmEnv);
          await refreshCache(client, syncFrom);
        } catch (error: unknown) {
          throw new Error(`Honey Money cache refresh failed: ${getErrorMessage(error)}`);
        }
      }

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

      if (options.previewPlanned && options.preview) {
        console.error('--preview-planned and --preview are mutually exclusive; using --preview-planned');
      }

      if (options.previewPlanned) {
        const hmAccountIds = new Set(Object.values(tochkaConfig.hmAccounts).map((account) => account.id));
        const output = buildPreviewPlannedOutput(previewRecords, plannedIndex, hmAccountIds);
        writeOutput(output);

        if (isVerbose) {
          console.error(
            `✓ Preview-planned complete. ${output.records.length} plan-relevant records, ${output.unmatchedPlans.length} unmatched plans.`
          );
        }
        return;
      }

      if (options.preview) {
        if (isVerbose) {
          console.error(`Applying ${source} with preview...`);
          console.error(`Loaded ${records.length} records from sync/${source}`);
        }

        const filteredRecords = options.onlyErrors
          ? previewRecords.filter((r) => !r.identified || !r.save)
          : previewRecords;

        const outputRecords = [...filteredRecords].sort((a, b) =>
          (a.normalized?.date ?? '').localeCompare(b.normalized?.date ?? '')
        );

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

      const onlyIds = parseOnlyIdsOption(options.onlyId);
      const selection = selectRecordsForApply(previewRecords, onlyIds);

      if (selection.blocked) {
        console.error(
          `Apply aborted: ${selection.problematicRecords.length} problematic record(s) found. Resolve them before applying (use --preview --only-errors to inspect):`
        );
        for (const record of selection.problematicRecords) {
          const { id, description } = describeSourceRecord(record.sourceRecord as TochkaSyncRecord);
          console.error(`  - ${id}: ${description} — ${record.reason ?? '(no reason)'}`);
        }
        process.exit(1);
      }

      const selectedRecords = selection.records;
      const missingAccountMappings = selectedRecords.filter((record) => record.hmbee.account_id === null);

      if (missingAccountMappings.length > 0) {
        const missingAccounts = [...new Set(missingAccountMappings.map((record) => record.normalized.account))].join(
          ', '
        );
        throw new Error(`Missing Honey Money account mapping for Tochka accounts: ${missingAccounts}`);
      }

      const hmEnv = validateHoneyMoneyEnv();
      const client = new HoneyMoneyClient(hmEnv);

      if (isVerbose) {
        const createCount = selectedRecords.filter((r) => r.hmbee.id === null).length;
        const confirmCount = selectedRecords.length - createCount;
        console.error(`Applying ${source} to Honey Money...`);
        console.error(`Loaded ${records.length} records from sync/${source}`);
        console.error(`Sending ${createCount} create drafts, ${confirmCount} plan confirmations.`);
      }

      const sentTransactions = [] as Array<
        HoneyMoneyTransaction & { sourceTransactionId: string; honeyMoneyTransactionId: number }
      >;
      let createdCount = 0;
      let confirmedCount = 0;
      let sendAll = false;

      const rl = options.oneByOne ? createInterface({ input: process.stdin, output: process.stderr }) : null;

      try {
        for (const record of selectedRecords) {
          if (rl && !sendAll) {
            const { date, subtype, category, description, id } = record.hmbee;
            const mode = id === null ? '[create]' : `[confirm #${id}]`;
            const summary = `${date} · ${subtype} · ${category ?? '—'} · ${description} ${mode}`;
            const answer = await promptSend(
              summary,
              (prompt) => new Promise((resolve) => rl.question(prompt, resolve))
            );
            if (answer === 'n') continue;
            if (answer === 'q') break;
            if (answer === 'a') sendAll = true;
          }

          const honeyMoneyTransactionId = await dispatchTransaction(record.hmbee, client);
          if (record.hmbee.id === null) {
            createdCount++;
          } else {
            confirmedCount++;
          }

          sentTransactions.push({
            sourceTransactionId: record.normalized.transactionId,
            honeyMoneyTransactionId,
            ...record.hmbee
          });
        }
      } finally {
        rl?.close();
      }

      if (isVerbose) {
        const skippedCount = previewRecords.length - selectedRecords.length;
        console.error(
          `✓ Apply complete. Created ${createdCount}, confirmed ${confirmedCount} Honey Money transactions.` +
            (skippedCount > 0 ? ` Skipped ${skippedCount} records.` : '')
        );
      }
    } catch (error: unknown) {
      console.error(`Apply failed: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
