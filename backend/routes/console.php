<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Console\Scheduling\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Register scheduled tasks here for Laravel 11+ setups where the Console Kernel
// is not wired via Application builder. This attaches to the Scheduler instance.
$schedule = app(Schedule::class);
$schedule->command('db:daily-reset')->dailyAt('23:00')->timezone('Asia/Jakarta');
