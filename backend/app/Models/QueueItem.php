<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class QueueItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'players',
        'position',
        'is_playing',
        'cabinet_id',
        'request_hash',
        'owner_id',
        'started_at',
    ];

    // ensure 'players' is cast to an array
    protected $casts = [
        'players' => 'array',
        'is_playing' => 'boolean',
        'started_at' => 'datetime',
    ];

    public function cabinet() {
        return $this->belongsTo(Cabinet::class);
    }

    /**
     * Finish the current turn for this queue item.
     * Moves the item to the end of the queue for its cabinet,
     * clears `started_at` and marks it not playing.
     */
    public function finishTurn(): void
    {
        // Move this item to the end and start the next item (atomic)
        DB::transaction(function () {
            // Lock rows for this cabinet
            $maxPosition = self::where('cabinet_id', $this->cabinet_id)->lockForUpdate()->max('position') ?? 0;

            // Move current item to the end
            $this->update([
                'position' => $maxPosition + 1,
                'is_playing' => false,
                'started_at' => null,
            ]);

            // Find the next item (new front) and start it if not started
            $next = self::where('cabinet_id', $this->cabinet_id)
                ->where('id', '!=', $this->id)
                ->whereNotNull('position')
                ->orderBy('position', 'asc')
                ->lockForUpdate()
                ->first();

            if ($next) {
                if (!$next->started_at) {
                    $next->update([
                        'started_at' => now(),
                        'is_playing' => true,
                    ]);
                }
            }
        });
    }
}
