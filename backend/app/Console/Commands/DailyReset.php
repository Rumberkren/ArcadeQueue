<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DailyReset extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'db:daily-reset';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Daily reset: remove cabinets and queue items and reset ids';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting daily DB reset...');
        Log::info('DailyReset: starting db:daily-reset');

        try {
            // Disable foreign key checks for truncation
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');

            // Truncate tables (resets AUTO_INCREMENT on MySQL)
            DB::table('queue_items')->truncate();
            DB::table('cabinets')->truncate();

            // Re-enable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');

            $this->info('Truncated tables: queue_items, cabinets');
            Log::info('DailyReset: truncated queue_items and cabinets');
        } catch (\Throwable $e) {
            // Attempt an alternative safe delete if truncate fails
            try {
                DB::statement('SET FOREIGN_KEY_CHECKS=0;');
                DB::table('queue_items')->delete();
                DB::table('cabinets')->delete();
                DB::statement('SET FOREIGN_KEY_CHECKS=1;');
                $this->warn('Truncate failed; performed DELETE. Check logs for details.');
                Log::warning('DailyReset: truncate failed; performed DELETE fallback');
            } catch (\Throwable $inner) {
                $this->error('Daily reset failed: ' . $inner->getMessage());
                Log::error('DailyReset: failed - ' . $inner->getMessage());
                return Command::FAILURE;
            }
        }

        $this->info('Daily DB reset completed successfully.');
        Log::info('DailyReset: completed successfully');
        return Command::SUCCESS;
    }
}
