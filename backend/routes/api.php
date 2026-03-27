<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\QueueController;
use App\Http\Controllers\Api\CabinetController;

// Cabinet routes
Route::get('/cabinets', [CabinetController::class, 'index']);
Route::post('/cabinets', [CabinetController::class, 'store']);
Route::delete('/cabinets/{id}', [CabinetController::class, 'destroy']);
Route::put('/cabinets/{id}', [CabinetController::class, 'update']);

Route::patch('/cabinets/{id}/reorder', [CabinetController::class, 'reorder']);

// Queue routes
Route::get('/queue', [QueueController::class, 'index']);
Route::get('/queue/{cabinetId}/time-to-finish', [QueueController::class, 'timeToFinish']);
Route::post('/queue', [QueueController::class, 'store']);
Route::delete('/queue/{id}', [QueueController::class, 'destroy']);
Route::post('/queue/{id}/cycle', [QueueController::class, 'cycle']);
Route::post('/queue/{id}/finish', [QueueController::class, 'finish']);
Route::post('/queue/{id}/move', [QueueController::class, 'move']);
Route::patch('/queue/{id}', [QueueController::class, 'update']);

Route::get('/health', function () {
    try {
        // Quick DB ping
        DB::connection()->getPdo();
        return response()->json(['status' => 'ok'], 200);
    } catch (\Exception $e) {
        return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
    }
});