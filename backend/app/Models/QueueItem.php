<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
    ];

    // ensure 'players' is cast to an array
    protected $casts = [
        'players' => 'array',
        'is_playing' => 'boolean',
    ];

    public function cabinet() {
        return $this->belongsTo(Cabinet::class);
    }
}
