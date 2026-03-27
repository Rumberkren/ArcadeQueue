<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Models\Cabinet;
use App\Models\QueueItem;

class QueueController extends Controller
{

    public function index() {

        // Use environment-driven auto-finish minutes to keep server/client in sync
        $autoFinishMinutes = intval(env('AUTO_FINISH_MINUTES', 17));

        DB::transaction(function () use ($autoFinishMinutes) {
            $expiredItems = QueueItem::whereNotNull('started_at')
                ->where('started_at', '<', now()->subMinutes($autoFinishMinutes))
                ->lockForUpdate()
                ->get();

            foreach ($expiredItems as $item) {
                $item->finishTurn();
            }
        });
            // Lock all queue items for reading to prevent


        return QueueItem::with('cabinet')->orderBy('position', 'asc')->get();
    }

    /**
     * Return remaining seconds until auto-finish for the current session
     * of a given cabinet. Returns null if there is no active started session.
     */
    public function timeToFinish($cabinetId)
    {
        $item = QueueItem::where('cabinet_id', $cabinetId)
            ->orderBy('position', 'asc')
            ->first();

        if (!$item || !$item->started_at) {
            return response()->json(['remaining_seconds' => null], 200);
        }

        $autoFinishMinutes = intval(env('AUTO_FINISH_MINUTES', 17));

        // elapsed seconds since started_at
        $elapsed = now()->diffInSeconds($item->started_at);
        $remain = max(0, ($autoFinishMinutes * 60) - $elapsed);

        return response()->json(['remaining_seconds' => $remain], 200);
    }
    
    // add a new item to the queue
    public function store(Request $request) {

        $validated = $request->validate([
            'cabinet_id' => 'required|exists:cabinets,id',
            'type' => 'required|in:solo,duo',
            'players' => 'required|array|min:1|max:2',
            'owner_id' => 'nullable|string',
        ]);

        // $maxPosition = QueueItem::where('cabinet_id', $request->cabinet_id)->max('position') ?? 0;

        // create new queue item 
        // R1
        // $item = QueueItem::firstOrCreate([
        //     'cabinet_id' => $request->cabinet_id,
        //     'type' => $request->type,
        //     'players' => $request->players,
        //     'position' => $maxPosition + 1,
        // ]);
        
        // R2
        // Normalize players
        $players = collect($validated['players'])
            ->map(fn ($p) => trim(strtolower($p)))
            ->sort()
            ->values()
            ->toArray();

        // Deterministic hash
        $requestHash = hash('sha256', json_encode([
            'cabinet_id' => $validated['cabinet_id'],
            'type' => $validated['type'],
            'players' => $players,
            'owner_id' => $validated['owner_id'],
        ]));

        try {
            $item = DB::transaction(function () use ($validated, $players, $requestHash) {

                // First try to get existing (FAST PATH)
                $existing = QueueItem::where('request_hash', $requestHash)->first();
                if ($existing) {
                    return $existing;
                }

                // Lock cabinet rows to prevent race
                $maxPosition = QueueItem::where('cabinet_id', $validated['cabinet_id'])
                    ->lockForUpdate()
                    ->max('position') ?? 0;

                return QueueItem::create([
                    'cabinet_id'   => $validated['cabinet_id'],
                    'type'         => $validated['type'],
                    'players'      => $players,
                    'position'     => $maxPosition + 1,
                    'request_hash' => $requestHash,
                    'owner_id'     => $validated['owner_id'],
                ]);
            });

            return response()->json($item, 201);

        } catch (\Illuminate\Database\QueryException $e) {
            // UNIQUE constraint fallback (race condition safety)
            $existing = QueueItem::where('request_hash', $requestHash)->first();

            if ($existing) {
                return response()->json($existing, 200);
            }

            throw $e; // real error
        }
    
    }

    public function start($id, Request $request) {

        DB::transaction(function () use ($id, $request) {

            $item = QueueItem::lockForUpdate()->findOrFail($id);
            if($item->started_at) {
                abort(400, 'Turn already started');
            }

            $item->started_at = now();
            $item->save();
        });

        return response()->json([ 'message' => 'Turn started' ], 200);
    }

    public function finish($id, Request $request) {

        DB::transaction(function () use ($id, $request) {

            $item = QueueItem::lockForUpdate()->findOrFail($id);
            if ($item->owner_id !== $request->owner_id) {
                abort(403, 'You do not have permission to finish this turn');
            }

            $item->finishTurn();
        });

        return response()->json([ 'message' => 'Turn finished' ], 200);
    }

    // cycle the position of a queue item to the end
    public function cycle($id) {

        // find the item
        // R1
        // $item = QueueItem::find($id);
        // if($item) {
            
        //     // find current max/last position
        //     $maxPosition = QueueItem::where('cabinet_id', $item->cabinet_id)->max('position');

        //     // update this item's position to be last
        //     $item->position = $maxPosition + 1;
        //     $item->save();
        // }

        // R2 - do it in a transaction
        DB::transaction(function () use ($id) {

            $item = QueueItem::lockForUpdate()->find($id);
            if(!$item) return;
                
            // find current max/last position
            $maxPosition = QueueItem::where('cabinet_id', $item->cabinet_id)
                ->lockForUpdate()
                ->max('position');

            // update this item's position to be last
            $item->update([
                'position' => $maxPosition + 1,
                'is_playing' => false,
                'started_at' => null,
            ]);

            // Start the new front item (if any)
            $next = QueueItem::where('cabinet_id', $item->cabinet_id)
                ->where('id', '!=', $item->id)
                ->orderBy('position', 'asc')
                ->lockForUpdate()
                ->first();

            if ($next && !$next->started_at) {
                $next->update([
                    'started_at' => now(),
                    'is_playing' => true,
                ]);
            }
            
        });
        
        return response()->json([ 'message' => 'Cycled' ], 200);
    }

    public function move(Request $request, $id) {

        // R1
        // $item = QueueItem::find($id); // find item by id
        // $newCabinetId = $request->target_cabinet_id; // target cabinet id from request
    
        // if($item && $newCabinetId) {
        //     // find current max/last position in target cabinet
        //     $maxPosition = QueueItem::where('cabinet_id', $newCabinetId)->max('position') ?? 0;

        //     // update this item's cabinet and position to be last in target cabinet
        //     $item->cabinet_id = $newCabinetId;
        //     $item->position = $maxPosition + 1;
        //     $item->save();
        // }

        // R2 - do it in a transaction
        $request->validate([
            'target_cabinet_id' => 'required|exists:cabinets,id',
        ]);

        DB::transaction(function () use ($id, $request) {

            $item = QueueItem::lockForUpdate()->find($id);
            if(!$item) return;

            // find current max/last position in target cabinet
            $maxPosition = QueueItem::where('cabinet_id', $request->target_cabinet_id)
                ->lockForUpdate()
                ->max('position') ?? 0;

            // update this item's cabinet and position to be last in target cabinet
            $item->update([
                'cabinet_id' => $request->target_cabinet_id,
                'position' => $maxPosition + 1,
            ]);
        });

        return response()->json([ 'message' => 'Moved' ], 200);
    }

    // update players
    public function update(Request $request, $id){
        
        if (!$request->has('players')) {
            return response()->json(['message' => 'Nothing to update'], 400);
        }

        $validated = $request->validate([
            'players' => 'required|array|min:1|max:2',
        ]);

        // Normalize players
        $players = collect($validated['players'])
            ->map(fn ($p) => trim(strtolower($p)))
            ->sort()
            ->values()
            ->toArray();

        $item = DB::transaction(function () use ($id, $players) {

            $item = QueueItem::lockForUpdate()->find($id);
            if (!$item) {
                return null;
            }

            // Recalculate hash (must match store logic)
            $newHash = hash('sha256', json_encode([
                'cabinet_id' => $item->cabinet_id,
                'type' => $item->type,
                'players' => $players,
            ]));

            // Check if this edit would collide with another row
            $collision = QueueItem::where('request_hash', $newHash)
                ->where('id', '!=', $item->id)
                ->exists();

            if ($collision) {
                throw new \Exception('Duplicate queue entry detected');
            }

            $item->update([
                'players' => $players,
                'request_hash' => $newHash,
            ]);

            return $item;
        });

        if (!$item) {
            return response()->json(['message' => 'Queue item not found'], 404);
        }

        return response()->json($item, 200);
    }

    public function destroy($id) {

        QueueItem::destroy($id);
        return response()->json([ 'message' => 'Deleted' ], 200);
    }


}
