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

        // return all queue items with their cabinets
        return QueueItem::with('cabinet')->orderBy('position', 'asc')->get();
    }
    
    // add a new item to the queue
    public function store(Request $request) {

        // validate input 
        $request->validate([
            'cabinet_id' => 'required|exists:cabinets,id',
            'type' => 'required',
            'players' => 'required',
        ]);

        $maxPosition = QueueItem::where('cabinet_id', $request->cabinet_id)->max('position') ?? 0;

        // create new queue item
        $item = QueueItem::firstOrCreate([
            'cabinet_id' => $request->cabinet_id,
            'type' => $request->type,
            'players' => $request->players,
            'position' => $maxPosition + 1,
        ]);

        return response()->json($item, 201);
    }

    // cycle the position of a queue item to the end
    public function cycle($id) {

        // find the item
        $item = QueueItem::find($id);
        if($item) {
            
            // find current max/last position
            $maxPosition = QueueItem::where('cabinet_id', $item->cabinet_id)->max('position');

            // update this item's position to be last
            $item->position = $maxPosition + 1;
            $item->save();
        }
        
        return response()->json([ 'message' => 'Cycled' ], 200);
    }

    public function move(Request $request, $id) {

        $item = QueueItem::find($id); // find item by id
        $newCabinetId = $request->target_cabinet_id; // target cabinet id from request
    
        if($item && $newCabinetId) {
            // find current max/last position in target cabinet
            $maxPosition = QueueItem::where('cabinet_id', $newCabinetId)->max('position') ?? 0;

            // update this item's cabinet and position to be last in target cabinet
            $item->cabinet_id = $newCabinetId;
            $item->position = $maxPosition + 1;
            $item->save();
        }
    }

    public function destroy($id) {

        QueueItem::destroy($id);
        return response()->json([ 'message' => 'Deleted' ], 200);
    }


}
