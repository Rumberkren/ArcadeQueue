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
            $driver = DB::connection()->getDriverName();

            if ($driver === 'mysql') {
                DB::statement('SET FOREIGN_KEY_CHECKS=0;');
                DB::table('queue_items')->truncate();
                DB::table('cabinets')->truncate();
                DB::statement('SET FOREIGN_KEY_CHECKS=1;');
                $this->info('Truncated tables: queue_items, cabinets (MySQL)');
                Log::info('DailyReset: truncated queue_items and cabinets (MySQL)');
            } elseif ($driver === 'sqlite') {
                DB::table('queue_items')->delete();
                DB::table('cabinets')->delete();
                DB::statement("DELETE FROM sqlite_sequence WHERE name='queue_items';");
                DB::statement("DELETE FROM sqlite_sequence WHERE name='cabinets';");
                $this->info('Deleted rows and reset sqlite sequences: queue_items, cabinets');
                Log::info('DailyReset: sqlite delete + sequence reset');
            } elseif ($driver === 'pgsql' || $driver === 'postgres') {
                DB::table('queue_items')->delete();
                DB::table('cabinets')->delete();
                DB::statement("SELECT setval(pg_get_serial_sequence('queue_items','id'), 1, false);");
                DB::statement("SELECT setval(pg_get_serial_sequence('cabinets','id'), 1, false);");
                $this->info('Deleted rows and reset Postgres sequences: queue_items, cabinets');
                Log::info('DailyReset: postgres delete + sequence reset');
            } else {
                // Generic attempt: try truncate first, fallback to delete and best-effort reset
                try {
                    DB::table('queue_items')->truncate();
                    DB::table('cabinets')->truncate();
                    $this->info('Truncated tables: queue_items, cabinets');
                    Log::info('DailyReset: truncated queue_items and cabinets (generic)');
                } catch (\Throwable $inner) {
                    DB::table('queue_items')->delete();
                    DB::table('cabinets')->delete();
                    $this->warn('Truncate not supported; performed DELETE fallback');
                    Log::warning('DailyReset: truncate unsupported; performed DELETE fallback');
                }
            }
        } catch (\Throwable $e) {
            $this->error('Daily reset failed: ' . $e->getMessage());
            Log::error('DailyReset: failed - ' . $e->getMessage());
            return Command::FAILURE;
        }

        $this->info('Daily DB reset completed successfully.');
        Log::info('DailyReset: completed successfully');
        return Command::SUCCESS;
    }
}
