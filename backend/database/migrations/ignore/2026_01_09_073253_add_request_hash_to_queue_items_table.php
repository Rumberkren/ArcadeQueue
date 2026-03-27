<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('queue_items', function (Blueprint $table) {
            $table->string('request_hash', 64)->unique()->after('id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('queue_items', function (Blueprint $table) {
            $table->dropUnique(['request_hash']);
            $table->dropColumn('request_hash');
        });
    }
};
